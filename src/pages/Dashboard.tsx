import { useEffect, useState } from 'react';
import { IonAlert, IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonToast } from '@ionic/react';
import { peopleOutline, checkmarkCircleOutline, banOutline } from 'ionicons/icons';
import PageLayout from '../components/PageLayout';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
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

  return <PageLayout title="MovieMatch Admin" busy={loading || blocking} error={error} wide profileShortcut>
    <SectionHeader eyebrow="MOVIEMATCH ADMIN" title="Community overview" subtitle="A clear view of your community. Manage user accounts and access." />
    <div className="stats-grid" aria-label="User statistics">
      <div className="stat-card"><IonIcon icon={peopleOutline} aria-hidden="true" /><p>Total users</p><strong>{loading || error ? '—' : users.length}</strong></div>
      <div className="stat-card"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><p>Active users</p><strong>{loading || error ? '—' : users.filter((user) => user.status === 'ACTIVE').length}</strong></div>
      <div className="stat-card"><IonIcon icon={banOutline} aria-hidden="true" /><p>Disabled users</p><strong>{loading || error ? '—' : users.filter((user) => user.status === 'DISABLED').length}</strong></div>
    </div>
    <h2>User accounts</h2>
    <IonSearchbar value={search} aria-label="Search user accounts" placeholder="Search by name or email" onIonInput={(event) => setSearch(event.detail.value ?? '')} />
    {loading ? <LoadingState label="Loading accounts" /> : !error && <>
      {!visibleUsers.length && <EmptyState icon={peopleOutline} title={users.length ? 'No matching accounts.' : 'No user accounts yet.'} description={users.length ? 'Try searching for another name or email address.' : 'New members will appear here.'} />}
      {visibleUsers.length > 0 && <IonList className="admin-users">
        {visibleUsers.map((user) => <IonItem key={user.id} button onClick={() => setSelectedId(user.id)} detail>
          <span className="user-initials" slot="start" aria-hidden="true">{`${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() || '?'}</span>
          <IonLabel><h2>{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}</h2><p>{user.email || 'No email'}</p></IonLabel>
          <IonBadge color={user.status === 'DISABLED' ? 'danger' : 'success'}>{user.status === 'DISABLED' ? 'Disabled' : 'Active'}</IonBadge>
        </IonItem>)}
      </IonList>}
    </>}
    {selected && <section className="account-details" aria-label="Account details">
      <h2>Account details</h2>
      <IonList>
        <IonItem><IonLabel>First name: {selected.firstName || '—'}</IonLabel></IonItem>
        <IonItem><IonLabel>Last name: {selected.lastName || '—'}</IonLabel></IonItem>
        <IonItem><IonLabel className="ion-text-wrap">Email: {selected.email || '—'}</IonLabel></IonItem>
        <IonItem><IonLabel>Age: {selected.age ?? '—'}</IonLabel></IonItem>
        <IonItem><IonLabel>Role: {selected.role}</IonLabel></IonItem>
        <IonItem><IonLabel>Status: {selected.status === 'DISABLED' ? 'Disabled' : 'Active'}</IonLabel></IonItem>
        <IonItem><IonLabel>Profile: {selected.profileCompleted ? 'Complete' : 'Incomplete'}</IonLabel></IonItem>
      </IonList>
      <IonButton color={selected.status === 'DISABLED' ? 'success' : 'danger'} expand="block" disabled={blocking} onClick={() => setConfirmation({ uid: selected.id, status: selected.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' })}>
        {selected.status === 'DISABLED' ? 'Enable account' : 'Disable account'}
      </IonButton>
      <IonButton fill="clear" expand="block" onClick={() => setSelectedId(null)}>Close details</IonButton>
    </section>}
    <IonAlert isOpen={confirmation !== null}
      header={confirmation?.status === 'ACTIVE' ? 'Enable account?' : 'Disable account?'}
      message={confirmation?.status === 'ACTIVE' ? 'This user will regain access to MovieMatch.' : 'This user will lose access to MovieMatch.'}
      buttons={[{ text: 'Cancel', role: 'cancel' }, {
        text: confirmation?.status === 'ACTIVE' ? 'Enable' : 'Disable',
        role: confirmation?.status === 'ACTIVE' ? 'confirm' : 'destructive',
        handler: () => { if (confirmation) void confirmStatus(confirmation.uid, confirmation.status); },
      }]}
      onDidDismiss={() => setConfirmation(null)} />
    <IonToast isOpen={Boolean(success)} message={success} color="success" duration={2500} onDidDismiss={() => setSuccess('')} />
  </PageLayout>;
}
