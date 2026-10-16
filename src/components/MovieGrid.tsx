import type { ReactNode } from 'react';

export default function MovieGrid({ children }: { children: ReactNode }) {
  return <div className="movie-grid">{children}</div>;
}
