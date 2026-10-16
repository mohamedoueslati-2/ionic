import { IonButton, IonIcon } from '@ionic/react';
import { shieldCheckmarkOutline, logOutOutline } from 'ionicons/icons';
import PageLayout from '../components/PageLayout';
import type { ActionProps } from '../types/auth';

interface Props extends ActionProps { onLogout: () => void; }

export default function Disabled({ busy, error, onLogout }: Props) {
  return <PageLayout title="Account disabled" busy={busy} error={error}>
    <section className="restricted-panel"><span className="state-icon"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /></span><p className="eyebrow">ACCOUNT ACCESS</p><h1>Account disabled</h1><p>Your account currently has restricted access. Please contact your administrator for help restoring your account.</p><IonButton expand="block" disabled={busy} onClick={onLogout}><IonIcon slot="start" icon={logOutOutline} aria-hidden="true" />Logout</IonButton></section>
  </PageLayout>;
}
