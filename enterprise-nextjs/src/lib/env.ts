import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1)
});

const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CONTACT_EMAIL_FROM: z.string().min(3).optional(),
  CONTACT_EMAIL_TO: z.email().optional(),
  IP_HASH_SALT: z.string().min(32).optional()
});

function formatEnvironmentError(error: z.ZodError) {
  const names = [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");
  return new Error(`Missing or invalid environment variables: ${names}`);
}

export function publicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  });
  if (!parsed.success) throw formatEnvironmentError(parsed.error);
  return parsed.data;
}

export function serverEnv() {
  const parsed = serverSchema.safeParse({
    ...publicEnv(),
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_EMAIL_FROM: process.env.CONTACT_EMAIL_FROM,
    CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO,
    IP_HASH_SALT: process.env.IP_HASH_SALT
  });
  if (!parsed.success) throw formatEnvironmentError(parsed.error);
  return parsed.data;
}
