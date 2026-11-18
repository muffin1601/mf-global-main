// Fixed, local-only values. Real .env files are never loaded by the tests.
const url = `postgresql://postgres:test@127.0.0.1:${process.env.TEST_DB_PORT ?? 54330}/crm_test`;
Object.assign(process.env, {
  DATABASE_URL: url,
  DIRECT_URL: url,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  IP_HASH_SALT: "test-salt-test-salt-test-salt-test-salt",
});
// Staging/test safety: nothing may email real people or call real integrations.
delete process.env.RESEND_API_KEY;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.INDIAMART_API_KEY;
delete process.env.TRADEINDIA_KEY;
delete process.env.COACHINGPROMO_API_KEY;
