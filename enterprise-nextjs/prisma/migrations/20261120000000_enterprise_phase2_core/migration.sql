-- Enterprise CRM 2.0, Phase 2 (core CRM). ADDITIVE ONLY: no existing column, row or constraint is changed or dropped.
-- Existing leads get priority = NULL and tags = '{}'; nothing is back-filled or inferred.
-- Production: apply to staging first; on large tables prefer the CREATE INDEX CONCURRENTLY variants
-- (see docs/enterprise/IMPLEMENTATION_PLAN.md, migration M1-M3). Rollback SQL is in the same document.

-- Trigram search indexes need pg_trgm (available on Supabase; installs into the current schema if absent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'TASK', 'NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT;

-- CreateTable
CREATE TABLE "lead_assignment_events" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "can_update" BOOLEAN,
    "reason" TEXT NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" "ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActivityPriority" NOT NULL DEFAULT 'MEDIUM',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by_id" UUID,
    "outcome" TEXT,
    "lead_id" UUID,
    "created_by_id" UUID,
    "assignee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_comments" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_assignment_events_lead_id_created_at_idx" ON "lead_assignment_events"("lead_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "lead_assignment_events_user_id_created_at_idx" ON "lead_assignment_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_assignee_id_status_due_at_idx" ON "activities"("assignee_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "activities_status_due_at_idx" ON "activities"("status", "due_at");

-- CreateIndex
CREATE INDEX "activities_lead_id_created_at_idx" ON "activities"("lead_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_created_by_id_created_at_idx" ON "activities"("created_by_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_comments_activity_id_created_at_idx" ON "activity_comments"("activity_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_views_entity_shared_idx" ON "saved_views"("entity", "shared");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_user_id_entity_name_key" ON "saved_views"("user_id", "entity", "name");

-- CreateIndex
CREATE INDEX "leads_priority_idx" ON "leads"("priority");

-- CreateIndex
CREATE INDEX "leads_tags_idx" ON "leads" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "leads_name_trgm_idx" ON "leads" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "leads_company_trgm_idx" ON "leads" USING GIN ("company" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "leads_phone_trgm_idx" ON "leads" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "leads_contact_trgm_idx" ON "leads" USING GIN ("contact" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "leads_email_trgm_idx" ON "leads" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("p_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_code_trgm_idx" ON "products" USING GIN ("p_code" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "vendors_name_trgm_idx" ON "vendors" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "activity_logs_occurred_at_idx" ON "activity_logs"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_occurred_at_idx" ON "activity_logs"("entity_type", "entity_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "lead_assignment_events" ADD CONSTRAINT "lead_assignment_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignment_events" ADD CONSTRAINT "lead_assignment_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignment_events" ADD CONSTRAINT "lead_assignment_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_comments" ADD CONSTRAINT "activity_comments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_comments" ADD CONSTRAINT "activity_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Defence in depth, matching supabase/storage-and-database-security.sql: browser Data API roles get no
-- access to the new tables. The application reaches them only through server-side Prisma.
ALTER TABLE "lead_assignment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;
