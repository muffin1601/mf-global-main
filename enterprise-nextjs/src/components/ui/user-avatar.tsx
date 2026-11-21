/** Initials from a display name ("Asha K Rao" -> "AK"). Never empty. */
export const initialsOf = (name: string | null | undefined) =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";

/**
 * Initials avatar. It is decorative by default (the name is normally printed next to it). Pass
 * `label` when the avatar stands alone so screen readers still get the person's name.
 */
export function UserAvatar({ name, size = "md", label }: { name: string | null | undefined; size?: "sm" | "md"; label?: boolean }) {
  return (
    <span className={`avatar${size === "sm" ? " sm" : ""}`} {...(label ? { role: "img", "aria-label": name ?? "User" } : { "aria-hidden": true })}>
      {initialsOf(name)}
    </span>
  );
}

/** Avatar + name (+ optional secondary line), e.g. for owners and assignees in tables. */
export function UserChip({ name, sub }: { name: string | null | undefined; sub?: string | null }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <UserAvatar name={name} size="sm" />
      <span style={{ minWidth: 0 }}>
        <span className="cell-primary">{name || "Unknown user"}</span>
        {sub ? <span className="sub">{sub}</span> : null}
      </span>
    </span>
  );
}
