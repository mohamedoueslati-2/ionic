import { useState } from 'react';
import { IonButton, IonInput, IonItem, IonList, IonText } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import type { ActionProps } from '../types/auth';

// App fournit les actions ; cette page gère la saisie et l'affichage du formulaire.
interface Props extends ActionProps {
  onLogin: (email: string, password: string) => void;
  onRequestPasswordReset: (email: string) => Promise<boolean>;
  onGoogleLogin: () => void;
  onSignup: () => void;
}

const Login = ({ busy, error, onLogin, onRequestPasswordReset, onGoogleLogin, onSignup }: Props) => {
  // États locaux : chaque saisie met à jour sa valeur sans recharger la page.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Le formulaire de récupération ne demande pas l'ancien mot de passe.
  if (resetMode) {
    return (
      <PageLayout title="Reset password" busy={busy} error={error}>
        <IonText><p>Enter your email to receive a password reset link.</p></IonText>
        <form onSubmit={(event) => {
          event.preventDefault();
          setResetSent(false);
          void onRequestPasswordReset(resetEmail).then(setResetSent);
        }}>
          <IonList>
            <IonItem>
              <IonInput label="Email" labelPlacement="stacked" name="resetEmail" type="email" autocomplete="email"
                value={resetEmail} onIonInput={(event) => { setResetEmail(event.detail.value ?? ''); setResetSent(false); }}
                disabled={busy} required />
            </IonItem>
          </IonList>
          <IonButton expand="block" type="submit" disabled={busy}>Send reset link</IonButton>
        </form>
        {resetSent && <IonText color="success"><p role="status">If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.</p></IonText>}
        <IonButton expand="block" fill="clear" disabled={busy} onClick={() => setResetMode(false)}>Back to Login</IonButton>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Login" busy={busy} error={error}>
      {/* preventDefault évite le rechargement HTML, puis transmet les valeurs à App. */}
      <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }}>
        {/* onIonInput récupère la valeur à chaque saisie dans un champ Ionic. */}
        <IonList>
          <IonItem>
            <IonInput label="Email" labelPlacement="stacked" name="email" type="email" autocomplete="email"
              value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} disabled={busy} required />
          </IonItem>
          <IonItem>
            <IonInput label="Password" labelPlacement="stacked" name="password" type="password" autocomplete="current-password"
              value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} disabled={busy} required />
          </IonItem>
        </IonList>
        <IonButton expand="block" type="submit" disabled={busy}>Login</IonButton>
      </form>
      <IonButton expand="block" fill="clear" disabled={busy} onClick={() => {
        setResetEmail(email);
        setResetSent(false);
        setPassword('');
        setResetMode(true);
      }}>Forgot password?</IonButton>
      {/* Google utilise une fenêtre de connexion, sans les champs email/mot de passe. */}
      <IonButton expand="block" fill="outline" disabled={busy} onClick={onGoogleLogin}>Login with Google</IonButton>
      <IonText color="medium"><p>Don't have an account?</p></IonText>
      {/* Demande à App d'afficher Signup. */}
      <IonButton expand="block" fill="clear" disabled={busy} onClick={onSignup}>Sign Up</IonButton>
    </PageLayout>
  );
};

export default Login;
