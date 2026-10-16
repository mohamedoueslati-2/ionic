import type { ReactNode } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonProgressBar, IonToolbar } from '@ionic/react';
import { filmOutline, personOutline, warningOutline } from 'ionicons/icons';
import ThemeToggle from './ThemeToggle';

interface Props {
  title: string;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
  wide?: boolean;
  auth?: boolean;
  profileShortcut?: boolean;
}

export default function PageLayout({ title, busy = false, error, children, wide = false, auth = false, profileShortcut = false }: Props) {
  return <IonPage className={auth ? 'auth-page' : 'app-page'}>
    <IonHeader className="app-header ion-no-border">
      <IonToolbar>
        <div className="brand" slot="start" aria-label="MovieMatch">
          <span className="brand-mark"><IonIcon icon={filmOutline} aria-hidden="true" /></span>
          <span>Movie<span className="brand-accent">Match</span></span>
          {title.includes('Admin') && <span className="admin-label">ADMIN</span>}
        </div>
        <IonButtons slot="end">
          <ThemeToggle />
          {profileShortcut && <IonButton className="profile-shortcut" routerLink="/tabs/profile" routerDirection="none" aria-label="Open your profile">
            <IonIcon slot="icon-only" icon={personOutline} aria-hidden="true" />
          </IonButton>}
        </IonButtons>
      </IonToolbar>
      {busy && <IonProgressBar type="indeterminate" aria-label="Loading" />}
    </IonHeader>
    <IonContent>
      <div className={`page-shell${wide ? ' page-shell-wide' : ''}${auth ? ' auth-shell' : ''}`} aria-label={title}>
        {error && <div className="error-notice" role="alert"><IonIcon icon={warningOutline} aria-hidden="true" /><span>{error}</span></div>}
        {children}
      </div>
    </IonContent>
  </IonPage>;
}
