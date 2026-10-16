import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onAuthStateChanged } from 'firebase/auth';
import { deleteDoc, getDoc, onSnapshot, orderBy, runTransaction, serverTimestamp } from 'firebase/firestore';
import { addFavorite, removeFavorite, subscribeFavorites } from './favorites';
import type { FavoriteInput } from './favorites';

const state = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'user-1' } as { uid: string } | null },
  profile: { role: 'USER', status: 'ACTIVE', profileCompleted: true },
  transaction: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../config/firebase', () => ({ auth: state.auth, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path: string[]) => path.join('/')),
  collection: vi.fn((_db, ...path: string[]) => path.join('/')),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  query: vi.fn((path, order) => ({ path, order })),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  onSnapshot: vi.fn(),
}));

const movie: FavoriteInput = { id: 42, title: 'Example', poster_path: '/example.jpg', release_date: '2026-10-01' };

beforeEach(() => {
  vi.clearAllMocks();
  state.auth.currentUser = { uid: 'user-1' };
  state.profile = { role: 'USER', status: 'ACTIVE', profileCompleted: true };
  vi.mocked(getDoc).mockImplementation(async () => ({ data: () => state.profile }) as Awaited<ReturnType<typeof getDoc>>);
  state.transaction.get.mockResolvedValue({ exists: () => false });
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(state.transaction as unknown as Parameters<typeof callback>[0]));
  vi.mocked(deleteDoc).mockResolvedValue(undefined);
});

