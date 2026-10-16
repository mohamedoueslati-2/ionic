import { useEffect, useRef, useState } from "react";
import {
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonGrid,
  IonRow,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonText
} from "@ionic/react";

import type { InfiniteScrollCustomEvent } from "@ionic/react";

import "./Home.css";
import PageLayout from "../components/PageLayout";
import FavoriteButton from "../components/FavoriteButton";
import { useFavorites } from "../hooks/useFavorites";
import {
  MOVIE_COLLECTIONS,
  getGenres,
  getMovies,
  getPosterUrl
} from "../services/tmdb";
import type { Movie, Genre, MovieCollection } from "../services/tmdb";

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
    <PageLayout title="MovieMatch" wide error={favorites.error}>

      {favorites.error && <IonButton fill="outline" onClick={favorites.retry}>Retry Favorites</IonButton>}

      <h2>Discover Movies</h2>

      {/* RECHERCHE */}
      <IonSearchbar
        value={search}
        placeholder="Search movies..."
        onIonInput={(e) => setSearch(e.detail.value ?? "")}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
      />

      <IonButton onClick={handleSearch}>
        Search
      </IonButton>

      <IonButton fill="outline" onClick={showPopular}>
        Clear
      </IonButton>

      <h3>Explore Movies</h3>
      <IonSegment scrollable
        value={!submittedSearch && genreId === null ? collection : undefined}
        onIonChange={(event) => {
          const value = event.detail.value;
          if (MOVIE_COLLECTIONS.some((item) => item.id === value)) selectCollection(value as MovieCollection);
        }}>
        {MOVIE_COLLECTIONS.map((item) => <IonSegmentButton key={item.id} value={item.id}>
          <IonLabel>{item.label}</IonLabel>
        </IonSegmentButton>)}
      </IonSegment>

      {/* CATEGORIES */}
      <IonItem>
        <IonSelect
          label="Movie Category"
          labelPlacement="stacked"
          value={genreId ?? "all"}
          onIonChange={(e) => selectGenre(e.detail.value)}
          interface="popover"
        >
          <IonSelectOption value="all">
            All Movies
          </IonSelectOption>

          {genres.map((genre) => (
            <IonSelectOption key={genre.id} value={genre.id}>
              {genre.name}
            </IonSelectOption>
          ))}
        </IonSelect>
      </IonItem>

      {genreError && (
        <IonText color="danger">
          <p>Categories: {genreError}</p>
        </IonText>
      )}

      <h3>
        {submittedSearch
          ? `Results for "${submittedSearch}"`
          : genreId !== null
          ? `${genres.find((g) => g.id === genreId)?.name ?? "Category"} Movies`
          : MOVIE_COLLECTIONS.find((item) => item.id === collection)?.label}
      </h3>

      {/* LOADING */}
      {loading && <IonSpinner name="crescent" />}

      {/* ERREURS */}
      {error && (
        <IonText color="danger">
          <p role="alert">{error}</p>
          <IonButton fill="outline" onClick={() => setRetry((value) => value + 1)}>Retry</IonButton>
        </IonText>
      )}

      {!loading && movies.length === 0 && !error && (
        <p>No movies found.</p>
      )}

      {/* LISTE DE FILMS */}
      <IonGrid>
        <IonRow>
          {movies.map((movie) => {
            const poster = getPosterUrl(movie.poster_path);

            return (
              <IonCol
                key={movie.id}
                size="6"
                sizeMd="4"
                sizeLg="3"
              >
                <IonCard className="movie-card">
                  <div className="movie-poster-container">
                    {poster ? (
                      <img
                        src={poster}
                        alt={movie.title}
                        loading="lazy"
                        className="movie-poster"
                      />
                    ) : <div className="movie-poster-placeholder">No poster available</div>}

                    {favorites.enabled && <FavoriteButton
                      title={movie.title}
                      favorite={favoriteIds.has(movie.id)}
                      disabled={favorites.unavailable || favorites.pendingIds.has(movie.id)}
                      onClick={() => void favorites.toggleFavorite(movie)}
                    />}
                  </div>

                  <IonCardHeader>
                    <IonCardTitle>
                      {movie.title}
                    </IonCardTitle>

                    <IonCardSubtitle>
                      {movie.release_date?.slice(0, 4) || "N/A"}
                      {" | "}
                      ⭐ {movie.vote_average.toFixed(1)}
                    </IonCardSubtitle>
                  </IonCardHeader>
                </IonCard>
              </IonCol>
            );
          })}
        </IonRow>
      </IonGrid>

      {/* INFINITE SCROLL */}
      <IonInfiniteScroll
        threshold="150px"
        disabled={
          Boolean(error) ||
          loading ||
          movies.length === 0 ||
          page >= totalPages
        }
        onIonInfinite={(event) => void loadMore(event)}
      >
        <IonInfiniteScrollContent
          loadingSpinner="bubbles"
          loadingText="Loading more movies..."
        />
      </IonInfiniteScroll>

      {!loading && movies.length > 0 && (
        <p>
          Showing {movies.length} movies — page {page}
          {" / "}{totalPages}
        </p>
      )}

      <footer className="movie-credits">
        <h3>Credits</h3>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">The Movie Database (TMDB)</a>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>
    </PageLayout>
  );
}
