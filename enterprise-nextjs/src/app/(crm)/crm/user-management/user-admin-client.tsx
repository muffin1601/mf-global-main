"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Power, UserPlus, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { changePasswordAction, createUserAction, toggleUserAction, updateUserAction } from "./actions";

/*
 * Client wrappers around the user-management Server Actions. The actions return { error } with a readable
 * reason; a thrown error (network, server crash) falls back to a generic toast. The form keeps its input.
 */
const FAILED = "The change was not saved. Please check your connection and try again.";

export function AddUserButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
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
                  const res = await createUserAction(fd);
                  if (res.error) { toast.error(res.error); return; }
                  toast.success(`User ${String(fd.get("name"))} created.`);
                  setOpen(false);
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

export function UserRowActions({ id, name, email, location, enabled, isSelf, hasAuth }: { id: string; name: string; email?: string | null; location?: string | null; enabled: boolean; isSelf: boolean; hasAuth: boolean }) {
  const [dialog, setDialog] = useState<null | "toggle" | "password" | "edit">(null);
  const [pending, start] = useTransition();
  const [mismatch, setMismatch] = useState(false);
  const fd = (extra: Record<string, string>) => { const f = new FormData(); f.set("id", id); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

  return (
    <div className="row-actions">
      <button type="button" className="button ghost small" onClick={() => setDialog("edit")} title="Edit user details">
        <Pencil size={14} aria-hidden="true" />Edit
      </button>
      <button type="button" className="button ghost small" disabled={!enabled || !hasAuth || pending} onClick={() => setDialog("password")} title={!hasAuth ? "User has no Supabase account" : enabled ? "Set a new password" : "Enable the account first"}>
        <KeyRound size={14} aria-hidden="true" />Password
      </button>
      <button
        type="button" className={`button ghost small${enabled ? " danger-text" : ""}`} disabled={pending || (isSelf && enabled)}
        onClick={() => setDialog("toggle")} title={isSelf && enabled ? "You cannot disable your own account" : undefined}
      >
        <Power size={14} aria-hidden="true" />{enabled ? "Disable" : "Enable"}
      </button>

      {dialog === "edit" ? (
        <Modal
          title="Edit user details" description={`Update information for ${name}.`}
          onClose={() => setDialog(null)} busy={pending}
          footer={<>
            <button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={pending}>Cancel</button>
            <button type="submit" form={`edit-${id}`} className="button" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
          </>}
        >
          <form
            id={`edit-${id}`} className="form-grid cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                try {
                  const res = await updateUserAction(fd({ name: String(f.get("name") || ""), email: String(f.get("email") || ""), location: String(f.get("location") || "") }));
                  if (res.error) { toast.error(res.error); return; }
                  toast.success("User details updated.");
                  setDialog(null);
                } catch {
                  toast.error(FAILED);
                }
              });
            }}
          >
            <div className="field"><label htmlFor={`edit-name-${id}`}>Full name</label><input id={`edit-name-${id}`} name="name" defaultValue={name} required minLength={2} maxLength={120} autoComplete="off" /></div>
            <div className="field"><label htmlFor={`edit-email-${id}`}>Email</label><input id={`edit-email-${id}`} name="email" type="email" defaultValue={email || ""} autoComplete="off" /></div>
            <div className="field col-full"><label htmlFor={`edit-location-${id}`}>Location</label><input id={`edit-location-${id}`} name="location" defaultValue={location || ""} maxLength={120} autoComplete="off" /></div>
          </form>
        </Modal>
      ) : null}

      {dialog === "toggle" ? (
        <ConfirmDialog
          title={enabled ? "Disable user" : "Enable user"} confirmLabel={enabled ? "Disable user" : "Enable user"} destructive={enabled}
          message={enabled ? <><strong>{name}</strong> will be signed out of the CRM on their next request and cannot sign in until re-enabled.</> : <>Allow <strong>{name}</strong> to sign in again?</>}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              const res = await toggleUserAction(fd({}));
              if (res.error) { toast.error(res.error); return false; }
              toast.success(`${name} ${enabled ? "disabled" : "enabled"}.`); return true;
            } catch { toast.error(FAILED); return false; }
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
                try {
                  const res = await changePasswordAction(fd({ password }));
                  if (res.error) { toast.error(res.error); return; }
                  toast.success(`Password updated for ${name}.`); setDialog(null);
                } catch { toast.error(FAILED); }
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
