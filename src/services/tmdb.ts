const API_URL = "https://api.themoviedb.org/3";

export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MoviePage {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

async function tmdbFetch<T>(
  endpoint: string,
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<T> {
  const token = import.meta.env.VITE_TMDB_READ_TOKEN;

  if (!token) {
    throw new Error("Missing TMDB token");
  }

  const response = await fetch(
    `${API_URL}${endpoint}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json"
      },
      signal
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Recuperer toutes les categories de films
export async function getGenres(
  signal?: AbortSignal
): Promise<Genre[]> {
  const data = await tmdbFetch<{ genres: Genre[] }>(
    "/genre/movie/list",
    new URLSearchParams({ language: "en-US" }),
    signal
  );

  return data.genres;
}

export function getPosterUrl(
  path: string | null
): string | null {
  return path
    ? `https://image.tmdb.org/t/p/w342${path}`
    : null;
}

export type MovieCollection =
  | "popular"
  | "now_playing"
  | "upcoming"
  | "top_rated"
  | "trending_day"
  | "trending_week";

export const MOVIE_COLLECTIONS: {
  id: MovieCollection;
  label: string;
}[] = [
  { id: "popular", label: "Popular" },
  { id: "now_playing", label: "New Releases" },
  { id: "upcoming", label: "Coming Soon" },
  { id: "top_rated", label: "Top Rated" },
  { id: "trending_day", label: "Trending Today" },
  { id: "trending_week", label: "Trending Week" }
];

export async function getMovies(
  page = 1,
  search = "",
  genreId: number | null = null,
  signal?: AbortSignal,
  collection: MovieCollection = "popular"
): Promise<MoviePage> {
  const params = new URLSearchParams({
    language: "en-US",
    page: String(page),
    include_adult: "false"
  });

  const endpoints: Record<MovieCollection, string> = {
    popular: "/movie/popular",
    now_playing: "/movie/now_playing",
    upcoming: "/movie/upcoming",
    top_rated: "/movie/top_rated",
    trending_day: "/trending/movie/day",
    trending_week: "/trending/movie/week"
  };

  let endpoint = endpoints[collection];

  if (search.trim()) {
    endpoint = "/search/movie";
    params.set("query", search.trim());
  } else if (genreId !== null) {
    endpoint = "/discover/movie";
    params.set("with_genres", String(genreId));
    params.set("sort_by", "popularity.desc");
    params.set("include_video", "false");
  }

  const data = await tmdbFetch<MoviePage>(
    endpoint,
    params,
    signal
  );

  // La documentation Trending ne garantit pas
  // la pagination : on utilise la premiere page.
  if (!search.trim() && genreId === null &&
      collection.startsWith("trending_")) {
    return { ...data, total_pages: 1 };
  }

  return data;
}
