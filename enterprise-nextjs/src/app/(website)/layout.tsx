import type { Metadata } from "next";
import Script from "next/script";
// The original MERN app loaded exactly one global stylesheet (styles/main/global.css)
// plus each page's own CSS. No Tailwind, no CRM styles are loaded on the public site.
import "@/legacy-marketing/styles/global.css";

const GA_ID = "G-H81NE594BN";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "MF Global Services",
  icons: { icon: "/favicon.ico" },
};

// Root layout for the public marketing website. It is a separate root from the
// CRM so marketing pages never receive CRM/Tailwind CSS (and vice versa), and it
// mirrors the original frontend/index.html <head>.
export default function WebsiteRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- same Google Fonts stylesheet as the original index.html */}
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
