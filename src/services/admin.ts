import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserProfile } from '../types/auth';

export interface ManagedUser extends UserProfile {
  id: string;
  email?: string | null;
}

export function subscribeUsers(onUsers: (users: ManagedUser[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'users'), where('role', '==', 'USER')), (snapshot) => {
    onUsers(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id } as ManagedUser))
      .sort((a, b) => `${a.firstName ?? ''} ${a.lastName ?? ''}`.localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`)));
  }, onError);
}

export async function setUserStatus(uid: string, status: 'ACTIVE' | 'DISABLED') {
  const adminUid = auth.currentUser?.uid;
  if (!adminUid || adminUid === uid) throw new Error('Unauthorized');
  await runTransaction(db, async (transaction) => {
    const admin = await transaction.get(doc(db, 'users', adminUid));
    const targetRef = doc(db, 'users', uid);
    const target = await transaction.get(targetRef);
    if (admin.data()?.role !== 'ADMIN' || admin.data()?.status !== 'ACTIVE') throw new Error('Unauthorized');
    if (!target.exists() || target.data().role !== 'USER') throw new Error('User account not found');
    transaction.update(targetRef, { status, updatedAt: serverTimestamp() });
  });
}
