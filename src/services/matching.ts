import {
  collection,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserProfile } from '../types/auth';

export const MAX_MATCHING_MOVIES = 500;
export const MIN_MATCHING_MOVIES = 3;
const PAGE_SIZE = 50;
const PROFILE_FIELDS = ['firstName', 'lastName', 'email', 'photoURL', 'movieIds', 'updatedAt'];

export interface MatchingProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL: string;
  movieIds: number[];
  updatedAt: Timestamp;
}

export interface UserMatch extends MatchingProfile {
  similarity: number;
  commonMovies: number;
}

export function isMatchingEligible(profile: UserProfile | null | undefined): boolean {
  return profile?.role === 'USER' && profile.status === 'ACTIVE' && profile.profileCompleted === true;
}

// Sorting makes the 500-ID projection and equality checks independent of favorite order.
export function normalizeMovieIds(ids: readonly unknown[]): number[] {
  return [...new Set(ids.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0))]
    .sort((a, b) => a - b).slice(0, MAX_MATCHING_MOVIES);
}

export function calculateSimilarity(left: readonly unknown[], right: readonly unknown[]) {
  return compareSets(new Set(normalizeMovieIds(left)), new Set(normalizeMovieIds(right)));
}

function compareSets(a: ReadonlySet<number>, b: ReadonlySet<number>) {
  const commonMovies = [...a].filter((id) => b.has(id)).length;
  const union = a.size + b.size - commonMovies;
  return { similarity: union === 0 ? 0 : commonMovies / union * 100, commonMovies };
}

export function findMatches(uid: string, movieIds: readonly unknown[], profiles: readonly MatchingProfile[]): UserMatch[] {
  const currentMovies = new Set(normalizeMovieIds(movieIds));
  if (currentMovies.size < MIN_MATCHING_MOVIES) return [];
  return profiles.filter((profile) => profile.id !== uid).map((profile) => ({
    ...profile,
    movieIds: normalizeMovieIds(profile.movieIds),
  })).filter((profile) => profile.movieIds.length >= MIN_MATCHING_MOVIES).map((profile) => ({
    ...profile,
    ...compareSets(currentMovies, new Set(profile.movieIds)),
  })).filter((match) => match.similarity >= 75)
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
}

function matchingData(profile: UserProfile, movieIds: readonly unknown[]) {
  if (!isMatchingEligible(profile)) throw new Error('Matching requires an active USER account with a completed profile.');
  if (typeof profile.firstName !== 'string' || !profile.firstName.trim() ||
      typeof profile.lastName !== 'string' || !profile.lastName.trim() ||
      typeof profile.email !== 'string' || !profile.email.trim()) {
    throw new Error('Your profile needs a first name, last name and email for matching.');
  }
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    photoURL: profile.photoURL ?? '',
    movieIds: normalizeMovieIds(movieIds),
  };
}

function sameProfile(existing: DocumentData | undefined, next: ReturnType<typeof matchingData>) {
  return existing && Object.keys(existing).length === PROFILE_FIELDS.length &&
    PROFILE_FIELDS.every((field) => field in existing) && existing.updatedAt != null &&
    existing.firstName === next.firstName && existing.lastName === next.lastName &&
    existing.email === next.email && existing.photoURL === next.photoURL &&
    Array.isArray(existing.movieIds) && existing.movieIds.length === next.movieIds.length &&
    existing.movieIds.every((id: unknown, index: number) => id === next.movieIds[index]);
}

// Serialize commits per UID, including across StrictMode remounts. A newer snapshot
// can invalidate an older queued operation; an already committing write finishes first.
const writes = new Map<string, Promise<void>>();

