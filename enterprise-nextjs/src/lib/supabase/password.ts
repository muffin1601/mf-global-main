import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env.public";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PasswordSetter, PasswordVerifier } from "@/server/profile/service";

/**
 * Re-authenticates with a throwaway, non-persisting client so checking the current password never touches the
 * user's session cookies. The temporary session is signed out immediately.
 */
export const verifyPassword: PasswordVerifier = async (email, password, expectedUserId) => {
  const env = publicEnv();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return data.user?.id === expectedUserId;
};

export const setPassword: PasswordSetter = async (authUserId, password) => {
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(authUserId, { password });
  return error ? { error: error.message } : {};
};
