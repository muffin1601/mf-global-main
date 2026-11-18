import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing or invalid environment variables: SUPABASE_SECRET_KEY");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