describe('Favorite writes', () => {
  it('creates exactly the five required fields under the signed-in user using a transaction', async () => {
    await addFavorite(movie);
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(state.transaction.get).toHaveBeenCalledWith('users/user-1/favorites/42');
    expect(state.transaction.set).toHaveBeenCalledWith('users/user-1/favorites/42', {
      movieId: 42, title: 'Example', posterPath: '/example.jpg', releaseDate: '2026-10-01', addedAt: 'server-timestamp',
    });
    expect(serverTimestamp).toHaveBeenCalledOnce();
  });

  it('allows a missing poster and an empty release date', async () => {
    await addFavorite({ ...movie, poster_path: null, release_date: '' });
    expect(state.transaction.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ posterPath: null, releaseDate: '' }));
  });

  it('accepts field lengths at the schema limits', async () => {
    await addFavorite({ ...movie, title: 'a'.repeat(300), poster_path: 'a'.repeat(500) });
    expect(state.transaction.set).toHaveBeenCalledOnce();
  });

  it.each([
    { id: 0 }, { id: -1 }, { id: 1.5 }, { id: Number.NaN }, { id: Number.POSITIVE_INFINITY },
    { title: '' }, { title: '   ' }, { title: 'a'.repeat(301) },
    { poster_path: 'a'.repeat(501) }, { release_date: '2026-01-011' },
  ])('rejects invalid movie data before reading or writing: %j', async (invalid) => {
    await expect(addFavorite({ ...movie, ...invalid })).rejects.toThrow();
    expect(getDoc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('does not overwrite a favorite or generate another timestamp on repeat adds', async () => {
    state.transaction.get.mockResolvedValue({ exists: () => true });
    await addFavorite(movie);
    expect(state.transaction.set).not.toHaveBeenCalled();
    expect(serverTimestamp).not.toHaveBeenCalled();
  });

  it('skips the write if a competing session created the favorite before a transaction retry', async () => {
    vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
      await callback(state.transaction as unknown as Parameters<typeof callback>[0]);
      // Firestore discards the conflicted attempt and reruns the transaction.
      state.transaction.set.mockClear();
      state.transaction.get.mockResolvedValue({ exists: () => true });
      return callback(state.transaction as unknown as Parameters<typeof callback>[0]);
    });
    await addFavorite(movie);
    expect(state.transaction.get).toHaveBeenCalledTimes(2);
    expect(state.transaction.set).not.toHaveBeenCalled();
  });

  it('only deletes the movie document from the current account', async () => {
    state.auth.currentUser = { uid: 'user-2' };
    await removeFavorite(42);
    expect(deleteDoc).toHaveBeenCalledWith('users/user-2/favorites/42');
    expect(state.transaction.set).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5])('rejects invalid removal ID %s', async (id) => {
    await expect(removeFavorite(id)).rejects.toThrow('positive integer');
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('rejects signed-out writes', async () => {
    state.auth.currentUser = null;
    await expect(addFavorite(movie)).rejects.toThrow('sign in');
    await expect(removeFavorite(42)).rejects.toThrow('sign in');
    expect(getDoc).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'ADMIN', status: 'ACTIVE', profileCompleted: true },
    { role: 'USER', status: 'DISABLED', profileCompleted: true },
    { role: 'USER', status: 'ACTIVE', profileCompleted: false },
    { role: '', status: '', profileCompleted: false },
  ])('blocks writes for an ineligible profile: %j', async (profile) => {
    state.profile = profile;
    await expect(addFavorite(movie)).rejects.toThrow('active USER');
    await expect(removeFavorite(42)).rejects.toThrow('active USER');
    expect(runTransaction).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('abandons a write when the account changes during the profile read', async () => {
    vi.mocked(getDoc).mockImplementationOnce(async () => {
      state.auth.currentUser = { uid: 'user-2' };
      return { data: () => state.profile } as Awaited<ReturnType<typeof getDoc>>;
    });
    await expect(addFavorite(movie)).rejects.toThrow('session changed');
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('abandons a transaction when the account changes during the movie read', async () => {
    state.transaction.get.mockImplementationOnce(async () => {
      state.auth.currentUser = { uid: 'user-2' };
      return { exists: () => false };
    });
    await expect(addFavorite(movie)).rejects.toThrow('session changed');
    expect(state.transaction.set).not.toHaveBeenCalled();
  });

  it('passes Firestore write errors to the caller', async () => {
    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('permission-denied'));
    await expect(addFavorite(movie)).rejects.toThrow('permission-denied');
    vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('unavailable'));
    await expect(removeFavorite(42)).rejects.toThrow('unavailable');
  });
});

describe('Favorite subscription lifecycle', () => {
  function listen() {
    const stopAuth = vi.fn();
    const stopSnapshot = vi.fn();
    vi.mocked(onAuthStateChanged).mockReturnValue(stopAuth);
    vi.mocked(onSnapshot).mockReturnValue(stopSnapshot);
    const callback = vi.fn();
    const onError = vi.fn();
    const stop = subscribeFavorites(callback, onError);
    const changeAccount = (uid: string | null) => {
      state.auth.currentUser = uid ? { uid } : null;
      const next = vi.mocked(onAuthStateChanged).mock.calls[0][1] as (user: typeof state.auth.currentUser) => void;
      next(state.auth.currentUser);
    };
    return { stop, callback, onError, changeAccount, stopAuth, stopSnapshot };
  }

  async function flush() { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }

  function emit(index: number, movies: unknown[]) {
    const next = vi.mocked(onSnapshot).mock.calls[index][1] as (snapshot: unknown) => void;
    next({ docs: movies.map((data) => ({ data: () => data })) });
  }

  it('waits for the first snapshot, scopes the query, orders newest first, and unsubscribes', async () => {
    const listener = listen();
    listener.changeAccount('user-1');
    await flush();
    expect(listener.callback).not.toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalledWith('addedAt', 'desc');
    expect(onSnapshot).toHaveBeenCalledWith({ path: 'users/user-1/favorites', order: { field: 'addedAt', direction: 'desc' } }, expect.any(Function), expect.any(Function));
    emit(0, [{ movieId: 42 }]);
    expect(listener.callback).toHaveBeenLastCalledWith([{ movieId: 42 }]);
    listener.stop();
    expect(listener.stopSnapshot).toHaveBeenCalledOnce();
    expect(listener.stopAuth).toHaveBeenCalledOnce();
  });

  it('clears the previous account and ignores its queued snapshots after switching accounts', async () => {
    const listener = listen();
    listener.changeAccount('user-1');
    await flush();
    listener.changeAccount('user-2');
    expect(listener.stopSnapshot).toHaveBeenCalledOnce();
    expect(listener.callback).toHaveBeenLastCalledWith([]);
    emit(0, [{ movieId: 99 }]);
    expect(listener.callback).toHaveBeenLastCalledWith([]);
    await flush();
    emit(1, [{ movieId: 42 }]);
    expect(listener.callback).toHaveBeenLastCalledWith([{ movieId: 42 }]);
    listener.stop();
  });

  it('clears data and stops the snapshot listener on logout', async () => {
    const listener = listen();
    listener.changeAccount('user-1');
    await flush();
    listener.changeAccount(null);
    expect(listener.stopSnapshot).toHaveBeenCalledOnce();
    expect(listener.callback).toHaveBeenLastCalledWith([]);
    expect(listener.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('sign in') }));
    listener.stop();
  });

  it('does not install a snapshot listener after unmounting during profile validation', async () => {
    const listener = listen();
    listener.changeAccount('user-1');
    listener.stop();
    await flush();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('does not subscribe for an admin profile', async () => {
    state.profile.role = 'ADMIN';
    const listener = listen();
    listener.changeAccount('user-1');
    await flush();
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(listener.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('active USER') }));
    listener.stop();
  });

  it('clears data and forwards snapshot errors', async () => {
    const listener = listen();
    listener.changeAccount('user-1');
    await flush();
    const fail = vi.mocked(onSnapshot).mock.calls[0][2] as unknown as (error: Error) => void;
    const error = new Error('permission-denied');
    fail(error);
    expect(listener.callback).toHaveBeenLastCalledWith([]);
    expect(listener.onError).toHaveBeenLastCalledWith(error);
    listener.stop();
  });
});
