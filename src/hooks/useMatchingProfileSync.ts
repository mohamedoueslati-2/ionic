import { useEffect, useRef, useState } from 'react';
import { auth } from '../config/firebase';
import { useFavorites } from './useFavorites';
import { isMatchingEligible, normalizeMovieIds, synchronizeMatchingProfile } from '../services/matching';
import type { UserProfile } from '../types/auth';

export function useMatchingProfileSync(uid: string, profile: UserProfile) {
  const { enabled, favorites, ready } = useFavorites();
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState({ key: '', message: '' });
  const eligible = enabled && isMatchingEligible(profile);
  // Field values, rather than object identity, prevent repeated reads on rerenders.
  const movieIds = JSON.stringify(normalizeMovieIds(favorites.map((movie) => movie.movieId)));
  const key = JSON.stringify([uid, eligible, ready, movieIds, profile.firstName, profile.lastName, profile.email, profile.photoURL, attempt]);
  const latest = useRef(key);
  latest.current = key;

  useEffect(() => {
    if (!eligible || !ready) return;
    let current = true;
    const active = () => current && latest.current === key && auth.currentUser?.uid === uid;
    setFailure({ key, message: '' });
    void synchronizeMatchingProfile(uid, JSON.parse(movieIds) as number[], active).catch((error: unknown) => {
      if (active()) setFailure({ key, message: `Unable to synchronize your matching profile. ${error instanceof Error ? error.message : 'Please try again.'}` });
    });
    return () => { current = false; };
  }, [uid, eligible, ready, key, movieIds]);

  return {
    error: failure.key === key ? failure.message : '',
    retry: () => setAttempt((value) => value + 1),
  };
}
