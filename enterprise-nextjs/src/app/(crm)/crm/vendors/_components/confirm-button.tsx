"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "../actions";
import s from "./vendors.module.css";

type Props = {
  label: string;
  action: () => Promise<ActionResult>;
  confirm?: string;
  danger?: boolean;
  className?: string;
};

/** A button that runs a Server Action (after an optional in-app confirmation) and refreshes the page. */
export function ActionButton({ label, action, confirm, danger, className }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  const run = () => new Promise<boolean>((resolve) => start(async () => {
    const r = await action();
    if (!r.ok) { toast.error(r.error); resolve(false); return; }
    toast.success(r.message ?? "Done");
    if (r.redirect) router.push(r.redirect as Route);
    else router.refresh();
    resolve(true);
  }));

  return (
    <>
      <button
        type="button"
        className={className ?? `${s.linkBtn} ${danger ? s.linkDanger : ""}`}
        disabled={pending}
        aria-busy={pending}
        onClick={() => { if (confirm) setAsking(true); else void run(); }}
      >
        {pending ? "Working…" : label}
      </button>
      {asking ? (
        <ConfirmDialog
          title={label} message={confirm} confirmLabel={label} destructive={danger}
          onClose={() => setAsking(false)} onConfirm={run}
        />
      ) : null}
    </>
  );
}
