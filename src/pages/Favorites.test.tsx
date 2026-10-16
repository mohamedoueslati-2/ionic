import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupIonicReact } from '@ionic/react';
import FavoritesProvider from '../components/FavoritesProvider';
import { auth } from '../config/firebase';
import { addFavorite, removeFavorite, subscribeFavorites } from '../services/favorites';
import type { FavoriteMovie } from '../services/favorites';
import { getGenres, getMovies } from '../services/tmdb';
import Home from './Home';
import Favorites from './Favorites';

vi.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'user-1' } } }));
vi.mock('../services/favorites', () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn(), subscribeFavorites: vi.fn() }));
vi.mock('../services/tmdb', async (original) => ({ ...await original<typeof import('../services/tmdb')>(), getGenres: vi.fn(), getMovies: vi.fn() }));

const favorite: FavoriteMovie = { movieId: 42, title: 'Saved Movie', posterPath: '/saved.jpg', releaseDate: '2026-10-01', addedAt: null };
let listeners: { next: (movies: FavoriteMovie[]) => void; fail: (error: Error) => void; stop: ReturnType<typeof vi.fn> }[];
const emit = async (movies: FavoriteMovie[], index = listeners.length - 1) => {
  await act(async () => listeners[index].next(movies));
};
const mount = (withHome = false) => render(
  <FavoritesProvider uid="user-1" enabled>
    {withHome && <section aria-label="Discovery"><Home /></section>}
    <section aria-label="Playlist"><Favorites /></section>
  </FavoritesProvider>,
);

// Ionic forwards ARIA attributes to the focusable native button in its shadow DOM.
function getFavoriteButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('ion-button.movie-favorite-button'))
    .map((host) => host.shadowRoot?.querySelector('button'))
    .find((native) => native?.getAttribute('aria-label') === label);
  if (!button) throw new Error(`Favorite button not found: ${label}`);
  return button;
}
const findFavoriteButton = (container: HTMLElement, label: string) => waitFor(() => getFavoriteButton(container, label));

beforeAll(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setupIonicReact({ animated: false });
});

beforeEach(() => {
  vi.clearAllMocks();
  // Only the UID is used by the provider; Firebase itself is replaced at this boundary.
  Object.assign(auth, { currentUser: { uid: 'user-1' } });
  listeners = [];
  vi.mocked(subscribeFavorites).mockImplementation((next, fail) => {
    const stop = vi.fn();
    listeners.push({ next, fail, stop });
    return stop;
  });
  vi.mocked(addFavorite).mockResolvedValue(undefined);
  vi.mocked(removeFavorite).mockResolvedValue(undefined);
  vi.mocked(getGenres).mockResolvedValue([{ id: 28, name: 'Action' }]);
  vi.mocked(getMovies).mockResolvedValue({ page: 1, total_pages: 3, total_results: 3, results: [
    { id: 42, title: 'Saved Movie', poster_path: '/saved.jpg', release_date: '2026-10-01', overview: '', vote_average: 7 },
  ] });
});
afterEach(cleanup);

