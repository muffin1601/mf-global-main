-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'IMPORT', 'INDIAMART', 'TRADEINDIA', 'COACHINGPROMO', 'PRINTKEE', 'WEBHOOK', 'LEGACY');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "external_key" TEXT,
ADD COLUMN     "import_job_id" UUID,
ADD COLUMN     "initial_status" TEXT,
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "source_inferred" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "cin" TEXT,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "evaluation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "last_evaluated_at" TIMESTAMP(3),
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "performance_score" DECIMAL(3,2),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'Medium',
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "tax_registration" TEXT,
ADD COLUMN     "vendor_type" TEXT;

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "from_call_status" TEXT,
    "to_call_status" TEXT,
    "changed_by_id" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_runs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'cron',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "meta" JSONB,

    CONSTRAINT "integration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "prefix" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE INDEX "lead_status_history_lead_id_changed_at_idx" ON "lead_status_history"("lead_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "integration_runs_provider_started_at_idx" ON "integration_runs"("provider", "started_at" DESC);

-- CreateIndex
CREATE INDEX "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "leads_external_key_key" ON "leads"("external_key");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_source_created_at_idx" ON "leads"("source", "created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_import_job_id_idx" ON "leads"("import_job_id");

-- CreateIndex
CREATE INDEX "leads_file_name_idx" ON "leads"("file_name");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "lead_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Database-level guarantees that Prisma cannot express.
-- ---------------------------------------------------------------------------

-- The CRM insertion timestamp is the business date for the Lead Insertion
-- Report. It is set once (or by the historical MongoDB migration at INSERT) and
-- can never be changed afterwards.
CREATE OR REPLACE FUNCTION prevent_lead_created_at_change() RETURNS trigger AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'leads.created_at is immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_created_at_immutable
  BEFORE UPDATE ON "leads"
  FOR EACH ROW EXECUTE FUNCTION prevent_lead_created_at_change();

-- Server-side Prisma access only (see supabase/storage-and-database-security.sql).
ALTER TABLE "lead_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;
