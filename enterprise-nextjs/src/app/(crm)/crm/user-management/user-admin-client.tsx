"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Power, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { changePasswordAction, createUserAction, toggleUserAction } from "./actions";

/*
 * Client wrappers around the existing user-management Server Actions (unchanged). The actions throw on
 * failure; in production Next.js hides the thrown message, so failures show a generic, actionable toast
 * and the form keeps what the administrator typed.
 */
const FAILED = "The change was not saved. Check the details (unique username and email, password of at least 12 characters) and try again.";

export function AddUserButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <button type="button" className="button" onClick={() => setOpen(true)}><UserPlus size={15} aria-hidden="true" />Add user</button>
      {open ? (
        <Modal
          title="Register user" description="Creates the Supabase login and the CRM profile together. Share the temporary password securely."
          onClose={() => setOpen(false)} busy={pending}
          footer={<>
            <button type="button" className="button secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
            <button type="submit" form="register-user" className="button" disabled={pending}>{pending ? "Creating…" : "Create user"}</button>
          </>}
        >
          <form
            id="register-user" ref={formRef} className="form-grid cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                try {
                  await createUserAction(fd);
                  toast.success(`User ${String(fd.get("name"))} created.`);
                  setOpen(false);
                  router.refresh();
                } catch {
                  toast.error(FAILED);
                }
              });
            }}
          >
            <div className="field"><label htmlFor="ru-name">Full name<span className="req" aria-hidden="true">*</span></label><input id="ru-name" name="name" required minLength={2} maxLength={120} autoComplete="off" /></div>
            <div className="field"><label htmlFor="ru-username">Username<span className="req" aria-hidden="true">*</span></label><input id="ru-username" name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9._\-]{3,40}" autoComplete="off" /><span className="hint">3–40 letters, numbers, dot, dash or underscore.</span></div>
            <div className="field"><label htmlFor="ru-email">Work email<span className="req" aria-hidden="true">*</span></label><input id="ru-email" name="email" type="email" required autoComplete="off" /></div>
            <div className="field"><label htmlFor="ru-password">Temporary password<span className="req" aria-hidden="true">*</span></label><input id="ru-password" name="password" type="password" minLength={12} maxLength={256} required autoComplete="new-password" /><span className="hint">At least 12 characters.</span></div>
            <div className="field"><label htmlFor="ru-location">Location</label><input id="ru-location" name="location" maxLength={120} /></div>
            <div className="field">
              <label htmlFor="ru-role">Role</label>
              <select id="ru-role" name="role" defaultValue="USER"><option value="USER">User — sees assigned leads</option><option value="ADMIN">Admin — full access</option></select>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function UserRowActions({ id, name, enabled, isSelf }: { id: string; name: string; enabled: boolean; isSelf: boolean }) {
  const [dialog, setDialog] = useState<null | "toggle" | "password">(null);
  const [pending, start] = useTransition();
  const [mismatch, setMismatch] = useState(false);
  const router = useRouter();
  const fd = (extra: Record<string, string>) => { const f = new FormData(); f.set("id", id); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

  return (
    <div className="row-actions">
      <button type="button" className="button ghost small" disabled={!enabled || pending} onClick={() => setDialog("password")} title={enabled ? "Set a new password" : "Enable the account first"}>
        <KeyRound size={14} aria-hidden="true" />Password
      </button>
      <button
        type="button" className={`button ghost small${enabled ? " danger-text" : ""}`} disabled={pending || (isSelf && enabled)}
        onClick={() => setDialog("toggle")} title={isSelf && enabled ? "You cannot disable your own account" : undefined}
      >
        <Power size={14} aria-hidden="true" />{enabled ? "Disable" : "Enable"}
      </button>

      {dialog === "toggle" ? (
        <ConfirmDialog
          title={enabled ? "Disable user" : "Enable user"} confirmLabel={enabled ? "Disable user" : "Enable user"} destructive={enabled}
          message={enabled ? <><strong>{name}</strong> will be signed out of the CRM on their next request and cannot sign in until re-enabled.</> : <>Allow <strong>{name}</strong> to sign in again?</>}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try { await toggleUserAction(fd({})); toast.success(`${name} ${enabled ? "disabled" : "enabled"}.`); router.refresh(); return true; }
            catch { toast.error("The account status was not changed. Please try again."); return false; }
          }}
        />
      ) : null}

      {dialog === "password" ? (
        <Modal
          title="Change password" description={`Set a new password for ${name}. They will use it at their next sign-in.`}
          onClose={() => setDialog(null)} busy={pending}
          footer={<>
            <button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={pending}>Cancel</button>
            <button type="submit" form={`pw-${id}`} className="button" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
          </>}
        >
          <form
            id={`pw-${id}`} className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const password = String(f.get("password") ?? "");
              if (password !== String(f.get("confirm") ?? "")) { setMismatch(true); return; }
              start(async () => {
                try { await changePasswordAction(fd({ password })); toast.success(`Password updated for ${name}.`); setDialog(null); }
                catch { toast.error("The password was not changed. It must be at least 12 characters and the account must be enabled."); }
              });
            }}
          >
            <div className="field"><label htmlFor={`pw-new-${id}`}>New password</label><input id={`pw-new-${id}`} name="password" type="password" minLength={12} maxLength={256} required autoComplete="new-password" onChange={() => setMismatch(false)} /><span className="hint">At least 12 characters.</span></div>
            <div className="field"><label htmlFor={`pw-confirm-${id}`}>Confirm password</label><input id={`pw-confirm-${id}`} name="confirm" type="password" minLength={12} maxLength={256} required autoComplete="new-password" aria-invalid={mismatch} onChange={() => setMismatch(false)} />{mismatch ? <span className="error" role="alert">Passwords do not match.</span> : null}</div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
