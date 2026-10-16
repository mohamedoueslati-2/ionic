import { useState } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonIcon } from '@ionic/react';
import { filmOutline, star } from 'ionicons/icons';
import { getPosterUrl } from '../services/tmdb';
import FavoriteButton from './FavoriteButton';
import '../pages/Home.css';

interface Props {
  title: string;
  posterPath: string | null;
  releaseDate: string;
  rating?: number;
  favorite?: boolean;
  disabled?: boolean;
  onFavorite?: () => void;
}

export default function MovieCard({ title, posterPath, releaseDate, rating, favorite = false, disabled = false, onFavorite }: Props) {
  const poster = getPosterUrl(posterPath);
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  return <IonCard className="movie-card">
    <div className="movie-poster-container">
      {poster && poster !== failedPoster ? <img src={poster} alt={title} loading="lazy" className="movie-poster" onError={() => setFailedPoster(poster)} /> : <div className="movie-poster-placeholder"><IonIcon icon={filmOutline} aria-hidden="true" /><span>No poster available</span></div>}
      {onFavorite && <FavoriteButton title={title} favorite={favorite} disabled={disabled} onClick={onFavorite} />}
    </div>
    <IonCardHeader>
      <IonCardTitle title={title}>{title}</IonCardTitle>
      <div className="movie-meta"><span>{releaseDate?.slice(0, 4) || 'Release date unavailable'}</span>{rating !== undefined && <span className="movie-rating"><IonIcon icon={star} aria-label="TMDB rating" />{rating.toFixed(1)}</span>}</div>
    </IonCardHeader>
  </IonCard>;
}
