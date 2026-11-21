"use client";
import { PasswordInput } from "@/legacy-marketing/components/PasswordInput";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, KeyRound, Trash2, UserRound, X } from "lucide-react";
import { initialsOf } from "@/components/ui/user-avatar";
import { PASSWORD_RULES, passwordProblems, passwordStrength } from "@/lib/auth/password-policy";
import type { ProfileDto } from "@/server/profile/service";
import { changeOwnPasswordAction, updateProfileAction } from "./actions";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Never");
const STRENGTH = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export function ProfileClient({ profile }: { profile: ProfileDto }) {
  return (
    <div className="profile-layout" style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", alignItems: "start" }}>
      <div className="stack" style={{ display: "grid", gap: 20 }}>
        <PhotoCard profile={profile} />
        <AccountCard profile={profile} />
      </div>
      <div className="stack" style={{ display: "grid", gap: 20 }}>
        <DetailsCard profile={profile} />
        <PasswordCard profile={profile} />
      </div>
    </div>
  );
}

function CardTitle({ icon: Icon, title, sub }: { icon: typeof Camera; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
      <span className="avatar" aria-hidden="true" style={{ width: 34, height: 34 }}><Icon size={16} /></span>
      <div><h2 style={{ margin: 0, fontSize: "1rem" }}>{title}</h2><p className="muted" style={{ margin: "2px 0 0" }}>{sub}</p></div>
    </div>
  );
}

