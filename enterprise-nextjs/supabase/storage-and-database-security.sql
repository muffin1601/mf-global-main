-- REVIEW BEFORE APPLYING. Run only after the initial Prisma migration.
-- The application accesses these tables through server-side Prisma. Browser
-- Data API roles receive no table access, so enabling RLS with no policies is
-- intentional defense in depth and does not authorize Prisma requests.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

do $$
declare table_name text;
begin
  for table_name in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Buckets are created through the Storage dashboard/API, not by inserting
-- directly into storage tables. No storage.objects policies are added here.
-- Therefore browser clients cannot list, upload, replace, or delete objects.
-- Authorized server routes use SUPABASE_SECRET_KEY after application RBAC and
-- return short-lived signed URLs for private downloads.
