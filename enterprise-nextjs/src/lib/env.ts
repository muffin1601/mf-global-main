import "server-only";
import { z } from "zod";
import { publicEnv, publicSchema } from "@/lib/env.public";

export { publicEnv };

const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CONTACT_EMAIL_FROM: z.string().min(3).optional(),
  CONTACT_EMAIL_TO: z.email().optional(),
  IP_HASH_SALT: z.string().min(32).optional(),
});

export function serverEnv() {
  const parsed = serverSchema.safeParse({
    ...publicEnv(),
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_EMAIL_FROM: process.env.CONTACT_EMAIL_FROM,
    CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO,
    IP_HASH_SALT: process.env.IP_HASH_SALT,
  });
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ");
    throw new Error(`Missing or invalid environment variables: ${names}`);
  }
  return parsed.data;
}
