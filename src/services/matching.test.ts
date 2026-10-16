import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onSnapshot, runTransaction, serverTimestamp, startAfter } from 'firebase/firestore';
import type { QuerySnapshot } from 'firebase/firestore';
import {
  calculateSimilarity, findMatches, subscribeMatchingProfiles, isMatchingEligible,
  normalizeMovieIds, synchronizeMatchingProfile,
} from './matching';
import type { MatchingProfile } from './matching';

const state = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'self' } as { uid: string } | null },
  documents: new Map<string, Record<string, unknown>>(),
  transaction: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../config/firebase', () => ({ auth: state.auth, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path: string[]) => path.join('/')),
  collection: vi.fn((_db, ...path: string[]) => path.join('/')),
  documentId: vi.fn(() => '__name__'),
  orderBy: vi.fn((field) => ({ orderBy: field })),
  limit: vi.fn((count) => ({ limit: count })),
  startAfter: vi.fn((cursor) => ({ startAfter: cursor.id })),
  query: vi.fn((path, ...constraints) => ({ path, constraints })),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

const user = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'USER', status: 'ACTIVE', profileCompleted: true };
const data = (movieIds = [1, 2, 3, 4]) => ({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', photoURL: '', movieIds, updatedAt: 'timestamp' });
const profile = (id: string, movieIds: number[]) => ({ ...data(movieIds), id }) as unknown as MatchingProfile;
const page = (entries: { id: string; data: () => Record<string, unknown> }[], fromCache = false, hasPendingWrites = false) => ({
  docs: entries, size: entries.length, metadata: { fromCache, hasPendingWrites },
}) as unknown as QuerySnapshot;
const entry = (id: string, fields: Record<string, unknown> = data()) => ({ id, data: () => fields });
let stops: ReturnType<typeof vi.fn>[];

beforeEach(() => {
  vi.clearAllMocks();
  state.auth.currentUser = { uid: 'self' };
  state.documents.clear();
  state.documents.set('users/self', { ...user });
  state.transaction.get.mockImplementation(async (path: string) => ({ data: () => state.documents.get(path) }));
  state.transaction.set.mockImplementation((path: string, fields: Record<string, unknown>) => state.documents.set(path, fields));
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(state.transaction as unknown as Parameters<typeof callback>[0]));
  stops = [];
  vi.mocked(onSnapshot).mockImplementation(() => {
    const stop = vi.fn();
    stops.push(stop);
    return stop;
  });
});

describe('Jaccard matching', () => {
  it.each([
    [[1, 2, 3, 4], [1, 2, 3, 4, 5], 80, 4],
    [[1, 2, 3], [1, 2, 3, 4], 75, 3],
    [[1, 2], [1, 2, 3], 200 / 3, 2],
    [[], [], 0, 0],
    [[1], [], 0, 0],
    [[1, 1, 2], [1, 2, 2], 100, 2],
  ])('compares %j with %j', (a, b, percentage, commonMovies) => {
    const result = calculateSimilarity(a as number[], b as number[]);
    expect(result.similarity).toBeCloseTo(percentage as number);
    expect(result.commonMovies).toBe(commonMovies);
  });

  it('includes exactly 75%, excludes self, empty playlists and lower scores, and sorts unrounded scores', () => {
    const results = findMatches('self', [1, 2, 3, 4], [
      profile('self', [1, 2, 3, 4]), profile('80', [1, 2, 3, 4, 5]), profile('75', [1, 2, 3]),
      profile('empty', []), profile('below', [1, 2, 5]), profile('100', [1, 2, 3, 4]),
    ]);
    expect(results.map((match) => match.id)).toEqual(['100', '80', '75']);
    expect(findMatches('self', [], [profile('empty', [])])).toEqual([]);
  });

  it('uses the unrounded percentage even when display would round down to 75%', () => {
    const ids = Array.from({ length: 500 }, (_, i) => i + 1);
    const results = findMatches('self', ids, [profile('75.2', ids.slice(0, 376))]);
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeCloseTo(75.2);
    // A score displayed as 75% must still be excluded when its actual value is lower.
    expect(Math.round(calculateSimilarity(ids, ids.slice(0, 374)).similarity)).toBe(75);
    expect(findMatches('self', ids, [profile('74.8', ids.slice(0, 374))])).toEqual([]);
  });

  it.each([[], [1], [1, 2], [1, 1, 2]].map((ids) => ({ ids })))('requires three distinct favorite films before matching: $ids', ({ ids }) => {
    expect(findMatches('self', ids, [profile('other', ids)])).toEqual([]);
  });

  it('starts matching at exactly three distinct favorite films', () => {
    const matches = findMatches('self', [1, 2, 3], [profile('other', [1, 2, 3]), profile('too-few', [1, 2])]);
    expect(matches.map((match) => match.id)).toEqual(['other']);
    expect(matches[0].similarity).toBe(100);
    expect(matches[0].commonMovies).toBe(3);
  });

  it.each([
    { a: [1, 2, 3, 4, 5], b: [1, 2, 3, 4], expected: 80 },
    { a: [1, 2, 3, 4], b: [1, 2, 3], expected: 75 },
  ])('produces the same matching score in both directions at $expected%', ({ a, b, expected }) => {
    const forward = findMatches('a', a, [profile('b', b)])[0];
    const reverse = findMatches('b', b, [profile('a', a)])[0];
    expect(forward.similarity).toBe(expected);
    expect(reverse.similarity).toBe(forward.similarity);
    expect(reverse.commonMovies).toBe(forward.commonMovies);
  });

  it('keeps unique positive numeric safe integers, with a deterministic maximum of 500', () => {
    expect(normalizeMovieIds([2, 1, 2, 0, -1, 1.5, '3', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])).toEqual([1, 2]);
    const ids = Array.from({ length: 600 }, (_, i) => 600 - i);
    expect(normalizeMovieIds(ids)).toEqual(Array.from({ length: 500 }, (_, i) => i + 1));
  });
});

describe('Matching profile synchronization', () => {
  it('creates exactly the required fields with authoritative user data and a server timestamp', async () => {
    await synchronizeMatchingProfile('self', [42, 42, 1, -1], () => true);
    expect(state.transaction.set).toHaveBeenCalledWith('matchingProfiles/self', {
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', photoURL: '', movieIds: [1, 42], updatedAt: 'server-timestamp',
    });
    expect([...state.documents.keys()]).toEqual(['users/self', 'matchingProfiles/self']);
  });

  it('publishes a legitimately empty playlist and skips repeat writes and timestamps', async () => {
    await synchronizeMatchingProfile('self', [], () => true);
    await synchronizeMatchingProfile('self', [], () => true);
    expect(state.transaction.set).toHaveBeenCalledOnce();
    expect(serverTimestamp).toHaveBeenCalledOnce();
    expect(state.documents.get('matchingProfiles/self')?.movieIds).toEqual([]);
  });

  it('updates changed names, email, photo and favorite IDs', async () => {
    await synchronizeMatchingProfile('self', [1], () => true);
    state.documents.set('users/self', { ...user, firstName: 'New', lastName: 'Name', email: 'new@example.com', photoURL: 'https://res.cloudinary.com/example/avatar.jpg' });
    await synchronizeMatchingProfile('self', [2], () => true);
    expect(state.documents.get('matchingProfiles/self')).toEqual({
      firstName: 'New', lastName: 'Name', email: 'new@example.com', photoURL: 'https://res.cloudinary.com/example/avatar.jpg', movieIds: [2], updatedAt: 'server-timestamp',
    });
  });

  it.each([
    { role: 'ADMIN' }, { status: 'DISABLED' }, { profileCompleted: false }, { firstName: '' }, { email: null },
  ])('does not publish an ineligible or incomplete authoritative profile: %j', async (override) => {
    state.documents.set('users/self', { ...user, ...override });
    await expect(synchronizeMatchingProfile('self', [], () => true)).rejects.toThrow();
    expect(state.transaction.set).not.toHaveBeenCalled();
    expect(isMatchingEligible({ ...user, ...override })).toBe(!('role' in override || 'status' in override || 'profileCompleted' in override));
  });

  it('does not start a stale operation or a signed-out operation', async () => {
    await synchronizeMatchingProfile('self', [1], () => false);
    state.auth.currentUser = null;
    await synchronizeMatchingProfile('self', [1], () => true);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('abandons an outdated favorite list while a transaction is reading', async () => {
    let release!: () => void;
    let current = true;
    state.transaction.get.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ data: () => user });
    }));
    const older = synchronizeMatchingProfile('self', [1], () => current);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    current = false;
    const newer = synchronizeMatchingProfile('self', [2], () => true);
    release();
    await Promise.all([older, newer]);
    expect(state.transaction.set).toHaveBeenCalledOnce();
    expect(state.documents.get('matchingProfiles/self')?.movieIds).toEqual([2]);
  });

  it('waits for an already committing operation before committing the newer list', async () => {
    let commit!: () => void;
    vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
      await callback(state.transaction as unknown as Parameters<typeof callback>[0]);
      await new Promise<void>((resolve) => { commit = resolve; });
    });
    const older = synchronizeMatchingProfile('self', [1], () => true);
    await vi.waitFor(() => expect(commit).toBeTypeOf('function'));
    const newer = synchronizeMatchingProfile('self', [2], () => true);
    expect(runTransaction).toHaveBeenCalledOnce();
    commit();
    await Promise.all([older, newer]);
    expect(state.documents.get('matchingProfiles/self')?.movieIds).toEqual([2]);
  });

  it('prevents account-switch writes during transaction reads', async () => {
    state.transaction.get.mockImplementationOnce(async () => {
      state.auth.currentUser = { uid: 'other' };
      return { data: () => user };
    });
    await synchronizeMatchingProfile('self', [1], () => true);
    expect(state.transaction.set).not.toHaveBeenCalled();
  });

  it('revalidates eligibility on Firestore transaction retries after disabling', async () => {
    vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
      await callback(state.transaction as unknown as Parameters<typeof callback>[0]);
      state.transaction.set.mockClear();
      state.documents.set('users/self', { ...user, status: 'DISABLED' });
      return callback(state.transaction as unknown as Parameters<typeof callback>[0]);
    });
    await expect(synchronizeMatchingProfile('self', [1], () => true)).rejects.toThrow('active USER');
    expect(state.transaction.set).not.toHaveBeenCalled();
  });

  it('forwards failures and allows a successful retry', async () => {
    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('permission-denied'));
    await expect(synchronizeMatchingProfile('self', [], () => true)).rejects.toThrow('permission-denied');
    await synchronizeMatchingProfile('self', [], () => true);
    expect(state.transaction.set).toHaveBeenCalledOnce();
  });
});

