import { useEffect, useRef, useState } from 'react';
import { IonSegment, IonSegmentButton, IonLabel, IonButton, IonSearchbar, IonSelect, IonSelectOption, IonInfiniteScroll, IonInfiniteScrollContent, IonText, IonIcon } from '@ionic/react';
import type { InfiniteScrollCustomEvent } from '@ionic/react';
import { closeOutline, searchOutline } from 'ionicons/icons';
import './Home.css';
import PageLayout from '../components/PageLayout';
import MovieCard from '../components/MovieCard';
import MovieGrid from '../components/MovieGrid';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import SectionHeader from '../components/SectionHeader';
import { useFavorites } from '../hooks/useFavorites';
import { MOVIE_COLLECTIONS, getGenres, getMovies } from '../services/tmdb';
import type { Movie, Genre, MovieCollection } from '../services/tmdb';
export default function Home() {
  const favorites = useFavorites();
  const favoriteIds = new Set(favorites.favorites.map((movie) => movie.movieId));
  const [collection, setCollection] = useState<MovieCollection>("popular");
  const [retry, setRetry] = useState(0);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [genreId, setGenreId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [genreError, setGenreError] = useState("");

  const moreController = useRef<AbortController | null>(null);
  const loadingMore = useRef(false);

  // 1. Charger les categories depuis TMDB
  useEffect(() => {
    const controller = new AbortController();

    getGenres(controller.signal)
      .then(setGenres)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setGenreError(err.message);
        }
      });

      return () => controller.abort();
  }, []);

  // 2. Charger la premiere page quand
  // la recherche ou la categorie change
  useEffect(() => {
    const controller = new AbortController();

    moreController.current?.abort();
    loadingMore.current = false;

    setLoading(true);
    setError("");
    setMovies([]);
    setPage(1);
    setTotalPages(1);

    getMovies(
      1,
      submittedSearch,
      genreId,
      controller.signal,
      collection
    )
      .then((data) => {
        if (controller.signal.aborted) return;

        setMovies(data.results);
        setPage(1);
        setTotalPages(Math.min(data.total_pages, 500));
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      moreController.current?.abort();
    };
  }, [submittedSearch, genreId, collection, retry]);

  // 3. Charger les films suivants au scroll
  async function loadMore(event: InfiniteScrollCustomEvent) {
    if (loading || loadingMore.current || page >= totalPages) {
      await event.target.complete();
      return;
    }

    const controller = new AbortController();
    moreController.current = controller;
    loadingMore.current = true;
    setError("");

    try {
      const nextPage = page + 1;

      const data = await getMovies(
        nextPage,
        submittedSearch,
        genreId,
        controller.signal,
        collection
      );

      if (controller.signal.aborted) return;

      // Ajouter les nouveaux films sans doublons
      setMovies((previous) => {
        const existingIds = new Set(previous.map((m) => m.id));

        return [
          ...previous,
          ...data.results.filter((m) => {
            if (existingIds.has(m.id)) return false;
            existingIds.add(m.id);
            return true;
          })
        ];
      });

      setPage(data.page);
      setTotalPages(Math.min(data.total_pages, 500));
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof Error ? err.message : "Loading failed"
        );
      }
    } finally {
      if (moreController.current === controller) {
        moreController.current = null;
        loadingMore.current = false;
      }

      await event.target.complete();
    }
  }

  // Recherche par titre
  function handleSearch() {
    setGenreId(null);
    setSubmittedSearch(search.trim());
  }

  // Selection de categorie
  function selectGenre(value: number | string) {
    setGenreId(value === "all" ? null : Number(value));
    setSearch("");
    setSubmittedSearch("");
  }

  // Revenir aux films populaires
  function showPopular() {
    setSearch("");
    setSubmittedSearch("");
    setGenreId(null);
    setCollection("popular");
  }

  function selectCollection(value: MovieCollection) {
    setCollection(value);
    setSearch("");
    setSubmittedSearch("");
    setGenreId(null);
  }

  return (
    <PageLayout title="MovieMatch" wide error={favorites.error} profileShortcut>
      {favorites.error && <IonButton fill="outline" onClick={favorites.retry}>Retry Favorites</IonButton>}
      <SectionHeader eyebrow="A WORLD OF STORIES AWAITS" title="Discover your next favorite." subtitle="Great films. New perspectives. Find something that stays with you." />
      <form className="movie-search" role="search" onSubmit={(event) => { event.preventDefault(); handleSearch(); }}>
        <IonSearchbar value={search} placeholder="Search for a movie…" aria-label="Search movies"
          onIonInput={(event) => setSearch(event.detail.value ?? '')}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleSearch(); } }} />
        <IonButton type="submit" aria-label="Search"><IonIcon icon={searchOutline} slot="start" aria-hidden="true" /><span className="search-button-label">Search</span></IonButton>
        <IonButton className="clear-search" fill="outline" onClick={showPopular} aria-label="Clear search and filters" title="Clear search and filters"><IonIcon icon={closeOutline} slot="start" aria-hidden="true" /><span className="clear-search-label">Clear search and filters</span></IonButton>
      </form>
      <IonSegment className="collection-tabs" scrollable aria-label="Movie collections"
        value={!submittedSearch && genreId === null ? collection : undefined}
        onIonChange={(event) => {
          const value = event.detail.value;
          if (MOVIE_COLLECTIONS.some((item) => item.id === value)) selectCollection(value as MovieCollection);
        }}>
        {MOVIE_COLLECTIONS.map((item) => <IonSegmentButton key={item.id} value={item.id}><IonLabel>{item.label}</IonLabel></IonSegmentButton>)}
      </IonSegment>
      <div className="movie-results-heading">
        <div><p className="eyebrow">FIND YOUR MOVIE MOOD</p><h2>{submittedSearch ? `Results for "${submittedSearch}"` : genreId !== null ? `${genres.find((genre) => genre.id === genreId)?.name ?? 'Category'} Movies` : MOVIE_COLLECTIONS.find((item) => item.id === collection)?.label}</h2></div>
        <IonSelect className="genre-select" label="Genre" labelPlacement="start" aria-label="Movie Category" value={genreId ?? 'all'} onIonChange={(event) => selectGenre(event.detail.value)} interface="popover">
          <IonSelectOption value="all">All Movies</IonSelectOption>
          {genres.map((genre) => <IonSelectOption key={genre.id} value={genre.id}>{genre.name}</IonSelectOption>)}
        </IonSelect>
      </div>
      {genreError && <IonText color="danger"><p role="alert">Categories: {genreError}</p></IonText>}
      {loading && <LoadingState label="Loading movies" skeletons />}
      {error && <div className="error-notice"><span role="alert">{error}</span><IonButton fill="outline" onClick={() => setRetry((value) => value + 1)}>Retry</IonButton></div>}
      {!loading && movies.length === 0 && !error && <EmptyState title="No movies found." description="Try a different title or explore another collection."><IonButton onClick={showPopular}>Explore popular movies</IonButton></EmptyState>}
      <MovieGrid>
        {movies.map((movie) => <MovieCard key={movie.id} title={movie.title} posterPath={movie.poster_path} releaseDate={movie.release_date} rating={movie.vote_average}
          favorite={favoriteIds.has(movie.id)} disabled={favorites.unavailable || favorites.pendingIds.has(movie.id)}
          onFavorite={favorites.enabled ? () => void favorites.toggleFavorite(movie) : undefined} />)}
      </MovieGrid>
      <IonInfiniteScroll threshold="150px" disabled={Boolean(error) || loading || movies.length === 0 || page >= totalPages} onIonInfinite={(event) => void loadMore(event)}>
        <IonInfiniteScrollContent loadingSpinner="bubbles" loadingText="Loading more movies…" />
      </IonInfiniteScroll>
      {!loading && movies.length > 0 && <p className="movie-page-count">Showing {movies.length} movies — page {page} / {totalPages}</p>}
      <footer className="movie-credits"><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">Powered by TMDB</a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></footer>
    </PageLayout>
  );
}
