import "server-only";
import { prisma } from "@/lib/prisma/client";
import { todayIst } from "@/lib/time/ist";
import { createLead } from "@/server/leads/ingest";
import {
  ProviderError, fetchWithRetry, formatPhone, recordRun, safeMessage,
  type RunOutcome,
} from "./common";
import type { PullOptions } from "./indiamart";

type TradeIndiaLead = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));
const PAGE_LIMIT = 50;
const MAX_PAGES = 100;

export const tradeIndiaKey = (l: TradeIndiaLead, phone: string) => {
  const id = str(l.rfi_id ?? l.id ?? l.inquiry_id).trim();
  if (id) return `tradeindia:${id}`;
  const who = phone || str(l.sender_email).trim().toLowerCase() || str(l.sender_name).trim().toLowerCase();
  return `tradeindia:${who}:${str(l.generated_date).trim()}`;
};

/** Pull today's (IST) TradeIndia inquiries, paging until an empty page (as MERN). */
export async function pullTradeIndia(opts: PullOptions): Promise<RunOutcome> {
  const { TRADEINDIA_USERID: userid, TRADEINDIA_PROFILE_ID: profileId, TRADEINDIA_KEY: key } = process.env;
  return recordRun("tradeindia", opts.trigger ?? "cron", [key, userid, profileId], async (c) => {
    if (!userid || !profileId || !key) throw new ProviderError("TradeIndia credentials are not configured");
    const today = todayIst(opts.now ?? new Date());
    const seen = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://www.tradeindia.com/utils/my_inquiry.html?userid=${encodeURIComponent(userid)}&profile_id=${encodeURIComponent(profileId)}&key=${encodeURIComponent(key)}&from_date=${today}&to_date=${today}&limit=${PAGE_LIMIT}&page_no=${page}`;
      let leads: TradeIndiaLead[];
      try {
        const res = await fetchWithRetry(opts.fetch, url, { sleep: opts.sleep });
        const body: unknown = await res.json().catch(() => null);
        // MERN: HTML / non-JSON -> stop. Here that is recorded as a failure instead of silently ignored.
        if (body === null || typeof body !== "object") throw new ProviderError(`TradeIndia returned a non-JSON response (page ${page}, HTTP ${res.status})`);
        leads = Array.isArray(body) ? (body as TradeIndiaLead[]) : [];
      } catch (e) {
        throw new ProviderError(`${safeMessage(e, [key, userid, profileId])} (page ${page})`);
      }
      if (leads.length === 0) break;
      c.fetched += leads.length;
      let fresh = 0;
      for (const lead of leads) {
        try {
          if (!lead || typeof lead !== "object") throw new Error("malformed lead");
          const phone = formatPhone(lead.sender_mobile);
          const externalKey = tradeIndiaKey(lead, phone);
          if (seen.has(externalKey)) { c.duplicates++; continue; }
          seen.add(externalKey);
          fresh++;
          const inquiryDate = str(lead.generated_date) || null;
          // MERN upserted on phone + inquiryDate; honour that for leads migrated without an externalKey.
          if (phone && inquiryDate) {
            const legacy = await prisma.lead.findFirst({ where: { phone, inquiryDate, dataType: "TradeIndia" }, select: { id: true } });
            if (legacy) { c.duplicates++; continue; }
          }
          const r = await createLead({
            name: str(lead.sender_name), company: str(lead.sender_co), email: str(lead.sender_email), phone,
            contact: str(lead.sender_name), location: str(lead.sender_city), state: str(lead.sender_state), category: "TradeIndia",
            requirements: lead.message ? str(lead.message).replace(/[^\w\s]/gi, "").split(" ").slice(0, 100).join(" ") : "",
            remarks: str(lead.subject || lead.product_name), dataType: "TradeIndia", status: "New Lead", callStatus: "Not Called", inquiryDate,
            address: `${str(lead.sender_city)}, ${str(lead.sender_state)}, ${str(lead.sender_country)}`.trim(),
          }, { source: "TRADEINDIA", externalKey, dedupe: {} });
          if (r.status === "created") c.created++;
          else c.duplicates++;
        } catch (e) {
          c.failed++;
          console.error("integration:tradeindia lead failed", safeMessage(e, [key]));
        }
      }
      // Guard against a provider that ignores page_no and repeats the same page forever.
      if (fresh === 0) break;
    }
  });
}
