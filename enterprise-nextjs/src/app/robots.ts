import type { MetadataRoute } from "next";

// Original public/robots.txt allowed everything. Public pages stay crawlable;
// the CRM, APIs and the two admin-only marketing screens are disallowed.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mfglobalservices.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/crm/", "/crm", "/api/", "/careers/admin", "/blogs/new"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
