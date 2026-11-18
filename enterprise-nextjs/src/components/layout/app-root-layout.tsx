import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@/app/globals.css";

// Shared root document for the enterprise CRM and its auth screens. The public
// marketing website has its own root layout in app/(website)/layout.tsx so the
// two never share global CSS.
export const appRootMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "MF Global Services", template: "%s | MF Global Services" },
  description: "Business growth, promotional products, and enterprise services.",
  openGraph: { type: "website", siteName: "MF Global Services" },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
};

export function AppRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Toaster richColors position="top-center" /></body></html>;
}
