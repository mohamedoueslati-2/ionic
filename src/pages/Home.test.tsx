import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupIonicReact } from '@ionic/react';
import Home from './Home';
import { getGenres, getMovies } from '../services/tmdb';
import type { Movie, MoviePage } from '../services/tmdb';
import FavoritesProvider from '../components/FavoritesProvider';
import { subscribeFavorites } from '../services/favorites';

vi.mock('../services/favorites', () => ({ subscribeFavorites: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn() }));
vi.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'user-1' } } }));
const mountHome = () => render(<FavoritesProvider uid="user-1" enabled><Home /></FavoritesProvider>);

vi.mock('../services/tmdb', async (original) => ({ ...await original<typeof import('../services/tmdb')>(), getGenres: vi.fn(), getMovies: vi.fn() }));
const movie = (id: number): Movie => ({ id, title: `Movie ${id}`, overview: '', poster_path: null, release_date: '2026-01-01', vote_average: 7 });
const page = (number: number, ids: number[]): MoviePage => ({ page: number, results: ids.map(movie), total_pages: 3, total_results: 6 });
beforeAll(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setupIonicReact({ animated: false });
});
beforeEach(() => {
  vi.mocked(subscribeFavorites).mockImplementation((callback) => { callback([]); return vi.fn(); });
  vi.mocked(getGenres).mockResolvedValue([{ id: 28, name: 'Action' }]);
  vi.mocked(getMovies).mockReset().mockResolvedValue(page(1, [1, 2]));
});
afterEach(cleanup);

describe('Home movie loading', () => {
  it('appends the next page without duplicate movies and completes scrolling', async () => {
    const view = mountHome();
    await view.findByText('Movie 1');
    vi.mocked(getMovies).mockResolvedValueOnce(page(2, [2, 3]));
    const infinite = view.container.querySelector('ion-infinite-scroll')!;
    await waitFor(() => expect(infinite.classList.contains('hydrated')).toBe(true));
    const complete = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(infinite, 'complete', { value: complete });
    await act(async () => { fireEvent(infinite, new CustomEvent('ionInfinite')); });
    await view.findByText('Movie 3');
    expect(view.getAllByText('Movie 2')).toHaveLength(1);
    expect(view.getByText('Movie 1')).toBeTruthy();
    expect(getMovies).toHaveBeenLastCalledWith(2, '', null, expect.any(AbortSignal), 'popular');
    expect(complete).toHaveBeenCalled();
  });
  it('resets to page one and discards an old request when selecting a genre', async () => {
    let finishOld!: (value: MoviePage) => void;
    vi.mocked(getMovies).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const view = mountHome();
    await view.findByText('Action');
    const oldSignal = vi.mocked(getMovies).mock.calls[0][3]!;
    const select = view.container.querySelector('ion-select')!;
    await waitFor(() => expect(select.classList.contains('hydrated')).toBe(true));
    await act(async () => { fireEvent(select, new CustomEvent('ionChange', { detail: { value: 28 } })); });
    await waitFor(() => expect(getMovies).toHaveBeenLastCalledWith(1, '', 28, expect.any(AbortSignal), 'popular'));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { finishOld(page(1, [99])); });
    expect(view.queryByText('Movie 99')).toBeNull();
    expect(await view.findByText('Movie 1')).toBeTruthy();
  });
});
