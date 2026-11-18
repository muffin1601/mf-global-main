import type { Metadata } from "next";
import CareersAdmin from "@/legacy-marketing/pages/CareersAdmin";

// The original page set no custom meta (document title stayed "MF Global Services").
export const metadata: Metadata = { title: "MF Global Services", robots: { index: false, follow: false } };

export default function CareersAdminPage() {
  return <CareersAdmin />;
}
