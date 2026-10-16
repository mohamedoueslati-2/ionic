import type { ReactNode } from 'react';

interface Props { title: string; subtitle?: string; eyebrow?: string; action?: ReactNode; }

export default function SectionHeader({ title, subtitle, eyebrow, action }: Props) {
  return <div className="section-header">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="section-subtitle">{subtitle}</p>}</div>
    {action && <div className="section-action">{action}</div>}
  </div>;
}
