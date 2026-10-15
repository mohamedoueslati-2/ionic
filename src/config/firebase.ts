
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Ces identifiants relient l'application Web à notre projet Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyB6fOqWWjF8_m07W3GgRGudEbnCMwa8Xns",
  authDomain: "moviematch-de147.firebaseapp.com",
  projectId: "moviematch-de147",
  storageBucket: "moviematch-de147.firebasestorage.app",
  messagingSenderId: "1069589137414",
  appId: "1:1069589137414:web:9c4435b0d9f281e8011b87"
};

// Initialise Firebase une fois ; les autres fichiers réutilisent les exports ci-dessous.
const app = initializeApp(firebaseConfig);

// Authentication gère les comptes et la session de l'utilisateur.
export const auth = getAuth(app);
// Firestore conserve les informations complémentaires dans la collection « users ».
export const db = getFirestore(app);
// Fournisseur utilisé pour ouvrir la fenêtre de connexion avec Google.
export const googleProvider = new GoogleAuthProvider();

export default app;
