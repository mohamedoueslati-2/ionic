import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { filmOutline, heartOutline, peopleOutline, play } from 'ionicons/icons';
import PageLayout from './PageLayout';

export default function AuthLayout({ title, subtitle, busy, error, icon, children }: { title: string; subtitle: string; busy: boolean; error?: string; icon?: string; children: ReactNode }) {
  return <PageLayout title={title} busy={busy} auth wide>
    <div className="auth-layout">
      <aside className="auth-story">
        <p className="eyebrow">A LITTLE CINEMA. A LOT OF CONNECTION.</p>
        <div className="cinema-art" aria-hidden="true"><div className="cinema-frame"><IonIcon icon={play} /><div className="cinema-timeline"><span /></div></div><span className="art-orbit orbit-heart"><IonIcon icon={heartOutline} /></span><span className="art-orbit orbit-people"><IonIcon icon={peopleOutline} /></span><span className="art-caption"><IonIcon icon={filmOutline} /> ONE SHARED FAVORITE AT A TIME</span></div>
        <h2>Good stories.<br />Great connections.</h2>
        <p>Find the films you love.<br />Meet the people who love them too.</p>
        <span className="auth-tagline">Your movies. Your people.</span>
      </aside>
      <section className="auth-form-panel">
        <div className="auth-form-heading">{icon && <span className="state-icon"><IonIcon icon={icon} aria-hidden="true" /></span>}<p className="eyebrow">YOUR NEXT CHAPTER</p><h1>{title}</h1><p>{subtitle}</p></div>
        {error && <div className="error-notice" role="alert">{error}</div>}
        {children}
      </section>
    </div>
  </PageLayout>;
}
