import "server-only";
import { prisma } from "@/lib/prisma/client";
import { IST_OFFSET_MS } from "@/lib/time/ist";
import { createLead } from "@/server/leads/ingest";
import {
  ProviderError, fetchWithRetry, formatPhone, recordRun, safeMessage,
  type FetchLike, type RunOutcome, type Sleep,
} from "./common";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `DD-Mon-YYYY HH:mm:ss` in IST (MERN used the server's local time, which was IST). */
export function formatIndiaMartDate(instant: Date): string {
  const d = new Date(instant.getTime() + IST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

type IndiaMartLead = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));

export const indiaMartKey = (l: IndiaMartLead) => {
  const id = str(l.UNIQUE_QUERY_ID).trim();
  if (id) return `indiamart:${id}`;
  return `indiamart:${str(l.SENDER_EMAIL).trim().toLowerCase() || formatPhone(l.SENDER_MOBILE)}:${str(l.QUERY_TIME).trim()}`;
};

export type PullOptions = { fetch: FetchLike; sleep?: Sleep; now?: Date; trigger?: string };

/** Pull the last 24 h from IndiaMART (overlapping window: a failed run is recovered by the next one). */
export async function pullIndiaMart(opts: PullOptions): Promise<RunOutcome> {
  const key = process.env.INDIAMART_API_KEY;
  return recordRun("indiamart", opts.trigger ?? "cron", [key], async (c) => {
    if (!key) throw new ProviderError("INDIAMART_API_KEY is not configured");
    const end = opts.now ?? new Date();
    const start = new Date(end.getTime() - 24 * 3600_000);
    const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(key)}&start_time=${encodeURIComponent(formatIndiaMartDate(start))}&end_time=${encodeURIComponent(formatIndiaMartDate(end))}`;
    const res = await fetchWithRetry(opts.fetch, url, { sleep: opts.sleep });
    const data = (await res.json().catch(() => null)) as { CODE?: number; RESPONSE?: unknown } | null;
    if (!data || data.CODE !== 200 || !Array.isArray(data.RESPONSE)) {
      throw new ProviderError(`Invalid response from IndiaMART${data?.CODE ? ` (CODE ${data.CODE})` : ""}`);
    }
    const leads = data.RESPONSE as IndiaMartLead[];
    c.fetched = leads.length;
    for (const lead of leads) {
      try {
        if (!lead || typeof lead !== "object") throw new Error("malformed lead");
        const externalKey = indiaMartKey(lead);
        const email = str(lead.SENDER_EMAIL).trim() || null;
        const inquiryDate = str(lead.QUERY_TIME).trim() || null;
        // MERN upserted on email + inquiryDate; honour that for leads migrated without an externalKey.
        if (email && inquiryDate) {
          const legacy = await prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" }, inquiryDate, dataType: "IndiaMart" }, select: { id: true } });
          if (legacy) { c.duplicates++; continue; }
        }
        const r = await createLead({
          name: str(lead.SENDER_NAME), company: str(lead.SENDER_COMPANY), email, phone: formatPhone(lead.SENDER_MOBILE),
          location: str(lead.SENDER_CITY), state: str(lead.SENDER_STATE), category: "IndiaMart",
          requirements: str(lead.QUERY_MESSAGE), dataType: "IndiaMart", inquiryDate, address: str(lead.SENDER_ADDRESS) || null,
          remarks: str(lead.QUERY_MCAT_NAME), callStatus: "Not Called", status: "New Lead",
        }, { source: "INDIAMART", externalKey, dedupe: {} });
        if (r.status === "created") c.created++;
        else c.duplicates++;
      } catch (e) {
        c.failed++;
        console.error("integration:indiamart lead failed", safeMessage(e, [key]));
      }
    }
  });
}
