import type { ReactNode } from "react";

export function PageHeader({ title, meta, action, intro }: { title: string; meta?: string; action?: ReactNode; intro?: string }) {
  return (
    <header>
      <div className="ci-header">
        <h1 className="title-page">{title}</h1>
        {action ?? (meta && <span className="ci-header-meta ref">{meta}</span>)}
      </div>
      {intro && <p className="ci-header-intro body">{intro}</p>}
    </header>
  );
}
