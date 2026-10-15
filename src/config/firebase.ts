
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB6f0qWwjF8_m07W3G3RGudEbnCMwa8Xns",
  authDomain: "moviematch-de147.firebaseapp.com",
  projectId: "moviematch-de147",
  storageBucket: "moviematch-de147.firebasestorage.app",
  messagingSenderId: "1069589137414",
  appId: "1:1069589137414:web:9c4435b0d9f281e8011b87"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
