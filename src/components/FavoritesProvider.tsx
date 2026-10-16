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
  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [listenerError, setListenerError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [revision, setRevision] = useState(0);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());
  const pending = useRef(new Set<number>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setFavorites([]);
    setListenerError('');
    setOperationError('');
    setLoading(enabled);
    if (!enabled) return;

    let current = true;
    const stop = favoritesService.subscribeFavorites((movies) => {
      if (!current || auth.currentUser?.uid !== uid) return;
      setFavorites(movies);
      setLoading(false);
    }, (error) => {
      if (!current || auth.currentUser?.uid !== uid) return;
      setFavorites([]);
      setLoading(false);
      setListenerError(`Unable to load Favorites. ${error.message}`);
    });
    return () => {
      current = false;
      stop();
    };
  }, [uid, enabled, revision]);

  async function run(movieId: number, action: () => Promise<void>) {
    // The ref locks immediately, including two clicks before React renders again.
    if (!enabled || loading || listenerError || auth.currentUser?.uid !== uid || pending.current.has(movieId)) return;
    pending.current.add(movieId);
    setPendingIds(new Set(pending.current));
    setOperationError('');
    try {
      await action();
    } catch (error) {
      if (mounted.current && auth.currentUser?.uid === uid) {
        setOperationError(`Unable to update Favorites. ${error instanceof Error ? error.message : 'Please try again.'}`);
      }
    } finally {
      pending.current.delete(movieId);
      if (mounted.current && auth.currentUser?.uid === uid) setPendingIds(new Set(pending.current));
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
