"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

// Friendly boundary for unexpected CRM errors. The message is deliberately generic (no stack, no SQL);
// the digest lets an administrator correlate the report with the server log.
export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("crm: render error", error.digest ?? ""); }, [error]);
  return (
    <main className="page">
      <section className="card" style={{ maxWidth: 560, margin: "48px auto" }}>
        <ErrorState
          description="The page could not be loaded. Your data has not been changed."
          reference={error.digest}
          action={(
            <div className="button-group" style={{ marginTop: 8, justifyContent: "center" }}>
              <button className="button" onClick={reset} type="button"><RotateCcw size={15} aria-hidden="true" />Try again</button>
              <Link className="button secondary" href="/crm/entrydashboard">Go to dashboard</Link>
            </div>
          )}
        />
      </section>
    </main>
  );
}
