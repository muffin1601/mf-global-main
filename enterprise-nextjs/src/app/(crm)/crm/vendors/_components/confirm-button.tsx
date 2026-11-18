"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import type { ActionResult } from "../actions";
import s from "./vendors.module.css";

type Props = {
  label: string;
  action: () => Promise<ActionResult>;
  confirm?: string;
  danger?: boolean;
  className?: string;
};

/** A button-styled-as-link that runs a Server Action after an optional confirm() and refreshes the page. */
export function ActionButton({ label, action, confirm, danger, className }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className ?? `${s.linkBtn} ${danger ? s.linkDanger : ""}`}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action();
          if (!r.ok) { toast.error(r.error); return; }
          toast.success(r.message ?? "Done");
          if (r.redirect) router.push(r.redirect as Route);
          else router.refresh();
        });
      }}
    >
      {pending ? "..." : label}
    </button>
  );
}
