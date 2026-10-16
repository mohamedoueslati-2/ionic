import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultIonLifeCycleContext, IonLifeCycleContext, setupIonicReact } from '@ionic/react';
import { auth } from '../config/firebase';
import { useFavorites } from '../hooks/useFavorites';
import type { FavoritesState } from '../hooks/useFavorites';
import { subscribeMatchingProfiles } from '../services/matching';
import type { MatchingProfile } from '../services/matching';
import Matching from './Matching';

vi.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'self' } }, db: {} }));
vi.mock('../hooks/useFavorites', () => ({ useFavorites: vi.fn() }));
vi.mock('../services/matching', async (original) => ({ ...await original<typeof import('../services/matching')>(), subscribeMatchingProfiles: vi.fn() }));

let favorites: FavoritesState;
let profiles: MatchingProfile[];
let initialError: Error | undefined;
let autoEmit: boolean;
let listeners: {
  next: (profiles: MatchingProfile[], loading: boolean) => void;
  fail: (error: Error) => void;
  active: () => boolean;
  stop: ReturnType<typeof vi.fn>;
}[];
const movies = (ids: number[]) => ids.map((movieId) => ({ movieId, title: 'Movie', posterPath: null, releaseDate: '', addedAt: null }));
const profile = (id: string, ids: number[], photoURL = '') => ({
  id, firstName: id, lastName: 'Movie Fan', email: `${id}@example.com`, photoURL, movieIds: ids,
}) as MatchingProfile;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setupIonicReact({ animated: false });
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(auth, { currentUser: { uid: 'self' } });
  favorites = {
    enabled: true, favorites: movies([1, 2, 3, 4]), loading: false, ready: true, error: '', pendingIds: new Set(),
    unavailable: false, retry: vi.fn(), toggleFavorite: vi.fn(), removeFavorite: vi.fn(),
  };
  vi.mocked(useFavorites).mockImplementation(() => favorites);
  profiles = [];
  initialError = undefined;
  autoEmit = true;
  listeners = [];
  vi.mocked(subscribeMatchingProfiles).mockImplementation((_uid, next, fail, active) => {
    const stop = vi.fn();
    listeners.push({ next, fail, active, stop });
    const initialProfiles = profiles;
    const error = initialError;
    if (autoEmit) void Promise.resolve().then(() => {
      if (!active()) return;
      if (error) fail(error);
      else next(initialProfiles, false);
    });
    return stop;
  });
});
afterEach(cleanup);
const emit = async (profiles: MatchingProfile[], index = listeners.length - 1, loading = false) => act(async () => listeners[index].next(profiles, loading));

