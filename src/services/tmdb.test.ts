import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGenres, getMovies, MOVIE_COLLECTIONS } from './tmdb';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('VITE_TMDB_READ_TOKEN', 'test-token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ page: 2, results: [], total_pages: 9, genres: [{ id: 28, name: 'Action' }] }) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('TMDB discovery', () => {
  it.each(MOVIE_COLLECTIONS)('loads $id with the requested page', async ({ id }) => {
    const data = await getMovies(2, '', null, undefined, id);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe(id.startsWith('trending_') ? `/3/trending/movie/${id === 'trending_day' ? 'day' : 'week'}` : `/3/movie/${id}`);
    expect(url.searchParams.get('page')).toBe('2');
    expect(data.total_pages).toBe(id.startsWith('trending_') ? 1 : 9);
  });
  it('uses title search independently of collection and genre', async () => {
    await getMovies(1, ' Batman ', 28, undefined, 'upcoming');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/3/search/movie');
    expect(url.searchParams.get('query')).toBe('Batman');
    expect(url.searchParams.has('with_genres')).toBe(false);
  });
  it('uses discovery for genre and forwards cancellation', async () => {
    const controller = new AbortController();
    await getMovies(3, '', 28, controller.signal);
    const [address, options] = fetchMock.mock.calls[0];
    const url = new URL(address);
    expect(url.pathname).toBe('/3/discover/movie');
    expect(url.searchParams.get('with_genres')).toBe('28');
    expect(options.signal).toBe(controller.signal);
  });
  it('loads genres', async () => { expect(await getGenres()).toEqual([{ id: 28, name: 'Action' }]); });
  it('reports missing credentials without a request', async () => {
    vi.stubEnv('VITE_TMDB_READ_TOKEN', '');
    await expect(getMovies()).rejects.toThrow('Missing TMDB token');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('reports rejected requests', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(getMovies()).rejects.toThrow('TMDB error: 401');
  });
});
