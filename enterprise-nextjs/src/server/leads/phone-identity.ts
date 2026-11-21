import { Prisma } from "@/generated/prisma/client";
import { normalizePhone } from "@/lib/imports/lead-csv";

// Keep in sync with lead_phone_key in PostgreSQL. Legacy non-phone contact text
// retains exact matching. Numeric identities use the CSV importer's country rules.
export function phoneKey(value: string) {
  return /^[+0-9 ().-]+$/.test(value) && /[0-9]/.test(value) ? normalizePhone(value) : value.trim();
}

export async function findPhoneMatch(tx: Prisma.TransactionClient, value: string, excludeId?: string) {
  const key = phoneKey(value);
  const excluded = excludeId ? Prisma.sql`AND id <> ${excludeId}::uuid` : Prisma.empty;
  const [hit] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM leads WHERE (lead_phone_key(phone) = ${key} OR lead_phone_key(contact) = ${key})
    ${excluded} ORDER BY id LIMIT 1`;
  return hit;
}

export async function lockLeadKeys(tx: Prisma.TransactionClient, keys: string[]) {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}
