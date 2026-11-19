"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog used across the CRM.
 * - moves focus into the dialog (first form control, else the dialog) and returns it on close
 * - traps Tab / Shift+Tab inside the dialog, closes on Escape and on backdrop click
 * - locks page scroll while open; renders as a bottom sheet on phones (see globals.css)
 * `busy` blocks every close path while a save is in flight.
 */
export function Modal({ title, description, onClose, children, footer, wide, busy, labelledBy }: {
  title: string; description?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
  wide?: boolean; busy?: boolean; labelledBy?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const body = node?.querySelector<HTMLElement>(".dialog-body");
    const first = node?.querySelector<HTMLElement>("[data-autofocus]")
      ?? body?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])");
    (first ?? node)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); if (!busyRef.current) closeRef.current(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const head = items[0]!, tail = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  // Portalled to <body> so page layout rules and ancestor stacking contexts never affect the dialog.
  // On the server (e.g. a ?create= deep link renders the dialog on first paint) nothing is emitted.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div
        ref={ref} tabIndex={-1} className={`dialog${wide ? " wide" : ""}`} role="dialog" aria-modal="true"
        aria-labelledby={labelledBy ?? titleId} aria-describedby={description ? descId : undefined}
      >
        <div className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descId}>{description}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={16} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

const noopSubscribe = () => () => {};
