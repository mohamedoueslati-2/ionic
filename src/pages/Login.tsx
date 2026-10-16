import { useState } from 'react';
import { IonButton, IonIcon, IonInput, IonItem, IonList, IonInputPasswordToggle } from '@ionic/react';
import { arrowBackOutline, arrowForwardOutline, mailOutline } from 'ionicons/icons';
import AuthLayout from '../components/AuthLayout';
import type { ActionProps } from '../types/auth';

interface Props extends ActionProps {
  onLogin: (email: string, password: string) => void;
  onRequestPasswordReset: (email: string) => Promise<boolean>;
  onGoogleLogin: () => void;
  onSignup: () => void;
}

export default function Login({ busy, error, onLogin, onRequestPasswordReset, onGoogleLogin, onSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  if (resetMode) return <AuthLayout title="Forgot your password?" subtitle="It happens. We'll help you get back to your next great film." icon={mailOutline} busy={busy} error={error}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (busy) return;
      setResetSent(false);
      void onRequestPasswordReset(resetEmail).then(setResetSent);
    }}>
      <IonList><IonItem lines="none"><IonInput label="Email address" labelPlacement="stacked" placeholder="you@example.com" name="resetEmail" type="email" autocomplete="email"
        value={resetEmail} onIonInput={(event) => { setResetEmail(event.detail.value ?? ''); setResetSent(false); }} disabled={busy} required /></IonItem></IonList>
      <IonButton expand="block" type="submit" disabled={busy}>Send reset link<IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" /></IonButton>
    </form>
    {resetSent && <p className="success-notice" role="status">If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.</p>}
    <IonButton expand="block" fill="clear" disabled={busy} onClick={() => setResetMode(false)}><IonIcon slot="start" icon={arrowBackOutline} aria-hidden="true" />Back to Login</IonButton>
  </AuthLayout>;

  return <AuthLayout title="Welcome back" subtitle="Your next favorite film is just around the corner." busy={busy} error={error}>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy) onLogin(email, password); }}>
      <IonList>
        <IonItem lines="none"><IonInput label="Email address" labelPlacement="stacked" placeholder="you@example.com" name="email" type="email" autocomplete="email"
          value={email} onIonInput={(event) => setEmail(event.detail.value ?? '')} disabled={busy} required /></IonItem>
        <IonItem lines="none"><IonInput label="Password" labelPlacement="stacked" placeholder="Enter your password" name="password" type="password" autocomplete="current-password"
          value={password} onIonInput={(event) => setPassword(event.detail.value ?? '')} disabled={busy} required><IonInputPasswordToggle slot="end" /></IonInput></IonItem>
      </IonList>
      <div className="password-options"><IonButton fill="clear" disabled={busy} onClick={() => { setResetEmail(email); setResetSent(false); setPassword(''); setResetMode(true); }}>Forgot password?</IonButton></div>
      <IonButton expand="block" type="submit" disabled={busy}>Sign In<IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" /></IonButton>
    </form>
    <div className="auth-divider">or continue with</div>
    <IonButton expand="block" fill="outline" disabled={busy} onClick={onGoogleLogin}><span className="google-mark" aria-hidden="true">G</span>Continue with Google</IonButton>
    <p className="auth-footer">New to MovieMatch? <IonButton fill="clear" disabled={busy} onClick={onSignup}>Sign Up</IonButton></p>
  </AuthLayout>;
}
