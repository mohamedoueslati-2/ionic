import { IonButton, IonText } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import type { ActionProps } from '../types/auth';

// Seule action proposée sur cet écran : fermer la session en cours.
interface Props extends ActionProps {
  onLogout: () => void;
}

// App affiche cet écran si le document Firestore contient status = « DISABLED ».
const Disabled = ({ busy, error, onLogout }: Props) => (
  <PageLayout title="Account Disabled" busy={busy} error={error}>
    <IonText color="danger"><p>Your account is disabled.</p></IonText>
    <IonButton expand="block" disabled={busy} onClick={onLogout}>Logout</IonButton>
  </PageLayout>
);

export default Disabled;
