"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteQuotationAction } from "./actions";

export function DeleteQuotationButton({ id, number }: { id: string; number: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button" className="button secondary" disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete quotation ${number}? This cannot be undone.`)) return;
        start(async () => {
          const r = await deleteQuotationAction(id);
          if (r.ok) { toast.success("Quotation deleted"); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
