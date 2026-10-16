import { useEffect, useRef, useState } from 'react';
import {
  IonAvatar, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader,
  IonCardTitle, IonCol, IonGrid, IonIcon, IonRow, IonSpinner,
  useIonViewWillEnter, useIonViewWillLeave,
} from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import PageLayout from '../components/PageLayout';
import { auth } from '../config/firebase';
import { useFavorites } from '../hooks/useFavorites';
import { findMatches, subscribeMatchingProfiles, MAX_MATCHING_MOVIES, MIN_MATCHING_MOVIES, normalizeMovieIds } from '../services/matching';
import type { MatchingProfile } from '../services/matching';
import './Matching.css';

function ProfileAvatar({ profile }: { profile: MatchingProfile }) {
  const [failedURL, setFailedURL] = useState('');
  const name = `${profile.firstName} ${profile.lastName}`;
  const initials = `${profile.firstName.trim().charAt(0)}${profile.lastName.trim().charAt(0)}`.toUpperCase();
  return (
    <IonAvatar className="matching-avatar">
      {profile.photoURL && failedURL !== profile.photoURL ? (
        <img src={profile.photoURL} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedURL(profile.photoURL)} />
      ) : <span className="matching-initials" role="img" aria-label={`Avatar for ${name}`}>{initials}</span>}
    </IonAvatar>
  );
}

export default function Matching({ uid }: { uid: string }) {
  const { enabled, favorites, loading: favoritesLoading, ready, error: favoritesError, retry: retryFavorites } = useFavorites();
  const [revision, setRevision] = useState(0);
  const [viewActive, setViewActive] = useState(true);
  useIonViewWillEnter(() => setViewActive(true));
  useIonViewWillLeave(() => setViewActive(false));
  const [result, setResult] = useState({ key: '', profiles: [] as MatchingProfile[], loading: false, error: '' });
  const movieIds = normalizeMovieIds(favorites.map((movie) => movie.movieId));
  const moviesNeeded = Math.max(0, MIN_MATCHING_MOVIES - movieIds.length);
  const canQuery = viewActive && enabled && !favoritesLoading && !favoritesError && moviesNeeded === 0;
  const key = JSON.stringify([uid, canQuery, revision]);
  const latest = useRef(key);
  latest.current = key;

  useEffect(() => {
    if (!canQuery) return;
    let current = true;
    let stop: (() => void) | undefined;
    const active = () => current && latest.current === key && auth.currentUser?.uid === uid;
    setResult({ key, profiles: [], loading: true, error: '' });
    // Defer setup so StrictMode's discarded effect does not open a listener.
    void Promise.resolve().then(() => {
      if (!active()) return;
      try {
        stop = subscribeMatchingProfiles(uid, (profiles, loading) => {
          if (active()) setResult({ key, profiles, loading, error: '' });
        }, (error) => {
          if (active()) setResult({ key, profiles: [], loading: false, error: `Unable to load matches. ${error.message}` });
        }, active);
      } catch (error) {
        if (active()) setResult({ key, profiles: [], loading: false, error: `Unable to load matches. ${error instanceof Error ? error.message : 'Please try again.'}` });
      }
    });
    return () => { current = false; stop?.(); };
  }, [uid, canQuery, key]);

  const currentResult = result.key === key;
  const loading = enabled && (favoritesLoading || (canQuery && (!currentResult || result.loading)));
  const error = favoritesError || (currentResult ? result.error : '');
  const matches = canQuery && currentResult && !loading && !error ? findMatches(uid, movieIds, result.profiles) : [];
  const refresh = () => {
    if (favoritesError || !ready) retryFavorites();
    setRevision((value) => value + 1);
  };

  return (
    <PageLayout title="Matching" wide error={error}>
      <div className="matching-heading">
        <div>
          <h2>Find your movie people</h2>
          <p>People who share 75% or more of your combined favorite movies.</p>
        </div>
        <IonButton fill="outline" onClick={refresh} disabled={!enabled || loading || (!error && moviesNeeded > 0)}>
          <IonIcon icon={refreshOutline} slot="start" aria-hidden="true" />
          {error ? 'Retry matches' : 'Refresh matches'}
        </IonButton>
      </div>
      {!enabled && <p>Matching requires an active USER account with a completed profile.</p>}
      {loading && <div role="status"><IonSpinner name="crescent" aria-label="Loading matches" /><p>Loading matches...</p></div>}
      {enabled && !loading && !error && moviesNeeded > 0 && <p>Matching starts with {MIN_MATCHING_MOVIES} favorite movies. Add {moviesNeeded} more {moviesNeeded === 1 ? 'movie' : 'movies'} to discover people with similar taste.</p>}
      {enabled && !loading && !error && canQuery && matches.length === 0 && <p>No matches at 75% or more yet. Add more favorites or refresh to check again.</p>}
      {favorites.length > MAX_MATCHING_MOVIES && <p>Matching uses up to {MAX_MATCHING_MOVIES} favorites, selected by movie ID.</p>}
      {matches.length > 0 && <p role="status">{matches.length} {matches.length === 1 ? 'match' : 'matches'} found</p>}
      <IonGrid className="matching-grid">
        <IonRow>
          {matches.map((match) => (
            <IonCol key={match.id} size="12" sizeMd="6" sizeLg="4">
              <IonCard className="matching-card">
                <IonCardHeader>
                  <ProfileAvatar profile={match} />
                  <IonCardTitle>{match.firstName} {match.lastName}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <p className="matching-email">{match.email}</p>
                  <IonBadge color="primary">{Math.round(match.similarity)}% match</IonBadge>
                  <p>{match.commonMovies} {match.commonMovies === 1 ? 'favorite movie' : 'favorite movies'} in common</p>
                </IonCardContent>
              </IonCard>
            </IonCol>
          ))}
        </IonRow>
      </IonGrid>
    </PageLayout>
  );
}
