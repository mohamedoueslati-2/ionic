import { useState } from 'react';
import { IonButton, IonList } from '@ionic/react';
import PageLayout from '../components/PageLayout';
import PersonalInfoFields from '../components/PersonalInfoFields';
import type { ActionProps, PersonalInfo } from '../types/auth';

// App reçoit les informations validées par le formulaire ou la demande de déconnexion.
interface Props extends ActionProps {
  onComplete: (info: PersonalInfo) => void;
  onLogout: () => void;
}

// Cette page s'affiche tant que le profil de l'utilisateur connecté est incomplet.
const CompleteProfile = ({ busy, error, onComplete, onLogout }: Props) => {
  const [info, setInfo] = useState<PersonalInfo>({ firstName: '', lastName: '', age: '' });

  return (
    <PageLayout title="Complete Your Profile" busy={busy} error={error}>
      {/* Les champs sont obligatoires avant de pouvoir afficher Home. */}
      <form onSubmit={(e) => { e.preventDefault(); onComplete(info); }}>
        <IonList>
          <PersonalInfoFields value={info} onChange={setInfo} disabled={busy} />
        </IonList>
        {/* Le service enregistrera les données et profileCompleted = true. */}
        <IonButton expand="block" type="submit" disabled={busy}>Complete Registration</IonButton>
      </form>
      {/* Quitter la session laisse le profil incomplet pour la prochaine connexion. */}
      <IonButton expand="block" fill="clear" disabled={busy} onClick={onLogout}>Logout</IonButton>
    </PageLayout>
  );
};

export default CompleteProfile;
