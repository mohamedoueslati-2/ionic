import { useState } from 'react';
import { IonButton, IonInput, IonItem, IonList, IonText } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import type { ActionProps } from '../types/auth';

// App transmet les informations du compte et les actions disponibles à l'accueil.
interface Props extends ActionProps {
  email: string | null;
  initialPhotoURL: string;
  onSavePhoto: (photoURL: string) => void;
  onLogout: () => void;
}

const Home = ({ busy, error, email, initialPhotoURL, onSavePhoto, onLogout }: Props) => {
  // Initialise le champ avec l'adresse enregistrée, puis conserve la saisie localement.
  const [photoURL, setPhotoURL] = useState(initialPhotoURL);

  return (
    <PageLayout title="Home" busy={busy} error={error}>
      {/* Informations de l'utilisateur connecté dont le profil est complet. */}
      <IonText><h2>Welcome!</h2><p>{email}</p></IonText>
      <IonText color="success"><p>Profile completed successfully.</p></IonText>
      {/* Envoie uniquement l'URL ; ce formulaire ne téléverse pas d'image. */}
      <form onSubmit={(e) => { e.preventDefault(); onSavePhoto(photoURL); }}>
        <IonList>
          <IonItem>
            <IonInput label="Profile Photo (Optional)" labelPlacement="stacked" name="photoURL" placeholder="Photo URL"
              value={photoURL} disabled={busy} onIonInput={(e) => setPhotoURL(e.detail.value ?? '')} />
          </IonItem>
        </IonList>
        <IonButton expand="block" type="submit" disabled={busy}>Save Photo URL</IonButton>
      </form>
      {/* La photo est facultative et ne conditionne pas l'accès à l'accueil. */}
      <IonText color="medium"><p>You can skip the photo.</p></IonText>
      <IonButton expand="block" fill="clear" disabled={busy} onClick={onLogout}>Logout</IonButton>
    </PageLayout>
  );
};

export default Home;
