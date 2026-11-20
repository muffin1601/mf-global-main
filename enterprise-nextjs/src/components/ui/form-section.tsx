import type { ReactNode } from "react";

/**
 * A titled group of form fields. Use several inside <FormCard> for long, full-page forms
 * (quotations, settings). `split` puts the title/description beside the fields on wide screens.
 * The fields themselves use the global `.form-grid` / `.field` classes.
 */
export function FormSection({ title, description, children, split, columns }: {
  title: string; description?: ReactNode; children: ReactNode; split?: boolean; columns?: 1 | 2 | 3;
}) {
  const grid = `form-grid${columns && columns > 1 ? ` cols-${columns}` : ""}`;
  return (
    <fieldset className={`form-section${split ? " split" : ""}`} style={{ border: 0, margin: 0, minWidth: 0 }}>
      <div>
        <legend className="form-section-title" style={{ padding: 0 }}>{title}</legend>
        {description ? <p className="form-section-desc">{description}</p> : null}
      </div>
      <div className={grid}>{children}</div>
    </fieldset>
  );
}

/** Card wrapper for one or more FormSections, with an optional sticky footer for actions. */
export function FormCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="form-section-card">
      {children}
      {footer ? <div className="dialog-foot" style={{ borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" }}>{footer}</div> : null}
    </div>
  );
}
