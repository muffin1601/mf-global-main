"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteQuotationAction } from "./actions";

export function DeleteQuotationButton({ id, number }: { id: string; number: string }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button" className="icon-btn" disabled={pending} onClick={() => setAsking(true)}
        aria-label={`Delete quotation ${number}`} title="Delete" style={{ color: "var(--danger)" }}
      >
        <Trash2 size={15} />
      </button>
      {asking ? (
        <ConfirmDialog
          title="Delete quotation" confirmLabel="Delete quotation" destructive onClose={() => setAsking(false)}
          message={<>Delete quotation <strong>{number}</strong>? This cannot be undone.</>}
          onConfirm={() => new Promise<boolean>((resolve) => start(async () => {
            const r = await deleteQuotationAction(id);
            if (r.ok) { toast.success("Quotation deleted"); router.refresh(); resolve(true); } else { toast.error(r.error); resolve(false); }
          }))}
        />
      ) : null}
    </>
  );
}
