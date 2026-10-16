import { IonButton, IonIcon } from '@ionic/react';
import { heartOutline, arrowForwardOutline } from 'ionicons/icons';
import PageLayout from '../components/PageLayout';
import SectionHeader from '../components/SectionHeader';
import MovieCard from '../components/MovieCard';
import MovieGrid from '../components/MovieGrid';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { useFavorites } from '../hooks/useFavorites';

export default function Favorites() {
  const { favorites, loading, error, pendingIds, unavailable, removeFavorite, retry } = useFavorites();
  return <PageLayout title="My Watchlist" wide error={error} profileShortcut>
    <SectionHeader eyebrow="YOUR PERSONAL COLLECTION" title="My Watchlist" subtitle="The stories you love, all in one place. A little more you with every favorite."
      action={!loading && !error ? <span className="count-pill">{favorites.length} {favorites.length === 1 ? 'movie' : 'movies'} saved</span> : undefined} />
    {loading && <LoadingState label="Loading Favorites" skeletons />}
    {error && <IonButton fill="outline" onClick={retry}>Retry Favorites</IonButton>}
    {!loading && !error && favorites.length === 0 && <EmptyState icon={heartOutline} title="Your next favorite is out there." description="No favorite movies yet."><IonButton routerLink="/tabs/home" routerDirection="none">Discover Movies<IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" /></IonButton></EmptyState>}
    <MovieGrid>{favorites.map((movie) => <MovieCard key={movie.movieId} title={movie.title} posterPath={movie.posterPath} releaseDate={movie.releaseDate} favorite
      disabled={unavailable || pendingIds.has(movie.movieId)} onFavorite={() => void removeFavorite(movie.movieId)} />)}</MovieGrid>
  </PageLayout>;
}
