import { useState } from 'react';
import { IonApp, IonButton, IonSpinner, IonText, setupIonicReact } from '@ionic/react';
import PageLayout from './components/PageLayout';
import { useAuth } from './hooks/useAuth';
import * as authService from './services/auth';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CompleteProfile from './pages/CompleteProfile';
import Disabled from './pages/Disabled';
import MainTabs from './components/MainTabs';

// Styles de base nécessaires à l'affichage des composants Ionic.
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
// Utilitaires utilisés pour les marges et l'alignement de la grille Ionic.
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import './theme/variables.css';

// Prépare Ionic avant le premier affichage de l'application.
setupIonicReact();

const App = () => {
  // useAuth fournit la session et le profil ; App décide quelle page afficher.
  const { user, account, profile, loading, error: authError, refreshAccountDetails } = useAuth();
  // Ce choix concerne uniquement les visiteurs qui ne sont pas connectés.
  const [screen, setScreen] = useState<'login' | 'signup'>('login');
  // error affiche l'échec d'une action ; busy bloque les boutons pendant la requête.
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Encadre les actions asynchrones : attente, gestion des erreurs, puis déblocage.
  async function run(action: () => Promise<void>): Promise<boolean> {
    if (busy) return false;
    setError('');
    setBusy(true);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      return false;
    } finally {
      // Exécuté après une réussite comme après une erreur.
      setBusy(false);
    }
  }

  // Passe de Login à Signup, ou inversement, en effaçant l'ancienne erreur.
  function navigate(next: 'login' | 'signup') {
    setError('');
    setScreen(next);
  }

  // Actions transmises aux pages sous forme de fonctions (props).
  // « void » indique que le clic n'attend pas la promesse ; run gère ses erreurs.
  const onLogout = () => void run(async () => {
    await authService.logout();
    setScreen('login');
  });
  const onGoogleLogin = () => void run(authService.googleLogin);

  // Choix de l'écran selon la session et le profil ; MainTabs gère ensuite les URL des onglets.
  let content;
  if (loading) {
    // Attend Firebase avant de décider si l'utilisateur est connecté.
    content = (
      <PageLayout title="MovieMatch">
        <IonSpinner name="crescent" aria-label="Loading" />
        <IonText><p>Loading...</p></IonText>
      </PageLayout>
    );
  } else if (authError) {
    // En cas d'erreur de lecture, propose la déconnexion si une session existe.
    content = (
      <PageLayout title="MovieMatch" busy={busy} error={error || authError}>
        {user && <IonButton expand="block" disabled={busy} onClick={onLogout}>Logout</IonButton>}
      </PageLayout>
    );
  } else if (!user) {
    // Visiteur : montre le formulaire de connexion ou celui d'inscription.
    content = screen === 'login' ? (
      <Login busy={busy} error={error} onLogin={(email, password) => void run(() => authService.login(email, password))}
        onRequestPasswordReset={(email) => run(() => authService.requestPasswordReset(email))}
        onGoogleLogin={onGoogleLogin} onSignup={() => navigate('signup')} />
    ) : (
      <Signup busy={busy} error={error} onSignup={(info) => void run(() => authService.signup(info))}
        onGoogleLogin={onGoogleLogin} onLogin={() => navigate('login')} />
    );
  } else if (profile?.status === 'DISABLED') {
    // Le statut du profil empêche ici l'affichage de Home.
    content = <Disabled busy={busy} error={error} onLogout={onLogout} />;
  } else if (profile?.profileCompleted) {
    // Utilisateur connecté avec profil complet : accès aux trois onglets Ionic.
    content = (
      <MainTabs
        key={user.uid}
        busy={busy}
        error={error}
        email={account.email}
        providerIds={account.providerIds}
        profile={profile}
        onChangePassword={(currentPassword, newPassword) => run(async () => {
          await authService.changeAccountPassword(currentPassword, newPassword);
          refreshAccountDetails();
        })}
        onSaveProfile={(info) => run(() => authService.updateProfileDetails(user.uid, info))}
        onSavePhoto={async (file) => {
          await run(() => authService.uploadProfilePhoto(user.uid, file));
        }}
        onLogout={onLogout}
      />
    );
  } else {
    // Profil absent ou incomplet : demande les informations obligatoires.
    // C'est notamment l'étape qui suit une première inscription avec Google.
    content = <CompleteProfile key={user.uid} busy={busy} error={error}
      onComplete={(info) => void run(() => authService.completeProfile(user.uid, info))} onLogout={onLogout} />;
  }

  // IonApp est la racine Ionic ; chaque écran fournit sa propre structure PageLayout.
  return <IonApp>{content}</IonApp>;
};

export default App;
