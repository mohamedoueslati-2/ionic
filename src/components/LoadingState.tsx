import { IonSpinner } from '@ionic/react';

export default function LoadingState({ label = 'Loading', skeletons = false }: { label?: string; skeletons?: boolean }) {
  return <div role="status" className="loading-state">
    <div className="loading-caption"><IonSpinner name="crescent" aria-label={label} /><span>{label}…</span></div>
    {skeletons && <div className="movie-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div className="movie-skeleton" key={i}><div /><span /><span /></div>)}</div>}
  </div>;
}
