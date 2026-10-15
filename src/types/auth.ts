// Structure des informations saisies dans les formulaires.
export interface PersonalInfo {
  firstName: string;
  lastName: string;
  age: string; // Un champ HTML fournit du texte ; le service convertit l'âge en nombre.
}

// L'inscription par email demande aussi une adresse et un mot de passe.
export interface SignupInfo extends PersonalInfo {
  email: string;
  password: string;
}

// Structure du profil lu dans Firestore. « ? » indique un champ facultatif.
export interface UserProfile {
  firstName?: string;
  lastName?: string;
  age?: number | null;
  photoURL?: string;
  status?: string;
  profileCompleted?: boolean; // App affiche Home uniquement si cette valeur est vraie.
}

// Propriété commune aux pages : bloque les actions pendant une requête Firebase.
export interface ActionProps {
  busy: boolean;
  error?: string; // Message affiché par la structure Ionic de la page.
}