describe('Matching page', () => {
  it('renders scores of 75% or more in descending order, with identity and common counts', async () => {
    profiles = [
      profile('self', [1, 2, 3, 4]), profile('Second', [1, 2, 3, 4, 5]),
      profile('Exactly75', [1, 2, 3]), profile('Below75', [1, 2, 5]), profile('First', [1, 2, 3, 4]),
    ];
    const view = render(<Matching uid="self" />);
    await view.findByText('3 matches found');
    expect(Array.from(view.container.querySelectorAll('ion-card-title')).map((title) => title.textContent)).toEqual(['First Movie Fan', 'Second Movie Fan', 'Exactly75 Movie Fan']);
    expect(view.queryByText('First@example.com')).toBeNull();
    expect(view.getByText('100% match')).toBeTruthy();
    expect(view.getByText('80% match')).toBeTruthy();
    expect(view.getAllByText('4 favorite movies in common')).toHaveLength(2);
    expect(view.getByText('75% match')).toBeTruthy();
    expect(view.getByText('3 favorite movies in common')).toBeTruthy();
    expect(view.queryByText('Below75 Movie Fan')).toBeNull();
    expect(view.queryByText('self Movie Fan')).toBeNull();
  });

  it('uses Cloudinary photos and falls back to initials for missing or broken photos', async () => {
    const photo = 'https://res.cloudinary.com/example/image/upload/photo.jpg';
    profiles = [profile('Photo', [1, 2, 3, 4], photo), profile('Fallback', [1, 2, 3, 4])];
    const view = render(<Matching uid="self" />);
    const image = await view.findByAltText('Photo Movie Fan');
    expect(image.getAttribute('src')).toBe(photo);
    expect(view.getByLabelText('Avatar for Fallback Movie Fan').textContent).toBe('FM');
    fireEvent.error(image);
    expect(view.getByLabelText('Avatar for Photo Movie Fan').textContent).toBe('PM');
  });

  it('shows loading until all profile pages finish', async () => {
    autoEmit = false;
    const view = render(<Matching uid="self" />);
    await waitFor(() => expect(listeners).toHaveLength(1));
    expect(view.getByLabelText('Loading matches')).toBeTruthy();
    expect(view.queryByText(/No matches at/)).toBeNull();
    await emit([], 0, true);
    expect(view.queryByText(/No matches at/)).toBeNull();
    await emit([]);
    expect(view.getByText(/No matches at 75% or more yet/)).toBeTruthy();
  });

  it('does not query profiles before favorites load or when favorites are legitimately empty', async () => {
    favorites.loading = true;
    favorites.ready = false;
    favorites.favorites = [];
    const view = render(<Matching uid="self" />);
    expect(view.getByLabelText('Loading matches')).toBeTruthy();
    expect(subscribeMatchingProfiles).not.toHaveBeenCalled();
    favorites.loading = false;
    favorites.ready = true;
    view.rerender(<Matching uid="self" />);
    expect(view.getByText(/Matching starts with 3 favorite movies\. Add 3 more movies/)).toBeTruthy();
    expect(subscribeMatchingProfiles).not.toHaveBeenCalled();
  });

  it.each([
    { ids: [1], message: 'Add 2 more movies' },
    { ids: [1, 2], message: 'Add 1 more movie' },
    { ids: [1, 1, 2], message: 'Add 1 more movie' },
  ])('waits for three unique favorites and shows the remaining count: $ids', async ({ ids, message }) => {
    favorites.favorites = movies(ids);
    const view = render(<Matching uid="self" />);
    expect(view.getByText((text) => text.includes(message))).toBeTruthy();
    expect(subscribeMatchingProfiles).not.toHaveBeenCalled();
    expect(view.queryByText(/No matches at/)).toBeNull();
  });

  it('loads matches when the third favorite is added and hides them after dropping below three', async () => {
    favorites.favorites = movies([1, 2]);
    profiles = [profile('Other', [1, 2, 3])];
    const view = render(<Matching uid="self" />);
    expect(subscribeMatchingProfiles).not.toHaveBeenCalled();
    favorites.favorites = movies([1, 2, 3]);
    view.rerender(<Matching uid="self" />);
    await view.findByText('Other Movie Fan');
    expect(view.getByText('3 favorite movies in common')).toBeTruthy();
    expect(subscribeMatchingProfiles).toHaveBeenCalledOnce();
    favorites.favorites = movies([1, 2]);
    view.rerender(<Matching uid="self" />);
    expect(view.queryByText('Other Movie Fan')).toBeNull();
    expect(view.getByText(/Add 1 more movie/)).toBeTruthy();
    expect(subscribeMatchingProfiles).toHaveBeenCalledOnce();
    expect(listeners[0].stop).toHaveBeenCalledOnce();
  });

  it('displays query failures and retries the complete scan on refresh', async () => {
    initialError = new Error('unavailable');
    const view = render(<Matching uid="self" />);
    expect((await view.findByRole('alert')).textContent).toContain('unavailable');
    initialError = undefined;
    profiles = [profile('Recovered', [1, 2, 3, 4])];
    fireEvent.click(view.getByText('Retry matches'));
    await view.findByText('Recovered Movie Fan');
    expect(view.queryByRole('alert')).toBeNull();
    expect(subscribeMatchingProfiles).toHaveBeenCalledTimes(2);
    expect(listeners[0].stop).toHaveBeenCalledOnce();
  });

  it('retries a failed favorites subscription and avoids reading matching profiles', async () => {
    favorites.error = 'Unable to load Favorites. permission-denied';
    favorites.ready = false;
    const view = render(<Matching uid="self" />);
    expect(view.getByRole('alert').textContent).toContain('permission-denied');
    fireEvent.click(view.getByText('Retry matches'));
    expect(favorites.retry).toHaveBeenCalledOnce();
    expect(subscribeMatchingProfiles).not.toHaveBeenCalled();
  });

  it('recalculates for favorite changes without rereading other profiles', async () => {
    profiles = [profile('Other', [1, 2, 3, 4])];
    const view = render(<Matching uid="self" />);
    await view.findByText('Other Movie Fan');
    favorites.favorites = movies([1, 2, 3]);
    view.rerender(<Matching uid="self" />);
    expect(view.getByText('Other Movie Fan')).toBeTruthy();
    expect(view.getByText('75% match')).toBeTruthy();
    favorites.favorites = movies([1, 2, 5]);
    view.rerender(<Matching uid="self" />);
    expect(view.queryByText('Other Movie Fan')).toBeNull();
    expect(view.getByText(/No matches at 75% or more yet/)).toBeTruthy();
    expect(subscribeMatchingProfiles).toHaveBeenCalledOnce();
    fireEvent.click(view.getByText('Refresh matches'));
    await waitFor(() => expect(subscribeMatchingProfiles).toHaveBeenCalledTimes(2));
  });

  it('ignores late results from the previous account', async () => {
    autoEmit = false;
    const view = render(<Matching uid="self" />);
    await waitFor(() => expect(listeners).toHaveLength(1));
    const oldActive = listeners[0].active;
    profiles = [profile('NewAccountMatch', [1, 2, 3, 4])];
    autoEmit = true;
    Object.assign(auth, { currentUser: { uid: 'new' } });
    view.rerender(<Matching uid="new" />);
    await view.findByText('NewAccountMatch Movie Fan');
    expect(oldActive()).toBe(false);
    expect(listeners[0].stop).toHaveBeenCalledOnce();
    await emit([profile('OldAccountMatch', [1, 2, 3, 4])], 0);
    expect(view.queryByText('OldAccountMatch Movie Fan')).toBeNull();
  });

  it('never queries for ineligible accounts', async () => {
    favorites.enabled = false;
    const view = render(<Matching uid="self" />);
    expect(view.getByText(/Matching requires an active USER/)).toBeTruthy();
    expect(subscribeMatchingProfiles).not.toHaveBeenCalled();
  });

  it('avoids a duplicate initial scan under StrictMode', async () => {
    const view = render(<StrictMode><Matching uid="self" /></StrictMode>);
    await view.findByText(/No matches at 75% or more yet/);
    expect(subscribeMatchingProfiles).toHaveBeenCalledOnce();
  });

  it('automatically discovers a late matching profile and updates its score without refresh', async () => {
    const view = render(<Matching uid="self" />);
    await view.findByText(/No matches at 75% or more yet/);
    await emit([profile('Other', [1, 2, 3, 4, 5])]);
    expect(view.getByText('Other Movie Fan')).toBeTruthy();
    expect(view.getByText('80% match')).toBeTruthy();
    await emit([profile('Other', [1, 2, 3, 4])]);
    expect(view.getByText('100% match')).toBeTruthy();
    await emit([profile('Other', [1, 2, 3])]);
    expect(view.getByText('75% match')).toBeTruthy();
    await emit([profile('Other', [1, 2, 5])]);
    expect(view.queryByText('Other Movie Fan')).toBeNull();
    expect(view.getByText(/No matches at 75% or more yet/)).toBeTruthy();
    expect(subscribeMatchingProfiles).toHaveBeenCalledOnce();
  });

  it('removes a deleted or disabled matching profile immediately', async () => {
    profiles = [profile('Other', [1, 2, 3, 4])];
    const view = render(<Matching uid="self" />);
    await view.findByText('Other Movie Fan');
    await emit([]);
    expect(view.queryByText('Other Movie Fan')).toBeNull();
    expect(view.getByText(/No matches at 75% or more yet/)).toBeTruthy();
  });

  it('stops live reads when leaving a cached Ionic page and reconnects on reentry', async () => {
    const lifecycle = new DefaultIonLifeCycleContext();
    const view = render(<IonLifeCycleContext.Provider value={lifecycle}><Matching uid="self" /></IonLifeCycleContext.Provider>);
    await view.findByText(/No matches at 75% or more yet/);
    act(() => lifecycle.ionViewWillLeave());
    expect(listeners[0].stop).toHaveBeenCalledOnce();
    expect(listeners[0].active()).toBe(false);
    profiles = [profile('Latest', [1, 2, 3, 4])];
    act(() => lifecycle.ionViewWillEnter());
    await view.findByText('Latest Movie Fan');
    expect(subscribeMatchingProfiles).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(listeners[1].stop).toHaveBeenCalledOnce();
  });
});
