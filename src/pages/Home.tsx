import { useEffect, useState } from 'react';
import { IonButton, IonText } from '@ionic/react';
import { Camera, CameraDirection } from '@capacitor/camera';
import PageLayout from '../components/PageLayout';
import type { ActionProps } from '../types/auth';

// App transmet les informations du compte et les actions disponibles à l'accueil.
interface Props extends ActionProps {
  email: string | null;
  initialPhotoURL: string;
  onSavePhoto: (file: File) => void;
  onLogout: () => void;
}

const Home = ({ busy, error, email, initialPhotoURL, onSavePhoto, onLogout }: Props) => {
  // Le fichier sert au téléversement ; preview sert à afficher la photo avant l'envoi.
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState(initialPhotoURL);
  const [cameraError, setCameraError] = useState('');
  const [cameraBusy, setCameraBusy] = useState(false);

  // Affiche la photo enregistrée tant qu'aucune nouvelle photo n'a été sélectionnée.
  useEffect(() => {
    if (!photo) setPreview(initialPhotoURL);
  }, [initialPhotoURL, photo]);

  // Convertit l'adresse locale fournie par Capacitor en File pour le service Cloudinary.
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

    setPhoto(file);
    setPreview(webPath);
  }

  // Bloque les actions pendant l'ouverture de la caméra ou de la galerie.
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
    <PageLayout title="Home" busy={busy || cameraBusy} error={error}>
      {/* Informations de l'utilisateur connecté dont le profil est complet. */}
      <IonText><h2>Welcome!</h2><p>{email}</p></IonText>
      <h3>Profile Photo (Optional)</h3>
      {/* Capacitor ouvre la caméra native ou son interface PWA selon la plateforme. */}
      <IonButton
        expand="block"
        disabled={busy || cameraBusy}
        onClick={() => void runCamera(takePicture)}
      >
        Take Photo
      </IonButton>
      <IonButton
        expand="block"
        fill="outline"
        disabled={busy || cameraBusy}
        onClick={() => void runCamera(choosePicture)}
      >
        Choose from Gallery
      </IonButton>
      {cameraError && <IonText color="danger"><p role="alert">{cameraError}</p></IonText>}
      {/* Aperçu local : la photo n'est envoyée qu'au clic sur Upload to Cloudinary. */}
      {preview && (
        <div>
          <h4>Preview</h4>
          <img src={preview} alt="Profile preview" width="150" />
        </div>
      )}
      {photo && (
        <IonButton expand="block" disabled={busy || cameraBusy} onClick={() => onSavePhoto(photo)}>
          Upload to Cloudinary
        </IonButton>
      )}
      {/* La photo est facultative et ne conditionne pas l'accès à l'accueil. */}
      <IonText color="medium"><p>Photo is optional. You can skip this step.</p></IonText>
      <IonButton expand="block" fill="clear" disabled={busy || cameraBusy} onClick={onLogout}>Logout</IonButton>
    </PageLayout>
  );
};

export default Home;