describe('Live paginated matching profiles', () => {
  function listen() {
    const update = vi.fn();
    const error = vi.fn();
    const stop = subscribeMatchingProfiles('self', update, error, () => true);
    return { update, error, stop, profiles: () => update.mock.lastCall![0] as MatchingProfile[] };
  }

  function emit(index: number, entries: ReturnType<typeof entry>[], fromCache = false, hasPendingWrites = false) {
    const next = vi.mocked(onSnapshot).mock.calls[index][2] as unknown as (snapshot: QuerySnapshot) => void;
    next(page(entries, fromCache, hasPendingWrites));
  }

  const firstPage = () => Array.from({ length: 50 }, (_, i) => entry(`user-${String(i).padStart(3, '0')}`, data([99])));

  it('evaluates every page before publishing results, using bounded queries and stable cursors', () => {
    const listener = listen();
    const first = firstPage();
    emit(0, first);
    expect(listener.update).toHaveBeenLastCalledWith([], true);
    expect(startAfter).toHaveBeenCalledWith(first[49]);
    emit(1, [entry('winner')]);
    expect(listener.profiles()).toHaveLength(51);
    expect(findMatches('self', [1, 2, 3, 4], listener.profiles()).map((match) => match.id)).toEqual(['winner']);
    for (const [request, options] of vi.mocked(onSnapshot).mock.calls) {
      expect(request).toEqual(expect.objectContaining({ path: 'matchingProfiles', constraints: expect.arrayContaining([{ limit: 50 }, { orderBy: '__name__' }]) }));
      expect(options).toEqual({ includeMetadataChanges: true });
    }
    expect(state.transaction.get).not.toHaveBeenCalled();
    listener.stop();
  });

  it('keeps an empty final page live to discover profiles added after the first 50', () => {
    const listener = listen();
    emit(0, firstPage());
    emit(1, []);
    expect(listener.profiles()).toHaveLength(50);
    emit(1, [entry('winner')]);
    expect(listener.profiles()).toHaveLength(51);
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    listener.stop();
  });

  it('discovers newly published profiles without a refresh, updates their favorites and removes deleted profiles', () => {
    const listener = listen();
    emit(0, []);
    expect(listener.profiles()).toEqual([]);
    emit(0, [entry('other', data([1, 2, 3, 4, 5]))]);
    expect(findMatches('self', [1, 2, 3, 4], listener.profiles())[0].similarity).toBe(80);
    emit(0, [entry('other', data([1, 2, 3, 4]))]);
    expect(findMatches('self', [1, 2, 3, 4], listener.profiles())[0].similarity).toBe(100);
    emit(0, [entry('other', data([1, 2, 3]))]);
    expect(findMatches('self', [1, 2, 3, 4], listener.profiles())[0].similarity).toBe(75);
    emit(0, [entry('other', data([1, 2, 5]))]);
    expect(findMatches('self', [1, 2, 3, 4], listener.profiles())).toEqual([]);
    emit(0, []);
    expect(listener.profiles()).toEqual([]);
    expect(onSnapshot).toHaveBeenCalledOnce();
    listener.stop();
  });

  it('rebuilds subsequent pages when an insertion moves the first page boundary, ignoring old callbacks', () => {
    const listener = listen();
    const first = firstPage();
    const tail = [entry('user-050'), entry('winner')];
    emit(0, first);
    emit(1, tail);
    emit(0, [entry('new-user'), ...first.slice(0, 49)]);
    expect(stops[1]).toHaveBeenCalledOnce();
    expect(startAfter).toHaveBeenLastCalledWith(first[48]);
    const calls = listener.update.mock.calls.length;
    emit(1, [entry('obsolete')]);
    expect(listener.update).toHaveBeenCalledTimes(calls);
    emit(2, [first[49], ...tail]);
    expect(listener.profiles()).toHaveLength(53);
    expect(new Set(listener.profiles().map((p) => p.id)).size).toBe(53);
    expect(listener.profiles().map((p) => p.id)).toContain(first[49].id);
    listener.stop();
  });

  it('rebuilds the tail after deletion shifts a profile onto the preceding page', () => {
    const listener = listen();
    const first = firstPage();
    const next = entry('user-050');
    emit(0, first);
    emit(1, [next, entry('winner')]);
    emit(0, [...first.slice(1), next]);
    expect(startAfter).toHaveBeenLastCalledWith(next);
    emit(2, [entry('winner')]);
    const ids = listener.profiles().map((p) => p.id);
    expect(ids).toHaveLength(51);
    expect(ids).not.toContain(first[0].id);
    expect(ids.filter((id) => id === next.id)).toHaveLength(1);
    listener.stop();
  });

  it('updates an existing page without reopening unchanged cursors', () => {
    const listener = listen();
    const first = firstPage();
    emit(0, first);
    emit(1, [entry('winner')]);
    emit(0, [entry(first[0].id, data()), ...first.slice(1)]);
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(stops.every((stop) => stop.mock.calls.length === 0)).toBe(true);
    listener.stop();
  });

  it('unsubscribes obsolete pages when a page becomes the final page', () => {
    const listener = listen();
    const first = firstPage();
    emit(0, first);
    emit(1, [entry('winner')]);
    emit(0, first.slice(0, 49));
    expect(stops[1]).toHaveBeenCalledOnce();
    expect(listener.profiles()).toHaveLength(49);
    listener.stop();
  });

  it('excludes self and malformed, incomplete or legacy ineligible documents', () => {
    const listener = listen();
    emit(0, [
      entry('self'), entry('incomplete', { ...data(), firstName: '' }),
      entry('admin', { ...data(), role: 'ADMIN' }), entry('disabled', { ...data(), status: 'DISABLED' }),
      entry('valid', data([1, 1, 2])),
    ]);
    expect(listener.profiles().map((p) => p.id)).toEqual(['valid']);
    expect(listener.profiles()[0].movieIds).toEqual([1, 2]);
    listener.stop();
  });

  it('waits for server confirmation before completing an initially empty scan', () => {
    const listener = listen();
    emit(0, [], true);
    emit(0, [], false, true);
    expect(listener.update).toHaveBeenCalledOnce();
    expect(listener.update).toHaveBeenLastCalledWith([], true);
    emit(0, []);
    expect(listener.update).toHaveBeenLastCalledWith([], false);
    listener.stop();
  });

  it('stops all pages on an error and does not publish partial results', () => {
    const listener = listen();
    emit(0, firstPage());
    const fail = vi.mocked(onSnapshot).mock.calls[1][3] as unknown as (error: Error) => void;
    fail(new Error('unavailable'));
    expect(listener.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'unavailable' }));
    expect(stops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    emit(1, [entry('late')]);
    expect(listener.update).toHaveBeenLastCalledWith([], true);
  });

  it('ignores queued account-switch callbacks and unsubscribes on cleanup', () => {
    const listener = listen();
    state.auth.currentUser = { uid: 'other' };
    emit(0, firstPage());
    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(listener.update).toHaveBeenCalledOnce();
    listener.stop();
    expect(stops[0]).toHaveBeenCalledOnce();
    state.auth.currentUser = { uid: 'self' };
    emit(0, [entry('late')]);
    expect(listener.update).toHaveBeenCalledOnce();
  });
});
