import "server-only";
import { z } from "zod";
import { limitRequest } from "@/lib/rate-limit";
import { createLead } from "@/server/leads/ingest";
import { safeEqual } from "./common";

export type WebhookKind = "coachinpromo" | "printkee";

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const email = z.union([z.literal(""), z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email")]).optional().nullable();
const phone = z.string().trim().max(30).optional().nullable();

const schemas = {
  coachinpromo: z.object({ name: text(200), companyname: text(200), email, location: text(200), phone, message: text(5000) }),
  printkee: z.object({ name: text(200), company: text(200), productCode: text(100), email, phone, requirements: text(5000), location: text(200) }),
};

const json = (status: number, body: unknown) => Response.json(body, { status });

/**
 * Port of MERN `routes/leads.js` webhooks. Order matches MERN: rate limit (60/min/IP, shared by both
 * routes), API key (x-api-key vs COACHINGPROMO_API_KEY for BOTH routes), then capture.
 */
export async function handleWebhook(kind: WebhookKind, request: Request): Promise<Response> {
  const limit = await limitRequest(request, "webhook-capture", 60, 60_000);
  if (!limit.allowed) {
    return Response.json({ error: "Rate limit exceeded." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }
  // MERN compared `undefined !== undefined` (an unset key accepted any caller). Fail closed instead.
  const expected = process.env.COACHINGPROMO_API_KEY;
  if (!expected || !safeEqual(request.headers.get("x-api-key"), expected)) return json(403, { error: "Invalid API key" });

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json(400, { error: "Invalid request body" });
  const parsed = schemas[kind].safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid lead data", issues: parsed.error.issues.map((i) => i.path.join(".")) });
  const d = parsed.data as Record<string, string | null | undefined>;
  const phoneValue = d.phone?.trim() || null;
  const emailValue = d.email?.trim() || null;
  if (!phoneValue && !emailValue) return json(400, { error: "A phone or an email is required" });

  try {
    const result = await createLead({
      name: d.name, company: kind === "coachinpromo" ? d.companyname : d.company, email: emailValue, phone: phoneValue, location: d.location,
      requirements: kind === "coachinpromo" ? d.message : d.requirements || d.productCode,
      inquiryDate: new Date().toISOString(), callStatus: "Not Called", status: "New Lead", dataType: "WebPortals",
    }, { source: kind === "coachinpromo" ? "COACHINGPROMO" : "PRINTKEE", dedupe: { phone: true } });
    if (result.status === "duplicate") return json(200, { message: "Lead already exists", duplicate: true, data: { id: result.existingId } });
    return json(201, { message: "Lead captured successfully", data: { id: result.leadId } });
  } catch (e) {
    console.error("webhook capture failed", { kind, error: e instanceof Error ? e.name : "unknown" });
    return json(500, { error: "Failed to capture lead" });
  }
}
