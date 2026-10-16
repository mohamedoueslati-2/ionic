import { createContext, useContext } from 'react';
import type { FavoriteInput, FavoriteMovie } from '../services/favorites';

export interface FavoritesState {
  enabled: boolean;
  favorites: FavoriteMovie[];
  loading: boolean;
  ready: boolean; // A complete, server-confirmed snapshot, safe to publish for matching.
  error: string;
  pendingIds: ReadonlySet<number>;
  unavailable: boolean;
  retry: () => void;
  toggleFavorite: (movie: FavoriteInput) => Promise<void>;
  removeFavorite: (movieId: number) => Promise<void>;
}

export const FavoritesContext = createContext<FavoritesState | null>(null);

export function useFavorites() {
  const favorites = useContext(FavoritesContext);
  if (!favorites) throw new Error('useFavorites requires FavoritesProvider.');
  return favorites;
}
