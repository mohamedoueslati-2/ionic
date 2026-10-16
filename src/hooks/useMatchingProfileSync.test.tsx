import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FavoritesProvider from '../components/FavoritesProvider';
import { auth } from '../config/firebase';
import { subscribeFavorites } from '../services/favorites';
import type { FavoriteMovie } from '../services/favorites';
import { synchronizeMatchingProfile } from '../services/matching';
import type { UserProfile } from '../types/auth';
import { useFavorites } from './useFavorites';
import { useMatchingProfileSync } from './useMatchingProfileSync';

vi.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'a' } }, db: {} }));
vi.mock('../services/favorites', () => ({ subscribeFavorites: vi.fn() }));
vi.mock('../services/matching', async (original) => ({
  ...await original<typeof import('../services/matching')>(), synchronizeMatchingProfile: vi.fn(),
}));

const profile: UserProfile = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'USER', status: 'ACTIVE', profileCompleted: true };
let listeners: { next: (movies: FavoriteMovie[], ready?: boolean) => void; fail: (error: Error) => void; stop: ReturnType<typeof vi.fn> }[];
const movies = (ids: number[]) => ids.map((movieId) => ({ movieId, title: 'Movie', posterPath: null, releaseDate: '', addedAt: null }));
const emit = async (ids: number[], ready = true, index = listeners.length - 1) => act(async () => listeners[index].next(movies(ids), ready));

function Sync({ uid, details }: { uid: string; details: UserProfile }) {
  const { error, retry } = useMatchingProfileSync(uid, details);
  const favorites = useFavorites();
  return <>
    {error && <p role="alert">{error}</p>}
    {favorites.error && <p role="alert">{favorites.error}</p>}
    <span data-testid="ready">{String(favorites.ready)}</span>
    <button onClick={retry}>Retry sync</button>
    <button onClick={favorites.retry}>Retry favorites</button>
  </>;
}