/* ------------------------------------------------------------------ photo */
function PhotoCard({ profile }: { profile: ProfileDto }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = profile.hasAvatar ? `/api/profile/avatar/${profile.id}?v=${profile.avatarVersion ?? 0}` : null;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f: File | undefined) {
    setError("");
    if (!f) return;
    setFile(null);
    setPreview(null);
    if (!ACCEPT.split(",").includes(f.type)) { setError("Use a JPEG, PNG or WebP image."); return; }
    if (f.size > MAX_BYTES) { setError("The photo must be 2 MB or smaller."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  async function send(method: "POST" | "DELETE") {
    setBusy(true); setError("");
    try {
      const body = method === "POST" && file ? (() => { const fd = new FormData(); fd.set("photo", file); return fd; })() : undefined;
      const res = await fetch("/api/profile/avatar", { method, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "The photo could not be saved."); return; }
      toast.success(data.message ?? "Saved.");
      setFile(null); setPreview(null); if (input.current) input.current.value = "";
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally { setBusy(false); }
  }

  const shown = preview ?? current;
  return (
    <section className="card" aria-label="Profile photo">
      <CardTitle icon={Camera} title="Profile photo" sub="Shown in the top bar and next to your name. JPEG, PNG or WebP, up to 2 MB." />
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {shown
          // eslint-disable-next-line @next/next/no-img-element -- private, authenticated image route; next/image would proxy it
          ? <img src={shown} alt={preview ? "New profile photo preview" : `${profile.name}'s profile photo`} width={96} height={96} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
          : <span className="avatar" role="img" aria-label={`${profile.name} (no photo)`} style={{ width: 96, height: 96, fontSize: "1.75rem" }}>{initialsOf(profile.name)}</span>}
        <div style={{ display: "grid", gap: 8 }}>
          <input ref={input} disabled={busy} id="profile-photo" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} aria-describedby="photo-help" />
          <div className="button-group">
            <label htmlFor="profile-photo" className="button secondary small" style={{ cursor: "pointer" }}><Camera size={14} aria-hidden="true" />{profile.hasAvatar ? "Change photo" : "Upload photo"}</label>
            {file ? <button type="button" className="button small" disabled={busy} onClick={() => send("POST")}><Check size={14} aria-hidden="true" />{busy ? "Saving…" : "Save photo"}</button> : null}
            {file ? <button type="button" className="button ghost small" disabled={busy} onClick={() => { setFile(null); setPreview(null); if (input.current) input.current.value = ""; }}><X size={14} aria-hidden="true" />Cancel</button> : null}
            {!file && profile.hasAvatar ? <button type="button" className="button ghost small danger-text" disabled={busy} onClick={() => send("DELETE")}><Trash2 size={14} aria-hidden="true" />Remove photo</button> : null}
          </div>
          <p id="photo-help" className="muted" style={{ margin: 0 }}>{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB — not saved yet` : "Square images look best."}</p>
          {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ account (read-only) */
function AccountCard({ profile }: { profile: ProfileDto }) {
  const rows: [string, string][] = [
    ["Employee code", profile.userId], ["Username", profile.username ?? "—"], ["Work email", profile.email ?? "—"],
    ["Role", profile.role === "ADMIN" ? "Administrator" : "Sales user"], ["Member since", fmt(profile.createdAt)], ["Password last changed", fmt(profile.passwordChangedAt)],
  ];
  return (
    <section className="card">
      <CardTitle icon={UserRound} title="Account" sub="Managed by your administrator. Ask them to change your email, username or role." />
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 16px", margin: 0 }}>
        {rows.map(([k, v]) => [<dt key={`${k}-t`} className="muted">{k}</dt>, <dd key={`${k}-d`} style={{ margin: 0, overflowWrap: "anywhere" }}>{v}</dd>])}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ details */
function DetailsCard({ profile }: { profile: ProfileDto }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <section className="card">
      <CardTitle icon={UserRound} title="Personal details" sub="How colleagues see and reach you inside the CRM." />
      <form
        className="form-grid"
        aria-label="Personal details"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          setError("");
          start(async () => {
            try {
              const r = await updateProfileAction(fd);
              if (r.ok) { toast.success(r.message); router.refresh(); } else setError(r.error);
            } catch {
              setError("Could not reach the server. Please try again.");
            }
          });
        }}
      >
        <div className="field"><label htmlFor="pf-name">Full name</label><input id="pf-name" name="name" required minLength={2} maxLength={120} defaultValue={profile.name} autoComplete="name" /></div>
        <div className="field"><label htmlFor="pf-designation">Designation</label><input id="pf-designation" name="designation" maxLength={80} defaultValue={profile.designation ?? ""} placeholder="e.g. Sales executive" autoComplete="organization-title" /></div>
        <div className="field"><label htmlFor="pf-phone">Phone</label><input id="pf-phone" name="phone" type="tel" maxLength={20} defaultValue={profile.phone ?? ""} placeholder="+91 98765 43210" autoComplete="tel" pattern="\+?[0-9][0-9\s\-\(\)]{6,18}" title="Digits, spaces, + - ( ) only" /></div>
        <div className="field"><label htmlFor="pf-location">Location</label><input id="pf-location" name="location" maxLength={120} defaultValue={profile.location ?? ""} placeholder="City / office" autoComplete="address-level2" /></div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div><button className="button" disabled={pending}>{pending ? "Saving…" : "Save details"}</button></div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ password */
function PasswordCard({ profile }: { profile: ProfileDto }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const problems = next ? passwordProblems(next, { username: profile.username, email: profile.email, name: profile.name }) : [];
  const score = passwordStrength(next);
  const mismatch = confirm.length > 0 && confirm !== next;

  if (!profile.canChangePassword) {
    return (
      <section className="card">
        <CardTitle icon={KeyRound} title="Password" sub="Your account has no sign-in email linked." />
        <p className="callout tone-warning" role="note">Ask an administrator to reset your password from User management.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <CardTitle icon={KeyRound} title="Change password" sub="Enter your current password to choose a new one." />
      <form
        ref={form}
        className="form-grid"
        aria-label="Change password"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          setError("");
          start(async () => {
            try {
              const r = await changeOwnPasswordAction(fd);
              if (r.ok) { toast.success(r.message); form.current?.reset(); setNext(""); setConfirm(""); router.refresh(); } else setError(r.error);
            } catch {
              setError("Could not reach the server. Please try again.");
            }
          });
        }}
      >
        <input type="text" name="username" autoComplete="username" defaultValue={profile.email ?? ""} hidden readOnly />
        <div className="field"><label htmlFor="pw-current">Current password</label><PasswordInput fieldLabel="current password" id="pw-current" name="current" required autoComplete="current-password" maxLength={256} /></div>
        <div className="field">
          <label htmlFor="pw-next">New password</label>
          <PasswordInput fieldLabel="new password" id="pw-next" name="next" required autoComplete="new-password" maxLength={256} value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-rules pw-strength" />
          <div id="pw-strength" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={STRENGTH[score]} style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${(score / 4) * 100}%`, height: "100%", background: score >= 3 ? "var(--success, #16a34a)" : score >= 2 ? "var(--warning, #d97706)" : "var(--danger, #dc2626)", transition: "width .2s" }} />
            </div>
            <span className="muted" style={{ fontSize: ".75rem", minWidth: 56 }}>{next ? STRENGTH[score] : ""}</span>
          </div>
        </div>
        <ul id="pw-rules" aria-label="Password requirements" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4, fontSize: ".8125rem" }}>
          {[...PASSWORD_RULES.map((r) => ({ label: r.label, ok: !!next && r.test(next) })), { label: "Not your name, username or email", ok: !!next && !problems.includes("Must not contain your name, username or email") }].map((r) => (
            <li key={r.label} style={{ display: "flex", gap: 6, alignItems: "center", color: r.ok ? "var(--success-text, #15803d)" : "var(--muted-text, inherit)" }}>
              {r.ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}<span>{r.label}<span className="sr-only">{r.ok ? " (met)" : " (not met)"}</span></span>
            </li>
          ))}
        </ul>
        <div className="field">
          <label htmlFor="pw-confirm">Confirm new password</label>
          <PasswordInput fieldLabel="confirm new password" id="pw-confirm" name="confirm" required autoComplete="new-password" maxLength={256} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} aria-describedby={mismatch ? "pw-mismatch" : undefined} />
          {mismatch ? <span id="pw-mismatch" className="error" style={{ fontSize: ".8125rem" }}>The passwords do not match.</span> : null}
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div><button className="button" disabled={pending || problems.length > 0 || mismatch || !next}>{pending ? "Changing…" : "Change password"}</button></div>
      </form>
    </section>
  );
}
