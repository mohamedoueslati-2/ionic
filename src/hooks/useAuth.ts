import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AccountDetails, UserProfile } from '../types/auth';

// Copie les valeurs d'affichage : l'objet User de Firebase peut être modifié sur place.
function accountDetails(user: User | null): AccountDetails {
  return {
    email: user?.email ?? null,
    providerIds: user?.providerData.map((provider) => provider.providerId) ?? [],
  };
}

// Hook partagé : suit la session Firebase Auth et le profil associé dans Firestore.
export function useAuth() {
  // user = compte connecté ; profile = informations complémentaires de ce compte.
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<AccountDetails>(() => accountDetails(null));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // Attend la première réponse de Firebase.
  const [error, setError] = useState('');

  // Installe les abonnements au montage du composant qui utilise ce hook.
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let stopProfile: (() => void) | undefined;
    // Appelé au démarrage, à la connexion et à la déconnexion.
    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      if (disposed) return;
      const currentGeneration = ++generation;
      // Arrête le suivi du précédent profil et efface ses données de l'état React.
      stopProfile?.();
      stopProfile = undefined;
      setUser(currentUser);
      setAccount(accountDetails(currentUser));
      setProfile(null);
      setError('');
      setLoading(Boolean(currentUser));

      if (!currentUser) return; // Sans session, il n'y a aucun profil à suivre.
      const isCurrent = () => !disposed && generation === currentGeneration && auth.currentUser?.uid === currentUser.uid;

      // Écoute users/{uid} : un profil complété ou désactivé actualise l'affichage.
      stopProfile = onSnapshot(doc(db, 'users', currentUser.uid), { includeMetadataChanges: true }, (snapshot) => {
        if (!isCurrent()) return;
        // A local signup/completion snapshot can precede a rejected profile write.
        // Keep the last confirmed profile until the server acknowledges the change.
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        setProfile((snapshot.data() as UserProfile | undefined) ?? null);
        setError('');
        setLoading(false);
      }, (err) => {
        if (!isCurrent()) return;
        // Transmet les erreurs de lecture Firestore à App.
        setError(err.message);
        setLoading(false);
      });
    }, (err) => {
      if (disposed) return;
      ++generation;
      stopProfile?.();
      setProfile(null);
      // Transmet les erreurs de suivi de la session à App.
      setError(err.message);
      setLoading(false);
    });

    // Nettoyage : retire les abonnements quand le composant est démonté.
    return () => {
      disposed = true;
      ++generation;
      stopAuth();
      stopProfile?.();
    };
  }, []);

  // Le SDK met déjà User à jour après la modification ou l'ajout d'un mot de passe.
  // Copie ces valeurs pour l'affichage sans ajouter de requête qui pourrait masquer la réussite.
  function refreshAccountDetails() {
    setAccount(accountDetails(auth.currentUser));
  }

  // App utilise ces valeurs pour choisir la page à afficher.
  return { user, account, profile, loading, error, refreshAccountDetails };
}
