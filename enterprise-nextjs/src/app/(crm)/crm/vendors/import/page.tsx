import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@/server/vendors/import-export";
import { ImportWizard } from "../_components/import-wizard";
import s from "../_components/vendors.module.css";
import { getActor, permsOf } from "../_lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import vendors" };

export default async function VendorImportPage() {
  const perms = permsOf(await getActor());
  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">Supply network</div><h1>Import vendors</h1></div>
        <Link href={"/crm/vendors" as Route} className="button secondary small">Back to vendors</Link>
      </div>
      {perms.import ? (
        <>
          <p className={s.muted}>
            Upload a CSV, map its columns, review the per-row validation (errors and duplicates are skipped, never overwritten), then import.
            Up to {MAX_IMPORT_BYTES / 1024 / 1024} MB and {MAX_IMPORT_ROWS.toLocaleString()} rows per file. <a className={s.linkBtn} href="/api/vendors/import/template">Download the template</a>.
          </p>
          <ImportWizard />
        </>
      ) : <p className="error">You do not have permission to import vendors.</p>}
    </main>
  );
}
