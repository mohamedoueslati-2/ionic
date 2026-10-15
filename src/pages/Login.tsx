import { useState } from 'react';
import { IonButton, IonInput, IonItem, IonList, IonText } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import type { ActionProps } from '../types/auth';

// App fournit les actions ; cette page gère la saisie et l'affichage du formulaire.
interface Props extends ActionProps {
  onLogin: (email: string, password: string) => void;
  onGoogleLogin: () => void;
  onSignup: () => void;
}

const Login = ({ busy, error, onLogin, onGoogleLogin, onSignup }: Props) => {
  // États locaux : chaque saisie met à jour sa valeur sans recharger la page.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      {/* Google utilise une fenêtre de connexion, sans les champs email/mot de passe. */}
      <IonButton expand="block" fill="outline" disabled={busy} onClick={onGoogleLogin}>Login with Google</IonButton>
      <IonText color="medium"><p>Don't have an account?</p></IonText>
      {/* Demande à App d'afficher Signup. */}
      <IonButton expand="block" fill="clear" disabled={busy} onClick={onSignup}>Sign Up</IonButton>
    </PageLayout>
  );
};

export default Login;
