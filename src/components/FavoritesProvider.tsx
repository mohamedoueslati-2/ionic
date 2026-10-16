import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { auth } from '../config/firebase';
import { FavoritesContext } from '../hooks/useFavorites';
import * as favoritesService from '../services/favorites';
import type { FavoriteInput, FavoriteMovie } from '../services/favorites';

interface Props {
  uid: string;
  enabled: boolean;
  children: ReactNode;
}

export default function FavoritesProvider({ uid, enabled, children }: Props) {
  const [snapshot, setSnapshot] = useState({ uid, enabled, revision: 0, favorites: [] as FavoriteMovie[], loading: enabled, ready: false, error: '' });
  const [operationError, setOperationError] = useState('');
  const [revision, setRevision] = useState(0);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());
  const pending = useRef(new Set<number>());
  const mounted = useRef(false);
  const generation = useRef(0);
  const currentSnapshot = snapshot.uid === uid && snapshot.enabled === enabled && snapshot.revision === revision;
  const favorites = currentSnapshot ? snapshot.favorites : [];
  const loading = enabled && (!currentSnapshot || snapshot.loading);
  const listenerError = currentSnapshot ? snapshot.error : '';
  const ready = enabled && currentSnapshot && snapshot.ready && !listenerError;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    ++generation.current;
    setSnapshot({ uid, enabled, revision, favorites: [], loading: enabled, ready: false, error: '' });
    pending.current = new Set();
    setPendingIds(new Set());
    setOperationError('');
    if (!enabled) return;

    let current = true;
    const stop = favoritesService.subscribeFavorites((movies, confirmed = true) => {
      if (!current || auth.currentUser?.uid !== uid) return;
      setSnapshot((previous) => ({ uid, enabled, revision, favorites: movies, loading: !confirmed && previous.loading, ready: confirmed, error: '' }));
    }, (error) => {
      if (!current || auth.currentUser?.uid !== uid) return;
      setSnapshot({ uid, enabled, revision, favorites: [], loading: false, ready: false, error: `Unable to load Favorites. ${error.message}` });
    });
    return () => {
      current = false;
      stop();
    };
  }, [uid, enabled, revision]);

  async function run(movieId: number, action: () => Promise<void>) {
    // The ref locks immediately, including two clicks before React renders again.
    if (!enabled || loading || listenerError || auth.currentUser?.uid !== uid || pending.current.has(movieId)) return;
    const currentGeneration = generation.current;
    pending.current.add(movieId);
    setPendingIds(new Set(pending.current));
    setOperationError('');
    try {
      await action();
    } catch (error) {
      if (mounted.current && generation.current === currentGeneration && auth.currentUser?.uid === uid) {
        setOperationError(`Unable to update Favorites. ${error instanceof Error ? error.message : 'Please try again.'}`);
      }
    } finally {
      if (mounted.current && generation.current === currentGeneration && auth.currentUser?.uid === uid) {
        pending.current.delete(movieId);
        setPendingIds(new Set(pending.current));
      }
    }
  }

  function toggleFavorite(movie: FavoriteInput) {
    return run(movie.id, () => favorites.some((favorite) => favorite.movieId === movie.id)
      ? favoritesService.removeFavorite(movie.id)
      : favoritesService.addFavorite(movie));
  }

  return (
    <FavoritesContext.Provider value={{
      enabled,
      favorites: enabled ? favorites : [],
      loading: enabled && loading,
      ready,
      error: enabled ? listenerError || operationError : '',
      pendingIds,
      unavailable: !enabled || loading || Boolean(listenerError),
      retry: () => setRevision((value) => value + 1),
      toggleFavorite,
      removeFavorite: (movieId) => run(movieId, () => favoritesService.removeFavorite(movieId)),
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}
