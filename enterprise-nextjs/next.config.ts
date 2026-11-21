import type { NextConfig } from "next";

// Report-only for now: the marketing site uses inline styles and third-party embeds, so enforcing a CSP
// without observing violations first would risk breaking it. Promote to enforcing once reports are clean.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co",
].join("; ");

const nextConfig: NextConfig = {
  // The isolated E2E stack (scripts/e2e/start-stack.mjs) builds into its own directory so it can run beside
  // a developer's `next dev`. Unset in every other environment, so the default `.next` is unchanged.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  // pdfkit reads its bundled font metric files from disk at runtime; bundling it breaks that lookup.
  serverExternalPackages: ["pdfkit"],
  // The marketing website and the CRM use separate root layouts so their global
  // CSS never mixes; unmatched URLs therefore need app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Content-Security-Policy-Report-Only", value: csp },
      ],
    }];
  },
};

export default nextConfig;
