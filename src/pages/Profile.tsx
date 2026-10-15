import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  IonAvatar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonText,
  IonToast,
} from '@ionic/react';
import { Camera, CameraDirection } from '@capacitor/camera';
import { cameraOutline, checkmarkOutline, imageOutline, logOutOutline, pencilOutline } from 'ionicons/icons';
import PageLayout from '../components/PageLayout';
import PersonalInfoFields from '../components/PersonalInfoFields';
import AccountSecurity from '../components/AccountSecurity';
import type { AccountSecurityProps, PersonalInfo, UserProfile } from '../types/auth';
import './Profile.css';

// App transmet les informations du compte et les actions disponibles sur le profil.
interface Props extends AccountSecurityProps {
  profile: UserProfile;
  onSaveProfile: (info: PersonalInfo) => Promise<boolean>;
  onSavePhoto: (file: File) => Promise<void>;
  onLogout: () => void;
}

const Profile = ({ busy, error, email, profile, providerIds, onChangePassword, onSaveProfile, onSavePhoto, onLogout }: Props) => {
  const [cameraError, setCameraError] = useState('');
  const [cameraBusy, setCameraBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PersonalInfo>({ firstName: '', lastName: '', age: '' });
  const [saved, setSaved] = useState(false);
  const locked = busy || cameraBusy;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const initials = `${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? ''}`.toUpperCase();

  // Crée une copie des données pour pouvoir annuler sans modifier le profil enregistré.
  function startEditing() {
    setDraft({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      age: profile.age == null ? '' : String(profile.age),
    });
    setSaved(false);
    setEditing(true);
  }

  // Ferme le formulaire uniquement après une sauvegarde réussie.
  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const success = await onSaveProfile(draft);
    if (success) {
      setEditing(false);
      setSaved(true);
    }
  }

  // Convertit la photo en File puis l'envoie immédiatement au service Cloudinary.
  async function preparePhoto(webPath: string | undefined) {
    // Capacitor déclare ce chemin comme facultatif : signale clairement son absence.
    if (!webPath) {
      throw new Error('Unable to read photo: no local image path');
    }
    const response = await fetch(webPath);
    if (!response.ok) {
      throw new Error('Unable to read photo');
    }

    const blob = await response.blob();
    const mime = blob.type || 'image/jpeg';
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const file = new File([blob], `profile.${ext}`, { type: mime });

    // Attend la fin du téléversement ; aucun bouton d'envoi supplémentaire n'est nécessaire.
    await onSavePhoto(file);
  }

  // Bloque les actions pendant la sélection, la lecture et le téléversement de la photo.
  async function runCamera(action: () => Promise<void>) {
    if (busy || cameraBusy) return;
    setCameraError('');
    setCameraBusy(true);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Fermer volontairement la caméra ou le sélecteur n'est pas une erreur à afficher.
      if (!message.toLowerCase().includes('cancel')) {
        setCameraError(message);
      }
    } finally {
      setCameraBusy(false);
    }
  }

  // Ouvre la caméra frontale avec l'API Capacitor Camera 8.
  async function takePicture() {
    const result = await Camera.takePhoto({
      quality: 80,
      cameraDirection: CameraDirection.Front,
      targetWidth: 1024,
      targetHeight: 1024,
    });
    await preparePhoto(result.webPath);
  }

  // Sélectionne une seule photo existante dans la galerie de l'appareil.
  async function choosePicture() {
    const result = await Camera.chooseFromGallery({
      quality: 80,
      allowMultipleSelection: false,
    });
    if (result.results.length > 0) {
      await preparePhoto(result.results[0].webPath);
    }
  }

  return (
    <PageLayout title="Profile" busy={locked} error={error}>
      {/* Résumé du compte : photo ou initiales, nom complet et email en lecture seule. */}
      <IonCard className="profile-card">
        <IonCardContent className="profile-summary">
          <IonAvatar className="profile-avatar">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profile" />
            ) : (
              <span className="profile-initials" aria-label="Profile initials">{initials || '?'}</span>
            )}
          </IonAvatar>
          <IonText color="dark"><h2 className="profile-name">{fullName || 'Your profile'}</h2></IonText>
          <IonText color="medium"><p className="profile-email">{email}</p></IonText>
          {/* Les photos prises ou sélectionnées sont toujours envoyées automatiquement. */}
          <div className="profile-photo-actions">
            <IonButton size="small" fill="outline" disabled={locked} onClick={() => void runCamera(takePicture)}>
              <IonIcon slot="start" icon={cameraOutline} aria-hidden="true" />
              Take Photo
            </IonButton>
            <IonButton size="small" fill="outline" disabled={locked} onClick={() => void runCamera(choosePicture)}>
              <IonIcon slot="start" icon={imageOutline} aria-hidden="true" />
              Gallery
            </IonButton>
          </div>
          <IonText color="medium"><p>Photos are saved automatically. Adding one is optional.</p></IonText>
          {cameraError && <IonText color="danger"><p role="alert">{cameraError}</p></IonText>}
        </IonCardContent>
      </IonCard>

      <IonCard className="profile-card">
        <IonCardHeader>
          <IonCardTitle>{editing ? 'Edit profile' : 'Personal information'}</IonCardTitle>
        </IonCardHeader>
        {/* Consultation par défaut ; les champs Ionic apparaissent seulement en modification. */}
        {editing ? (
          <form onSubmit={(event) => void saveDetails(event)}>
            <IonList>
              <PersonalInfoFields value={draft} onChange={setDraft} disabled={locked} />
            </IonList>
            <IonCardContent>
              <IonButton expand="block" type="submit" disabled={locked}>
                <IonIcon slot="start" icon={checkmarkOutline} aria-hidden="true" />
                Save changes
              </IonButton>
              <IonButton expand="block" fill="clear" type="button" disabled={locked} onClick={() => setEditing(false)}>
                Cancel
              </IonButton>
            </IonCardContent>
          </form>
        ) : (
          <>
            <IonList>
              <IonItem><IonLabel><p>First Name</p><h2>{profile.firstName || '—'}</h2></IonLabel></IonItem>
              <IonItem><IonLabel><p>Last Name</p><h2>{profile.lastName || '—'}</h2></IonLabel></IonItem>
              <IonItem><IonLabel><p>Age</p><h2>{profile.age ?? '—'}</h2></IonLabel></IonItem>
              {/* Le rôle provient de Firestore et ne fait pas partie du formulaire de modification. */}
              <IonItem><IonLabel><p>Role</p><h2>{profile.role || '—'}</h2></IonLabel></IonItem>
            </IonList>
            <IonCardContent>
              <IonButton expand="block" fill="outline" disabled={locked} onClick={startEditing}>
                <IonIcon slot="start" icon={pencilOutline} aria-hidden="true" />
                Edit profile
              </IonButton>
            </IonCardContent>
          </>
        )}
      </IonCard>

      {/* Gestion des identifiants séparée des informations personnelles et de la photo. */}
      <AccountSecurity busy={locked} email={email} providerIds={providerIds}
        onChangePassword={onChangePassword} />

      <IonButton expand="block" fill="outline" color="danger" disabled={locked} onClick={onLogout}>
        <IonIcon slot="start" icon={logOutOutline} aria-hidden="true" />
        Logout
      </IonButton>
      {/* Confirmation affichée après une sauvegarde réussie dans Firestore. */}
      <IonToast isOpen={saved} message="Profile updated successfully." color="success" duration={2500}
        onDidDismiss={() => setSaved(false)} />
    </PageLayout>
  );
};

export default Profile;
