"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import type { ActionResult, DuplicateView } from "../actions";
import s from "./vendors.module.css";

export type Field =
  | { kind: "section"; label: string }
  | {
      kind?: "text" | "email" | "tel" | "number" | "date" | "datetime-local" | "select" | "textarea" | "checkbox" | "file" | "hidden";
      name: string;
      label?: string;
      options?: readonly (readonly [string, string])[];
      required?: boolean;
      defaultValue?: string | number | boolean | null;
      placeholder?: string;
      step?: string;
      min?: string | number;
      max?: string | number;
      help?: string;
      full?: boolean;
      accept?: string;
      autoComplete?: string;
    };

type Props = {
  trigger: string;
  title: string;
  fields: Field[];
  /** Server Action (FormData) -> result. Either `action` or `endpoint` must be provided. */
  action?: (fd: FormData) => Promise<ActionResult>;
  /** multipart endpoint for file uploads (Route Handler returning { ok, error }). */
  endpoint?: { url: string; method: "POST" | "PUT" };
  /** Optional duplicate pre-check (create/edit vendor form). */
  duplicateCheck?: (candidate: Record<string, string>) => Promise<ActionResult<{ blocking: DuplicateView[]; warnings: DuplicateView[] }>>;
  submitLabel?: string;
  wide?: boolean;
  triggerClass?: string;
  success?: string;
};

export function ModalForm({ trigger, title, fields, action, endpoint, duplicateCheck, submitLabel = "Save", wide, triggerClass = "button small", success }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<{ list: DuplicateView[]; blocking: boolean } | null>(null);

  const open = () => { setError(null); setDupes(null); ref.current?.showModal(); };
  const close = () => ref.current?.close();

  const submit = (confirmDuplicate: boolean) => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    if (confirmDuplicate) fd.set("confirmDuplicate", "true");
    // Unchecked checkboxes are absent from FormData; make "off" explicit so edits can clear flags.
    for (const f of fields) if ("name" in f && f.kind === "checkbox" && !fd.has(f.name)) fd.set(f.name, "off");
    setError(null);
    start(async () => {
      let result: ActionResult;
      try {
        if (endpoint) {
          const res = await fetch(endpoint.url, { method: endpoint.method, body: fd });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          result = res.ok && body.ok !== false ? { ok: true } : { ok: false, error: body.error ?? "Upload failed" };
        } else if (action) result = await action(fd);
        else return;
      } catch {
        result = { ok: false, error: "Network error. Please try again." };
      }
      if (!result.ok) {
        setError(result.error);
        setDupes(result.duplicates?.length ? { list: result.duplicates, blocking: !!result.blocking } : null);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? success ?? "Saved");
      close();
      formRef.current?.reset();
      if (result.redirect) router.push(result.redirect as Route);
      else router.refresh();
    });
  };

  const check = () => {
    if (!duplicateCheck || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const candidate = Object.fromEntries(["name", "gstin", "pan", "email", "phone"].map((k) => [k, String(fd.get(k) ?? "")]));
    start(async () => {
      const r = await duplicateCheck(candidate);
      if (!r.ok) { toast.error(r.error); return; }
      const list = [...r.blocking, ...r.warnings];
      setDupes(list.length ? { list, blocking: r.blocking.length > 0 } : null);
      if (!list.length) toast.success("No duplicates found");
    });
  };

  return (
    <>
      <button type="button" className={triggerClass} onClick={open}>{trigger}</button>
      <dialog ref={ref} className={`${s.dialog} ${wide ? s.dialogWide : ""}`} onClick={(e) => { if (e.target === ref.current) close(); }}>
        <form ref={formRef} className={s.dialogForm} onSubmit={(e) => { e.preventDefault(); submit(false); }}>
          <div className={s.dialogHead}><h2>{title}</h2><button type="button" className={s.linkBtn} onClick={close} aria-label="Close">Close</button></div>
          <div className={s.dialogBody}>
            <div className={s.grid}>
              {fields.map((f, i) => {
                if ("kind" in f && f.kind === "section") return <div key={`s${i}`} className={s.section}>{f.label}</div>;
                const fld = f as Exclude<Field, { kind: "section" }>;
                if (fld.kind === "hidden") return <input key={fld.name} type="hidden" name={fld.name} defaultValue={String(fld.defaultValue ?? "")} />;
                const id = `f-${fld.name}`;
                if (fld.kind === "checkbox") {
                  return (
                    <label key={fld.name} className={`${s.checkField} ${fld.full ? s.full : ""}`}>
                      <input type="checkbox" name={fld.name} defaultChecked={!!fld.defaultValue} /> {fld.label}
                    </label>
                  );
                }
                return (
                  <div key={fld.name} className={`field ${fld.full || fld.kind === "textarea" ? s.full : ""}`}>
                    <label htmlFor={id}>{fld.label}{fld.required ? " *" : ""}</label>
                    {fld.kind === "select" ? (
                      <select id={id} name={fld.name} required={fld.required} defaultValue={String(fld.defaultValue ?? "")}>
                        {fld.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : fld.kind === "textarea" ? (
                      <textarea id={id} name={fld.name} rows={3} required={fld.required} defaultValue={String(fld.defaultValue ?? "")} placeholder={fld.placeholder} />
                    ) : (
                      <input
                        id={id} name={fld.name} type={fld.kind ?? "text"} required={fld.required} placeholder={fld.placeholder} step={fld.step} min={fld.min} max={fld.max}
                        accept={fld.accept} autoComplete={fld.autoComplete ?? "off"} defaultValue={fld.kind === "file" ? undefined : String(fld.defaultValue ?? "")}
                      />
                    )}
                    {fld.help ? <span className={s.help}>{fld.help}</span> : null}
                  </div>
                );
              })}
            </div>
            {dupes ? (
              <div className={`${s.dupes} ${dupes.blocking ? s.dupesBlock : s.dupesWarn}`} role="alert">
                <strong>{dupes.blocking ? "A vendor with the same GSTIN or PAN already exists." : "Possible duplicates found."}</strong>
                <ul>{dupes.list.map((d) => <li key={d.id}>{d.vendorCode} - {d.name}{d.archived ? " (archived)" : ""}: {d.reason}</li>)}</ul>
              </div>
            ) : null}
            {error && !dupes ? <p className="error" role="alert">{error}</p> : null}
          </div>
          <div className={s.dialogFoot}>
            {duplicateCheck ? <button type="button" className="button secondary small" onClick={check} disabled={pending}>Check duplicates</button> : null}
            <button type="button" className="button secondary small" onClick={close}>Cancel</button>
            {dupes && !dupes.blocking && !error?.includes("GSTIN") ? <button type="button" className="button small" disabled={pending} onClick={() => submit(true)}>Save anyway</button> : null}
            <button type="submit" className="button small" disabled={pending}>{pending ? "Working..." : submitLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
