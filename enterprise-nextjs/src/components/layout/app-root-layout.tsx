import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { PREFERENCE_BOOT_SCRIPT } from "./theme";
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
  icons: { icon: "/assets/logo.webp", apple: "/assets/logo.webp" },
};

export const appRootViewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#121721" }],
};

export function AppRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme / data-sidebar are set before paint by the boot script, so React must not warn about them.
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOT_SCRIPT }} />
        {children}
        <Toaster richColors closeButton position="top-right" toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </body>
    </html>
  );
}
