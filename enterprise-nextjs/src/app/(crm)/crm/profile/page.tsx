import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { getProfile } from "@/server/profile/service";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const u = await requireUser();
  const profile = await getProfile({ id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email });
  return (
    <main className="page">
      <PageHeader eyebrow="Account" title="My profile" description="Manage your photo, contact details and password. Changes are recorded in the activity log." />
      <ProfileClient profile={profile} />
    </main>
  );
}
