import {
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonGrid,
  IonRow,
  IonSpinner,
} from '@ionic/react';
import FavoriteButton from '../components/FavoriteButton';
import PageLayout from '../components/PageLayout';
import { useFavorites } from '../hooks/useFavorites';
import { getPosterUrl } from '../services/tmdb';
import './Home.css';

export default function Favorites() {
  const { favorites, loading, error, pendingIds, unavailable, removeFavorite, retry } = useFavorites();

  return (
    <PageLayout title="Favorites" wide error={error}>
      <h2>My Playlist</h2>
      {loading && <IonSpinner name="crescent" aria-label="Loading Favorites" />}
      {error && <IonButton fill="outline" onClick={retry}>Retry Favorites</IonButton>}
      {!loading && !error && favorites.length === 0 && <p>No favorite movies yet.</p>}
      <IonGrid>
        <IonRow>
          {favorites.map((movie) => {
            const poster = getPosterUrl(movie.posterPath);
            return (
              <IonCol key={movie.movieId} size="6" sizeMd="4" sizeLg="3">
                <IonCard className="movie-card">
                  <div className="movie-poster-container">
                    {poster ? (
                      <img src={poster} alt={movie.title} loading="lazy" className="movie-poster" />
                    ) : <div className="movie-poster-placeholder">No poster available</div>}
                    <FavoriteButton title={movie.title} favorite
                      disabled={unavailable || pendingIds.has(movie.movieId)}
                      onClick={() => void removeFavorite(movie.movieId)} />
                  </div>
                  <IonCardHeader>
                    <IonCardTitle>{movie.title}</IonCardTitle>
                    <IonCardSubtitle>{movie.releaseDate.slice(0, 4) || 'N/A'}</IonCardSubtitle>
                  </IonCardHeader>
                </IonCard>
              </IonCol>
            );
          })}
        </IonRow>
      </IonGrid>
    </PageLayout>
  );
}
