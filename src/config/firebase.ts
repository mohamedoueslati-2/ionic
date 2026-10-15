
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Vite lit ces identifiants dans le fichier .env à la racine du projet.
// Le préfixe VITE_ permet de les utiliser dans le code de l'application.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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
