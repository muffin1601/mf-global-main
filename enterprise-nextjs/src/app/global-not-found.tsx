import type { Metadata } from "next";
import "@/legacy-marketing/styles/global.css";

export const metadata: Metadata = {
  title: "MF Global Services",
  icons: { icon: "/favicon.ico" },
};

// Unmatched URLs. The original React Router app had no catch-all route, so an
// unknown URL rendered an empty page on the site background. This keeps that
// behaviour while returning a proper 404 status (Next.js also adds noindex).
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body />
    </html>
  );
}
