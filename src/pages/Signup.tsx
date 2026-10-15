import { useState } from 'react';
import { IonButton, IonInput, IonItem, IonList } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import PersonalInfoFields from '../components/PersonalInfoFields';
import type { ActionProps, PersonalInfo, SignupInfo } from '../types/auth';

// Actions reçues d'App : inscription par email, connexion Google et retour à Login.
interface Props extends ActionProps {
  onSignup: (info: SignupInfo) => void;
  onGoogleLogin: () => void;
  onLogin: () => void;
}

const Signup = ({ busy, error, onSignup, onGoogleLogin, onLogin }: Props) => {
  // Informations personnelles et identifiants saisis dans ce formulaire.
  const [info, setInfo] = useState<PersonalInfo>({ firstName: '', lastName: '', age: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <PageLayout title="Create Account" busy={busy} error={error}>
      {/* Regroupe les informations personnelles et les identifiants pour le service. */}
      <form onSubmit={(e) => { e.preventDefault(); onSignup({ ...info, email, password }); }}>
        <IonList>
          {/* Prénom, nom et âge obligatoires, partagés avec CompleteProfile. */}
          <PersonalInfoFields value={info} onChange={setInfo} disabled={busy} />
          <IonItem>
            <IonInput label="Email" labelPlacement="stacked" name="email" type="email" autocomplete="email"
              value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} disabled={busy} required />
          </IonItem>
          {/* Le mot de passe doit contenir au moins six caractères. */}
          <IonItem>
            <IonInput label="Password" labelPlacement="stacked" name="password" type="password" autocomplete="new-password" minlength={6}
              value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} disabled={busy} required />
          </IonItem>
        </IonList>
        <IonButton expand="block" type="submit" disabled={busy}>Create Account</IonButton>
      </form>
      {/* Première inscription Google : le profil sera complété sur CompleteProfile. */}
      <IonButton expand="block" fill="outline" disabled={busy} onClick={onGoogleLogin}>Sign Up with Google</IonButton>
      <IonButton expand="block" fill="clear" disabled={busy} onClick={onLogin}>Back to Login</IonButton>
    </PageLayout>
  );
};

export default Signup;
