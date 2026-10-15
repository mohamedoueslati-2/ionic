import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import type { PersonalInfo, SignupInfo } from '../types/auth';

// Ce service regroupe les appels Firebase ; les pages s'occupent de l'affichage.

// Vérifie le prénom, le nom et un âge entier entre 1 et 120 avant l'enregistrement.
function validatePersonalInfo(info: PersonalInfo) {
  const age = Number(info.age);
  if (!info.firstName.trim() || !info.lastName.trim() ||
      !Number.isInteger(age) || age < 1 || age > 120) {
    throw new Error('Please enter valid personal information');
  }
  // trim() retire les espaces au début et à la fin des noms.
  return {
    firstName: info.firstName.trim(),
    lastName: info.lastName.trim(),
    age,
  };
}

// Connexion à un compte existant avec l'email et le mot de passe.
export async function login(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  // Garde la copie de l'email du profil cohérente avec Firebase Authentication.
  await syncAccountEmail(user);
}

// Firebase envoie un lien de réinitialisation ; aucun mot de passe n'est stocké ici.
export async function requestPasswordReset(email: string) {
  if (!email.trim()) throw new Error('Please enter your email address');
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    // La réponse reste identique si l'adresse n'existe pas.
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'auth/user-not-found') return;
    throw err;
  }
}

// Récupère le compte connecté ; son email reste inchangé pendant ces opérations.
function requireAccount() {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Please sign in again');
  return user;
}

// Confirme l'identité avec le mot de passe MovieMatch existant ou avec Google.
async function confirmAccount(currentPassword: string) {
  const user = requireAccount();
  if (user.providerData.some((provider) => provider.providerId === 'password')) {
    if (!currentPassword) throw new Error('Please enter your current password');
    const credential = EmailAuthProvider.credential(user.email!, currentPassword);
    await reauthenticateWithCredential(user, credential);
  } else if (user.providerData.some((provider) => provider.providerId === 'google.com')) {
    await reauthenticateWithPopup(user, googleProvider);
  } else {
    throw new Error('This sign-in method cannot update a MovieMatch password');
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error('Please sign in again');
  return user;
}

export async function changeAccountPassword(currentPassword: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error('Password must contain at least 6 characters');
  const user = await confirmAccount(currentPassword);
  if (user.providerData.some((provider) => provider.providerId === 'password')) {
    await updatePassword(user, newPassword);
  } else {
    // Ajoute une connexion email/mot de passe au même compte Google, sans changer son uid.
    const credential = EmailAuthProvider.credential(user.email!, newPassword);
    await linkWithCredential(user, credential);
  }
}

// Firebase Auth reste la source de l'email affiché ; les formulaires ne le modifient pas.
async function syncAccountEmail(user: User) {
  if (auth.currentUser?.uid !== user.uid) throw new Error('Please sign in again');
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists() && snapshot.data().email !== user.email) {
    await updateDoc(ref, { email: user.email });
  }
}

// Inscription par email : vérifie d'abord les informations obligatoires.
export async function signup(info: SignupInfo) {
  const personalInfo = validatePersonalInfo(info);
  // Firebase Auth crée le compte et connecte automatiquement l'utilisateur.
  const { user } = await createUserWithEmailAndPassword(auth, info.email, info.password);
  // Le document users/{uid} relie le profil au compte grâce à son identifiant unique.
  // Le mot de passe reste géré par Firebase Auth ; il n'est pas enregistré ici.
  await setDoc(doc(db, 'users', user.uid), {
    ...personalInfo,
    email: user.email,
    role: 'USER',
    status: 'ACTIVE',
    profileCompleted: true, // Les informations ont déjà été saisies et validées.
    createdAt: serverTimestamp(), // Date fournie par le serveur Firestore.
  });
}

// Même action pour la connexion et l'inscription Google : Firebase choisit selon le compte.
export async function googleLogin() {
  // Ouvre Google et récupère l'utilisateur après son authentification.
  const { user } = await signInWithPopup(auth, googleProvider);
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  // Crée un profil uniquement s'il n'existe pas, pour conserver les données existantes.
  if (!snapshot.exists()) {
    await setDoc(ref, {
      firstName: '',
      lastName: '',
      age: null,
      email: user.email,
      role: 'USER',
      status: 'ACTIVE',
      profileCompleted: false, // Le prénom, le nom et l'âge doivent encore être saisis.
      createdAt: serverTimestamp(),
    });
  }
}

// Valide et complète le profil ; useAuth détecte ensuite la modification en temps réel.
export async function completeProfile(uid: string, info: PersonalInfo) {
  await updateDoc(doc(db, 'users', uid), {
    ...validatePersonalInfo(info),
    profileCompleted: true,
  });
}

// Modifie uniquement les informations personnelles du compte connecté.
export async function updateProfileDetails(uid: string, info: PersonalInfo) {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('Unauthorized');
  }

  // Réutilise les mêmes règles que l'inscription, sans modifier le rôle ni le statut.
  await updateDoc(doc(db, 'users', uid), {
    ...validatePersonalInfo(info),
    updatedAt: serverTimestamp(),
  });
}

// Vérifie le compte connecté et le fichier avant de téléverser la photo vers Cloudinary.
export async function uploadProfilePhoto(uid: string, file: File) {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('Unauthorized');
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPG, PNG and WEBP are allowed');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Maximum file size is 5 MB');
  }

  // Envoie le fichier et le nom du preset Cloudinary sous forme de données multipart.
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'moviematch_profiles');

  const response = await fetch('https://api.cloudinary.com/v1_1/lzdqtrpf/image/upload', {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Upload failed');
  }

  // Firestore conserve l'URL HTTPS ; le fichier image reste hébergé chez Cloudinary.
  await updateDoc(doc(db, 'users', uid), { photoURL: result.secure_url });
}

// Ferme la session ; useAuth détecte la déconnexion et App affiche Login.
export async function logout() {
  await signOut(auth);
}
