import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
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
  await signInWithEmailAndPassword(auth, email, password);
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
