import { useState } from 'react';
import { IonButton, IonIcon, IonList } from '@ionic/react';
import { arrowForwardOutline, personAddOutline } from 'ionicons/icons';
import AuthLayout from '../components/AuthLayout';
import PersonalInfoFields from '../components/PersonalInfoFields';
import type { ActionProps, PersonalInfo } from '../types/auth';

interface Props extends ActionProps { onComplete: (info: PersonalInfo) => void; onLogout: () => void; }

export default function CompleteProfile({ busy, error, onComplete, onLogout }: Props) {
  const [info, setInfo] = useState<PersonalInfo>({ firstName: '', lastName: '', age: '' });
  return <AuthLayout title="Almost there!" subtitle="Tell us a little about yourself to complete your profile and find your movie people." icon={personAddOutline} busy={busy} error={error}>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy) onComplete(info); }}>
      <IonList><PersonalInfoFields value={info} onChange={setInfo} disabled={busy} /></IonList>
      <IonButton expand="block" type="submit" disabled={busy}>Complete Profile<IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" /></IonButton>
    </form>
    <IonButton expand="block" fill="clear" disabled={busy} onClick={onLogout}>Logout</IonButton>
  </AuthLayout>;
}
