import { useEffect, useState } from 'react';
import { IonAlert, IonBadge, IonButton, IonItem, IonLabel, IonList, IonSearchbar, IonText, IonToast } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import { setUserStatus, subscribeUsers } from '../services/admin';
import type { ManagedUser } from '../services/admin';

export default function Dashboard() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ uid: string; status: 'ACTIVE' | 'DISABLED' } | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [success, setSuccess] = useState('');
  const selected = users.find((user) => user.id === selectedId);

  useEffect(() => subscribeUsers((accounts) => {
    setUsers(accounts);
    setLoading(false);
    setError('');
  }, (err) => {
    setError(err.message);
    setLoading(false);
  }), []);

  async function confirmStatus(uid: string, status: 'ACTIVE' | 'DISABLED') {
    if (blocking) return;
    setBlocking(true);
    setError('');
    try {
      await setUserStatus(uid, status);
      setSuccess(status === 'ACTIVE' ? 'Account enabled.' : 'Account blocked.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update account status');
    } finally {
      setBlocking(false);
    }
  }

  const visibleUsers = users.filter((user) =>
    `${user.firstName ?? ''} ${user.lastName ?? ''} ${user.email ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <PageLayout title="Dashboard" busy={loading || blocking} error={error}>
    <h2>User accounts</h2>
    <IonSearchbar value={search} placeholder="Search by name or email" onIonInput={(event) => setSearch(event.detail.value ?? '')} />
    {loading ? <p>Loading accounts...</p> : <>
      <IonText color="medium"><p>{users.length} user account(s)</p></IonText>
      {!visibleUsers.length && <p>{users.length ? 'No matching accounts.' : 'No user accounts yet.'}</p>}
      <IonList>
        {visibleUsers.map((user) => <IonItem key={user.id} button onClick={() => setSelectedId(user.id)} detail>
          <IonLabel><h2>{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}</h2><p>{user.email || 'No email'}</p></IonLabel>
          <IonBadge color={user.status === 'DISABLED' ? 'danger' : 'success'}>{user.status === 'DISABLED' ? 'Blocked' : 'Active'}</IonBadge>
        </IonItem>)}
      </IonList>
    </>}
    {selected && <section aria-label="Account details">
      <h2>Account details</h2>
      <IonList>
        <IonItem><IonLabel>First name: {selected.firstName || '—'}</IonLabel></IonItem>
        <IonItem><IonLabel>Last name: {selected.lastName || '—'}</IonLabel></IonItem>
        <IonItem><IonLabel className="ion-text-wrap">Email: {selected.email || '—'}</IonLabel></IonItem>
        <IonItem><IonLabel>Age: {selected.age ?? '—'}</IonLabel></IonItem>
        <IonItem><IonLabel>Role: {selected.role}</IonLabel></IonItem>
        <IonItem><IonLabel>Status: {selected.status === 'DISABLED' ? 'Blocked' : 'Active'}</IonLabel></IonItem>
        <IonItem><IonLabel>Profile: {selected.profileCompleted ? 'Complete' : 'Incomplete'}</IonLabel></IonItem>
      </IonList>
      <IonButton color={selected.status === 'DISABLED' ? 'success' : 'danger'} expand="block" disabled={blocking} onClick={() => setConfirmation({ uid: selected.id, status: selected.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' })}>
        {selected.status === 'DISABLED' ? 'Enable account' : 'Block account'}
      </IonButton>
      <IonButton fill="clear" expand="block" onClick={() => setSelectedId(null)}>Close details</IonButton>
    </section>}
    <IonAlert isOpen={confirmation !== null}
      header={confirmation?.status === 'ACTIVE' ? 'Enable account?' : 'Block account?'}
      message={confirmation?.status === 'ACTIVE' ? 'This user will regain access to MovieMatch.' : 'This user will lose access to MovieMatch.'}
      buttons={[{ text: 'Cancel', role: 'cancel' }, {
        text: confirmation?.status === 'ACTIVE' ? 'Enable' : 'Block',
        role: confirmation?.status === 'ACTIVE' ? 'confirm' : 'destructive',
        handler: () => { if (confirmation) void confirmStatus(confirmation.uid, confirmation.status); },
      }]}
      onDidDismiss={() => setConfirmation(null)} />
    <IonToast isOpen={Boolean(success)} message={success} color="success" duration={2500} onDidDismiss={() => setSuccess('')} />
  </PageLayout>;
}
