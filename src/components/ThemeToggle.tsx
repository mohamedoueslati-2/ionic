import { IonButton, IonIcon } from '@ionic/react';
import { moonOutline, sunnyOutline } from 'ionicons/icons';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setPreference } = useTheme();
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  return <IonButton className="theme-toggle" fill="clear" onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')} aria-label={label} title={label}>
    <IonIcon slot="icon-only" icon={theme === 'dark' ? sunnyOutline : moonOutline} aria-hidden="true" />
  </IonButton>;
}
