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
import { gridOutline, heartOutline, homeOutline, peopleOutline, personOutline } from 'ionicons/icons';
import Dashboard from '../pages/Dashboard';
import Favorites from '../pages/Favorites';
import Home from '../pages/Home';
import Matching from '../pages/Matching';
import Profile from '../pages/Profile';
import type { AccountSecurityProps, PersonalInfo, UserProfile } from '../types/auth';
import FavoritesProvider from './FavoritesProvider';

// Les actions du profil sont transmises depuis App, qui conserve la logique Firebase.
interface Props extends AccountSecurityProps {
  uid: string;
  profile: UserProfile;
  onSaveProfile: (info: PersonalInfo) => Promise<boolean>;
  onSavePhoto: (file: File) => Promise<void>;
  onLogout: () => void;
}

function TabsContent(props: Props) {
  const isAdmin = props.profile.role === 'ADMIN';
  const canUseFavorites = props.profile.role === 'USER' && props.profile.status === 'ACTIVE' && props.profile.profileCompleted === true;
  const defaultTab = isAdmin ? 'dashboard' : 'home';
  return (
    <FavoritesProvider key={props.uid} uid={props.uid} enabled={canUseFavorites}>
      <IonTabs>
        {/* Routes relatives : le routeur parent prend déjà en charge le préfixe /tabs. */}
        <IonRouterOutlet>
          {(isAdmin ? [
            <Route key="dashboard" path="/tabs/dashboard" element={<Dashboard />} />,
          ] : [
            <Route key="home" path="/tabs/home" element={<Home />} />,
            ...(canUseFavorites ? [<Route key="favorites" path="/tabs/favorites" element={<Favorites />} />] : []),
            <Route key="matching" path="/tabs/matching" element={<Matching />} />,
          ])}
          <Route path="/tabs/profile" element={<Profile {...props} />} />
          <Route path="*" element={<Navigate to={`/tabs/${defaultTab}`} replace />} />
        </IonRouterOutlet>

        {/* Barre inférieure Ionic : chaque bouton est associé à son onglet et à son URL. */}
        <IonTabBar slot="bottom">
          {(isAdmin ? [<IonTabButton key="dashboard" tab="dashboard" href="/tabs/dashboard">
            <IonIcon icon={gridOutline} aria-hidden="true" />
            <IonLabel>Dashboard</IonLabel>
          </IonTabButton>] : [
            <IonTabButton key="home" tab="home" href="/tabs/home">
              <IonIcon icon={homeOutline} aria-hidden="true" />
              <IonLabel>Home</IonLabel>
            </IonTabButton>,
            ...(canUseFavorites ? [<IonTabButton key="favorites" tab="favorites" href="/tabs/favorites">
              <IonIcon icon={heartOutline} aria-hidden="true" />
              <IonLabel>Favorites</IonLabel>
            </IonTabButton>] : []),
            <IonTabButton key="matching" tab="matching" href="/tabs/matching">
              <IonIcon icon={peopleOutline} aria-hidden="true" />
              <IonLabel>Matching</IonLabel>
            </IonTabButton>])}
          <IonTabButton tab="profile" href="/tabs/profile">
            <IonIcon icon={personOutline} aria-hidden="true" />
            <IonLabel>Profile</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </FavoritesProvider>
  );
}

// Ce routeur n'est monté que pour un utilisateur connecté dont le profil est complet.
export default function MainTabs(props: Props) {
  return (
    <IonReactRouter>
      <TabsContent {...props} />
    </IonReactRouter>
  );
}