export function synchronizeMatchingProfile(uid: string, movieIds: readonly unknown[], isCurrent: () => boolean): Promise<void> {
  const ids = normalizeMovieIds(movieIds);
  const active = () => isCurrent() && auth.currentUser?.uid === uid;
  const previous = writes.get(uid) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    if (!active()) return;
    await runTransaction(db, async (transaction) => {
      if (!active()) return;
      const user = await transaction.get(doc(db, 'users', uid));
      if (!active()) return;
      // Re-read authoritative fields on transaction retries and race account disabling.
      const next = matchingData((user.data() ?? {}) as UserProfile, ids);
      const reference = doc(db, 'matchingProfiles', uid);
      const existing = await transaction.get(reference);
      if (!active() || sameProfile(existing.data(), next)) return;
      transaction.set(reference, { ...next, updatedAt: serverTimestamp() });
    });
  });
  writes.set(uid, operation);
  const clear = () => { if (writes.get(uid) === operation) writes.delete(uid); };
  void operation.then(clear, clear);
  return operation;
}

function readProfile(entry: QueryDocumentSnapshot): MatchingProfile | null {
  const data = entry.data();
  // Eligibility is enforced by collection membership, write rules and atomic admin
  // deletion. Do not read other users' private users/favorites documents.
  if (Object.keys(data).length !== PROFILE_FIELDS.length || !PROFILE_FIELDS.every((field) => field in data) ||
      typeof data.firstName !== 'string' || !data.firstName.trim() ||
      typeof data.lastName !== 'string' || !data.lastName.trim() ||
      typeof data.email !== 'string' || !data.email.trim() || typeof data.photoURL !== 'string' ||
      !Array.isArray(data.movieIds) || data.movieIds.length > MAX_MATCHING_MOVIES || !data.updatedAt) return null;
  return { ...data, id: entry.id, movieIds: normalizeMovieIds(data.movieIds) } as MatchingProfile;
}

export function subscribeMatchingProfiles(
  uid: string,
  onProfiles: (profiles: MatchingProfile[], loading: boolean) => void,
  onError: (error: Error) => void,
  isCurrent: () => boolean,
): () => void {
  interface Page {
    documents?: QueryDocumentSnapshot[];
    stop?: () => void;
  }
  const pages: Page[] = [];
  let disposed = false;
  const active = () => !disposed && isCurrent() && auth.currentUser?.uid === uid;

  function discardFrom(index: number) {
    const removed = pages.splice(index);
    for (const page of removed) page.stop?.();
  }

  function fail(error: Error) {
    if (!active()) return;
    disposed = true;
    discardFrom(0);
    onError(error);
  }

  function publish() {
    // Never report a partial scan as a completed empty result.
    if (!active() || pages.some((page) => !page.documents) ||
        pages[pages.length - 1]?.documents?.length === PAGE_SIZE) return;
    const profiles = new Map<string, MatchingProfile>();
    for (const page of pages) {
      for (const entry of page.documents ?? []) {
        if (entry.id === uid) continue;
        const profile = readProfile(entry);
        if (profile) profiles.set(profile.id, profile);
      }
    }
    onProfiles([...profiles.values()], false);
  }

  function listen(index: number, cursor?: QueryDocumentSnapshot) {
    if (!active()) return;
    const page: Page = {};
    pages[index] = page;
    const pageActive = () => active() && pages[index] === page;
    const constraints: QueryConstraint[] = [orderBy(documentId()), limit(PAGE_SIZE)];
    if (cursor) constraints.push(startAfter(cursor));
    try {
      page.stop = onSnapshot(query(collection(db, 'matchingProfiles'), ...constraints),
        { includeMetadataChanges: true }, (snapshot) => {
          if (!pageActive() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
          const previousBoundary = page.documents?.[page.documents.length - 1]?.id;
          page.documents = snapshot.docs;
          if (snapshot.size === PAGE_SIZE) {
            const boundary = snapshot.docs[snapshot.docs.length - 1];
            // Inserts/deletes move a limited query's boundary. Rebuild its tail so
            // profiles cannot fall into a gap between two live cursor queries.
            if (!pages[index + 1] || previousBoundary !== boundary.id) {
              discardFrom(index + 1);
              onProfiles([], true);
              listen(index + 1, boundary);
            }
          } else {
            discardFrom(index + 1);
          }
          publish();
        }, (error) => { if (pageActive()) fail(error); });
      if (!pageActive()) page.stop();
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Unable to listen for matching profiles.'));
    }
  }

  if (active()) {
    onProfiles([], true);
    listen(0);
  }
  return () => {
    disposed = true;
    discardFrom(0);
  };
}
