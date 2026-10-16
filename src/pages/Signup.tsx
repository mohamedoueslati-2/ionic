import { useState } from 'react';
import { IonButton, IonIcon, IonInput, IonInputPasswordToggle, IonItem, IonList } from '@ionic/react';
import { arrowForwardOutline } from 'ionicons/icons';
import AuthLayout from '../components/AuthLayout';
import PersonalInfoFields from '../components/PersonalInfoFields';
import type { ActionProps, PersonalInfo, SignupInfo } from '../types/auth';

interface Props extends ActionProps {
  onSignup: (info: SignupInfo) => void;
  onGoogleLogin: () => void;
  onLogin: () => void;
}

export default function Signup({ busy, error, onSignup, onGoogleLogin, onLogin }: Props) {
  const [info, setInfo] = useState<PersonalInfo>({ firstName: '', lastName: '', age: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <AuthLayout title="Create your account" subtitle="A world of movies. A community that gets your taste." busy={busy} error={error}>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy) onSignup({ ...info, email, password }); }}>
      <IonList>
        <PersonalInfoFields value={info} onChange={setInfo} disabled={busy} />
        <IonItem lines="none"><IonInput label="Email address" labelPlacement="stacked" placeholder="you@example.com" name="email" type="email" autocomplete="email"
          value={email} onIonInput={(event) => setEmail(event.detail.value ?? '')} disabled={busy} required /></IonItem>
        <IonItem lines="none"><IonInput label="Password" labelPlacement="stacked" placeholder="At least 6 characters" name="password" type="password" autocomplete="new-password" minlength={6}
          value={password} onIonInput={(event) => setPassword(event.detail.value ?? '')} disabled={busy} required><IonInputPasswordToggle slot="end" /></IonInput></IonItem>
      </IonList>
      <IonButton expand="block" type="submit" disabled={busy}>Create Account<IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" /></IonButton>
    </form>
    <div className="auth-divider">or continue with</div>
    <IonButton expand="block" fill="outline" disabled={busy} onClick={onGoogleLogin}><span className="google-mark" aria-hidden="true">G</span>Sign Up with Google</IonButton>
    <p className="auth-footer">Already part of the story? <IonButton fill="clear" disabled={busy} onClick={onLogin}>Back to Login</IonButton></p>
  </AuthLayout>;
}
