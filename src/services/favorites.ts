import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { Movie } from './tmdb';

export interface FavoriteMovie {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string;
  addedAt: Timestamp | null;
}

export type FavoriteInput = Pick<Movie, 'id' | 'title' | 'poster_path' | 'release_date'>;

function validateMovieId(movieId: number) {
  if (!Number.isSafeInteger(movieId) || movieId <= 0) {
    throw new Error('Movie ID must be a positive integer.');
  }
}

async function requireFavoriteAccount() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in to use Favorites.');

  const snapshot = await getDoc(doc(db, 'users', uid));
  if (auth.currentUser?.uid !== uid) throw new Error('Your session changed. Please try again.');
  const profile = snapshot.data() as UserProfile | undefined;
  if (profile?.role !== 'USER' || profile.status !== 'ACTIVE' || profile.profileCompleted !== true) {
    throw new Error('Favorites require an active USER account with a completed profile.');
  }
  return uid;
}

export async function addFavorite(movie: FavoriteInput): Promise<void> {
  validateMovieId(movie.id);
  if (typeof movie.title !== 'string' || !movie.title.trim() || movie.title.trim().length > 300) {
    throw new Error('Movie title must contain between 1 and 300 characters.');
  }
  if (movie.poster_path !== null && (typeof movie.poster_path !== 'string' || movie.poster_path.length > 500)) {
    throw new Error('Movie poster path must be null or a string of at most 500 characters.');
  }
  if (typeof movie.release_date !== 'string' || movie.release_date.length > 10) {
    throw new Error('Movie release date must be a string of at most 10 characters.');
  }

  const uid = await requireFavoriteAccount();
  const reference = doc(db, 'users', uid, 'favorites', String(movie.id));
  // A transaction retries concurrent creates instead of overwriting an existing timestamp.
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (auth.currentUser?.uid !== uid) throw new Error('Your session changed. Please try again.');
    if (existing.exists()) return;
    transaction.set(reference, {
      movieId: movie.id,
      title: movie.title.trim(),
      posterPath: movie.poster_path,
      releaseDate: movie.release_date,
      addedAt: serverTimestamp(),
    });
  });
}

export async function removeFavorite(movieId: number): Promise<void> {
  validateMovieId(movieId);
  const uid = await requireFavoriteAccount();
  await deleteDoc(doc(db, 'users', uid, 'favorites', String(movieId)));
}

export function subscribeFavorites(
  callback: (favorites: FavoriteMovie[], ready?: boolean) => void,
  onError: (error: Error) => void,
): () => void {
  let disposed = false;
  let generation = 0;
  let stopFavorites: (() => void) | undefined;

  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (disposed) return;
    const currentGeneration = ++generation;
    stopFavorites?.();
    stopFavorites = undefined;
    if (currentGeneration > 1 || !user) callback([], false);
    if (!user) {
      onError(new Error('Please sign in to use Favorites.'));
      return;
    }

    const isCurrent = () => !disposed && generation === currentGeneration && auth.currentUser?.uid === user.uid;
    void requireFavoriteAccount().then((uid) => {
      if (!isCurrent() || uid !== user.uid) return;
      const favoritesQuery = query(collection(db, 'users', uid, 'favorites'), orderBy('addedAt', 'desc'));
      stopFavorites = onSnapshot(favoritesQuery, { includeMetadataChanges: true }, (snapshot) => {
        if (!isCurrent()) return;
        // Estimates keep a pending server timestamp usable until the server acknowledges it.
        callback(snapshot.docs.map((favorite) => favorite.data({ serverTimestamps: 'estimate' }) as FavoriteMovie),
          !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites);
      }, (error) => {
        if (!isCurrent()) return;
        callback([], false);
        onError(error);
      });
    }).catch((error: Error) => {
      if (isCurrent()) onError(error);
    });
  }, (error) => {
    if (disposed) return;
    ++generation;
    stopFavorites?.();
    stopFavorites = undefined;
    callback([], false);
    onError(error);
  });

  return () => {
    disposed = true;
    ++generation;
    stopAuth();
    stopFavorites?.();
  };
}
