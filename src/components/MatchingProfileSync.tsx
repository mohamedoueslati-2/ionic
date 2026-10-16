import { IonToast } from '@ionic/react';
import { useMatchingProfileSync } from '../hooks/useMatchingProfileSync';
import type { UserProfile } from '../types/auth';

// Always mounted for eligible accounts, even while Home or Profile is open.
export default function MatchingProfileSync({ uid, profile }: { uid: string; profile: UserProfile }) {
  const { error, retry } = useMatchingProfileSync(uid, profile);
  return <IonToast isOpen={Boolean(error)} message={error} position="top" color="danger"
    buttons={[{ text: 'Retry matching sync', handler: retry }]} />;
}
