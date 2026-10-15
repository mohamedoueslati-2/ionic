import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Navigate, Route } from 'react-router-dom';
import { homeOutline, peopleOutline, personOutline } from 'ionicons/icons';
import Home from '../pages/Home';
import Matching from '../pages/Matching';
import Profile from '../pages/Profile';
import type { AccountSecurityProps, PersonalInfo, UserProfile } from '../types/auth';

// Les actions du profil sont transmises depuis App, qui conserve la logique Firebase.
interface Props extends AccountSecurityProps {
  profile: UserProfile;
  onSaveProfile: (info: PersonalInfo) => Promise<boolean>;
  onSavePhoto: (file: File) => Promise<void>;
  onLogout: () => void;
}

function TabsContent(props: Props) {
  return (
    <IonTabs>
      {/* Routes relatives : le routeur parent prend déjà en charge le préfixe /tabs. */}
      <IonRouterOutlet>
        <Route path="home" element={<Home />} />
        <Route path="matching" element={<Matching />} />
        <Route path="profile" element={<Profile {...props} />} />
        <Route index element={<Navigate to="home" replace />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </IonRouterOutlet>

      {/* Barre inférieure Ionic : chaque bouton est associé à son onglet et à son URL. */}
      <IonTabBar slot="bottom">
        <IonTabButton tab="home" href="/tabs/home">
          <IonIcon icon={homeOutline} aria-hidden="true" />
          <IonLabel>Home</IonLabel>
        </IonTabButton>
        <IonTabButton tab="matching" href="/tabs/matching">
          <IonIcon icon={peopleOutline} aria-hidden="true" />
          <IonLabel>Matching</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/tabs/profile">
          <IonIcon icon={personOutline} aria-hidden="true" />
          <IonLabel>Profile</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

// Ce routeur n'est monté que pour un utilisateur connecté dont le profil est complet.
export default function MainTabs(props: Props) {
  return (
    <IonReactRouter>
      <IonRouterOutlet>
        <Route path="/tabs/*" element={<TabsContent {...props} />} />
        <Route path="*" element={<Navigate to="/tabs/home" replace />} />
      </IonRouterOutlet>
    </IonReactRouter>
  );
}