describe('Favorites playlist', () => {
  it('shows loading until the first snapshot, then the required empty message', async () => {
    const view = mount();
    expect(view.getByLabelText('Loading Favorites')).toBeTruthy();
    expect(view.queryByText('No favorite movies yet.')).toBeNull();
    await emit([]);
    expect(view.queryByLabelText('Loading Favorites')).toBeNull();
    expect(view.getByText('No favorite movies yet.')).toBeTruthy();
  });

  it('renders saved titles, posters, years, and missing poster/date fallbacks without TMDB requests', async () => {
    const view = mount();
    await emit([favorite, { ...favorite, movieId: 43, title: 'No Poster', posterPath: null, releaseDate: '' }]);
    expect(view.getByText('Saved Movie')).toBeTruthy();
    expect(view.getByAltText('Saved Movie').getAttribute('src')).toBe('https://image.tmdb.org/t/p/w342/saved.jpg');
    expect(view.getByText('2026')).toBeTruthy();
    expect(view.getByText('No poster available')).toBeTruthy();
    expect(view.getByText('Release date unavailable')).toBeTruthy();
    expect(getMovies).not.toHaveBeenCalled();
    expect(getGenres).not.toHaveBeenCalled();
  });

  it('prevents concurrent removals and reflects the empty snapshot immediately', async () => {
    let finish!: () => void;
    vi.mocked(removeFavorite).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const view = mount();
    await emit([favorite]);
    const button = await findFavoriteButton(view.container, 'Remove Saved Movie from Favorites');
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    expect(removeFavorite).toHaveBeenCalledExactlyOnceWith(42);
    await waitFor(() => expect(button.disabled).toBe(true));
    await emit([]);
    expect(view.queryByText('Saved Movie')).toBeNull();
    expect(view.getByText('No favorite movies yet.')).toBeTruthy();
    await act(async () => finish());
  });

  it('keeps the saved movie on removal failure and allows another attempt', async () => {
    vi.mocked(removeFavorite).mockRejectedValueOnce(new Error('Network unavailable'));
    const view = mount();
    await emit([favorite]);
    fireEvent.click(await findFavoriteButton(view.container, 'Remove Saved Movie from Favorites'));
    expect(await view.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Network unavailable'));
    expect(view.getByText('Saved Movie')).toBeTruthy();
    fireEvent.click(await findFavoriteButton(view.container, 'Remove Saved Movie from Favorites'));
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledTimes(2));
    expect(view.queryByRole('alert')).toBeNull();
  });

  it('clears inaccessible data on listener failure and can retry the subscription', async () => {
    const view = mount();
    await emit([favorite]);
    await act(async () => listeners[0].fail(new Error('permission-denied')));
    expect(view.getByRole('alert').textContent).toContain('permission-denied');
    expect(view.queryByText('Saved Movie')).toBeNull();
    expect(view.queryByText('No favorite movies yet.')).toBeNull();
    fireEvent.click(view.getByText('Retry Favorites'));
    await waitFor(() => expect(listeners).toHaveLength(2));
    expect(listeners[0].stop).toHaveBeenCalledOnce();
    expect(view.getByLabelText('Loading Favorites')).toBeTruthy();
    await emit([]);
    expect(view.queryByRole('alert')).toBeNull();
    expect(view.getByText('No favorite movies yet.')).toBeTruthy();
  });

  it('shares real-time additions/removals with Home through one listener', async () => {
    const view = mount(true);
    const homeRegion = view.getByRole('region', { name: 'Discovery' });
    const playlistRegion = view.getByRole('region', { name: 'Playlist' });
    const home = within(homeRegion);
    const playlist = within(playlistRegion);
    await home.findByText('Saved Movie');
    await emit([]);
    const add = await findFavoriteButton(homeRegion, 'Add Saved Movie to Favorites');
    expect(add.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(add);
    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 42 })));
    await emit([favorite]);
    await waitFor(() => expect(getFavoriteButton(homeRegion, 'Remove Saved Movie from Favorites').getAttribute('aria-pressed')).toBe('true'));
    expect(playlist.getByText('Saved Movie')).toBeTruthy();
    fireEvent.click(await findFavoriteButton(playlistRegion, 'Remove Saved Movie from Favorites'));
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith(42));
    await emit([]);
    await waitFor(() => expect(getFavoriteButton(homeRegion, 'Add Saved Movie to Favorites').getAttribute('aria-pressed')).toBe('false'));
    expect(playlist.getByText('No favorite movies yet.')).toBeTruthy();
    expect(subscribeFavorites).toHaveBeenCalledOnce();
  });

  it('prevents concurrent adds and displays add errors without filling the heart', async () => {
    let fail!: (error: Error) => void;
    vi.mocked(addFavorite).mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
    const view = mount(true);
    await view.findByText('Saved Movie');
    await emit([]);
    const button = await findFavoriteButton(view.container, 'Add Saved Movie to Favorites');
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    expect(addFavorite).toHaveBeenCalledOnce();
    await waitFor(() => expect(button.disabled).toBe(true));
    await act(async () => fail(new Error('Save failed')));
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(view.getAllByRole('alert')[0].textContent).toContain('Save failed');
  });

  it('retains favorite hearts while changing category, genre, search, and loading another page', async () => {
    const view = mount(true);
    const homeRegion = view.getByRole('region', { name: 'Discovery' });
    const home = within(homeRegion);
    await home.findByText('Saved Movie');
    await emit([favorite]);
    const segment = view.container.querySelector('ion-segment')!;
    await waitFor(() => expect(segment.classList.contains('hydrated')).toBe(true));
    for (const value of ['now_playing', 'upcoming', 'top_rated', 'trending_day', 'trending_week', 'popular']) {
      await act(async () => fireEvent(segment, new CustomEvent('ionChange', { detail: { value } })));
      await waitFor(() => expect(getMovies).toHaveBeenLastCalledWith(1, '', null, expect.any(AbortSignal), value));
      expect(await findFavoriteButton(homeRegion, 'Remove Saved Movie from Favorites')).toBeTruthy();
    }
    const select = view.container.querySelector('ion-select')!;
    await act(async () => fireEvent(select, new CustomEvent('ionChange', { detail: { value: 28 } })));
    await waitFor(() => expect(getMovies).toHaveBeenLastCalledWith(1, '', 28, expect.any(AbortSignal), 'popular'));
    const search = view.container.querySelector('ion-searchbar')!;
    await act(async () => fireEvent(search, new CustomEvent('ionInput', { detail: { value: 'Saved' } })));
    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() => expect(getMovies).toHaveBeenLastCalledWith(1, 'Saved', null, expect.any(AbortSignal), 'popular'));
    expect(await findFavoriteButton(homeRegion, 'Remove Saved Movie from Favorites')).toBeTruthy();
    const infinite = view.container.querySelector('ion-infinite-scroll')!;
    Object.defineProperty(infinite, 'complete', { value: vi.fn().mockResolvedValue(undefined) });
    await act(async () => fireEvent(infinite, new CustomEvent('ionInfinite')));
    await waitFor(() => expect(getMovies).toHaveBeenLastCalledWith(2, 'Saved', null, expect.any(AbortSignal), 'popular'));
    expect(await findFavoriteButton(homeRegion, 'Remove Saved Movie from Favorites')).toBeTruthy();
    expect(subscribeFavorites).toHaveBeenCalledOnce();
  });

  it('cleans up on unmount and ignores an old account snapshot after changing accounts', async () => {
    const view = mount();
    await emit([favorite]);
    Object.assign(auth, { currentUser: { uid: 'user-2' } });
    view.rerender(<FavoritesProvider key="user-2" uid="user-2" enabled><Favorites /></FavoritesProvider>);
    expect(listeners[0].stop).toHaveBeenCalledOnce();
    expect(view.queryByText('Saved Movie')).toBeNull();
    await emit([favorite], 0);
    expect(view.queryByText('Saved Movie')).toBeNull();
    await emit([]);
    expect(view.getByText('No favorite movies yet.')).toBeTruthy();
    view.unmount();
    expect(listeners[1].stop).toHaveBeenCalledOnce();
  });

  it('does not subscribe or show Home heart controls when Favorites are disabled', async () => {
    const view = render(<FavoritesProvider uid="user-1" enabled={false}><Home /></FavoritesProvider>);
    await view.findByText('Saved Movie');
    expect(subscribeFavorites).not.toHaveBeenCalled();
    expect(view.container.querySelector('ion-button.movie-favorite-button')).toBeNull();
  });
});
