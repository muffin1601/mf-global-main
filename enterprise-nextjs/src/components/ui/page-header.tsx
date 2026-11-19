import type { ReactNode } from "react";

/** Standard page heading: optional context line, title, description and right-aligned primary actions. */
export function PageHeader({ title, description, eyebrow, actions, meta }: {
  title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; meta?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="button-group" style={{ marginTop: 10 }}>{meta}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
