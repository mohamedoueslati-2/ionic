import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { filmOutline } from 'ionicons/icons';

export default function EmptyState({ title, description, icon = filmOutline, children }: { title: string; description?: string; icon?: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="state-icon"><IonIcon icon={icon} aria-hidden="true" /></span><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>;
}