function App({ uid = 'a', details = profile }: { uid?: string; details?: UserProfile }) {
  const enabled = details.role === 'USER' && details.status === 'ACTIVE' && details.profileCompleted === true;
  return <FavoritesProvider uid={uid} enabled={enabled}><Sync uid={uid} details={details} /></FavoritesProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(auth, { currentUser: { uid: 'a' } });
  listeners = [];
  vi.mocked(subscribeFavorites).mockImplementation((next, fail) => {
    const stop = vi.fn();
    listeners.push({ next, fail, stop });
    return stop;
  });
  vi.mocked(synchronizeMatchingProfile).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Automatic matching synchronization lifecycle', () => {
  it('waits for loaded favorites and never publishes a temporary empty cache snapshot', async () => {
    render(<App />);
    expect(synchronizeMatchingProfile).not.toHaveBeenCalled();
    await emit([], false);
    expect(synchronizeMatchingProfile).not.toHaveBeenCalled();
    await emit([3, 1, 1]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledWith('a', [1, 3], expect.any(Function));
  });

  it('publishes genuinely empty favorites after server confirmation', async () => {
    render(<App />);
    await emit([]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledWith('a', [], expect.any(Function));
  });

  it('reacts to additions and removals, but ignores reorderings and unrelated favorite fields', async () => {
    render(<App />);
    await emit([1, 2]);
    await emit([2, 1, 1]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
    await emit([1, 2, 3], false);
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
    await emit([1, 2, 3]);
    await emit([3]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledTimes(3);
    expect(synchronizeMatchingProfile).toHaveBeenLastCalledWith('a', [3], expect.any(Function));
  });

  it('synchronizes name, email and photo edits, ignoring unrelated profile changes', async () => {
    const view = render(<App />);
    await emit([1]);
    view.rerender(<App details={{ ...profile, age: 30 }} />);
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
    view.rerender(<App details={{ ...profile, firstName: 'Updated' }} />);
    view.rerender(<App details={{ ...profile, lastName: 'Updated' }} />);
    view.rerender(<App details={{ ...profile, email: 'updated@example.com' }} />);
    view.rerender(<App details={{ ...profile, photoURL: 'https://res.cloudinary.com/example/photo.jpg' }} />);
    expect(synchronizeMatchingProfile).toHaveBeenCalledTimes(5);
  });

  it.each([{ role: 'ADMIN' }, { status: 'DISABLED' }, { profileCompleted: false }])('does not publish ineligible accounts and publishes after reactivation/completion: %j', async (override) => {
    const view = render(<App details={{ ...profile, ...override }} />);
    expect(subscribeFavorites).not.toHaveBeenCalled();
    expect(synchronizeMatchingProfile).not.toHaveBeenCalled();
    view.rerender(<App />);
    expect(synchronizeMatchingProfile).not.toHaveBeenCalled();
    await emit([1]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
  });

  it('invalidates an older list as soon as new favorites arrive', async () => {
    render(<App />);
    await emit([1]);
    const oldActive = vi.mocked(synchronizeMatchingProfile).mock.calls[0][2];
    expect(oldActive()).toBe(true);
    await emit([2]);
    expect(oldActive()).toBe(false);
    expect(vi.mocked(synchronizeMatchingProfile).mock.calls[1][2]()).toBe(true);
  });

  it('waits for the new account snapshot and ignores late old-account callbacks without requiring a React key', async () => {
    const view = render(<App />);
    await emit([1]);
    const oldActive = vi.mocked(synchronizeMatchingProfile).mock.calls[0][2];
    Object.assign(auth, { currentUser: { uid: 'b' } });
    view.rerender(<App uid="b" />);
    expect(oldActive()).toBe(false);
    expect(listeners[0].stop).toHaveBeenCalledOnce();
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
    await emit([99], true, 0);
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
    await emit([2]);
    expect(synchronizeMatchingProfile).toHaveBeenLastCalledWith('b', [2], expect.any(Function));
  });

  it('invalidates pending work on logout and unmount', async () => {
    const view = render(<App />);
    await emit([1]);
    const active = vi.mocked(synchronizeMatchingProfile).mock.calls[0][2];
    Object.assign(auth, { currentUser: null });
    expect(active()).toBe(false);
    view.unmount();
    Object.assign(auth, { currentUser: { uid: 'a' } });
    expect(active()).toBe(false);
  });

  it('surfaces synchronization failure and retries without a manual participation control', async () => {
    vi.mocked(synchronizeMatchingProfile).mockRejectedValueOnce(new Error('permission-denied'));
    const view = render(<App />);
    await emit([1]);
    expect((await view.findByRole('alert')).textContent).toContain('permission-denied');
    fireEvent.click(view.getByText('Retry sync'));
    await waitFor(() => expect(synchronizeMatchingProfile).toHaveBeenCalledTimes(2));
    expect(view.queryByRole('alert')).toBeNull();
  });

  it('blocks publication on favorites failure and recovers after resubscribing', async () => {
    const view = render(<App />);
    await act(async () => listeners[0].fail(new Error('unavailable')));
    expect(view.getByRole('alert').textContent).toContain('unavailable');
    expect(synchronizeMatchingProfile).not.toHaveBeenCalled();
    fireEvent.click(view.getByText('Retry favorites'));
    await emit([2]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledWith('a', [2], expect.any(Function));
  });

  it('does not resurrect an old error when favorite IDs return to a previously failed list', async () => {
    vi.mocked(synchronizeMatchingProfile).mockRejectedValueOnce(new Error('Old failure'));
    const view = render(<App />);
    await emit([1]);
    await view.findByRole('alert');
    await emit([2]);
    expect(view.queryByRole('alert')).toBeNull();
    await emit([1]);
    expect(view.queryByRole('alert')).toBeNull();
  });

  it('handles StrictMode listener replay without publishing a temporary empty list', async () => {
    render(<StrictMode><App /></StrictMode>);
    expect(listeners).toHaveLength(2);
    expect(listeners[0].stop).toHaveBeenCalledOnce();
    await emit([], true, 0);
    expect(synchronizeMatchingProfile).not.toHaveBeenCalled();
    await emit([1]);
    expect(synchronizeMatchingProfile).toHaveBeenCalledOnce();
  });
});
