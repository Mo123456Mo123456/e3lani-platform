import type { ReactNode } from "react";

export function Panel({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="pg-panel">
      {(title || actions) && (
        <header className="pg-panel-head">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      <div className="pg-panel-body">{children}</div>
    </section>
  );
}
