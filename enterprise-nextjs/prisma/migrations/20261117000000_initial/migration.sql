-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW_LEAD', 'ACTIVE', 'TRENDING', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'PENDING', 'INACTIVE', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'CLOSED', 'DRAFT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'HIRED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID,
    "legacy_id" TEXT,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "location" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sequences" (
    "role" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sequences_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "created_by_id" UUID,
    "name" TEXT,
    "company" TEXT,
    "email" TEXT,
    "country_code" TEXT,
    "phone" TEXT,
    "contact" TEXT,
    "location" TEXT,
    "state" TEXT,
    "category" TEXT,
    "quantity" DECIMAL(14,3),
    "requirements" TEXT,
    "remarks" TEXT,
    "data_type" TEXT,
    "call_status" TEXT NOT NULL DEFAULT 'Not Called',
    "status" TEXT NOT NULL DEFAULT 'New Lead',
    "follow_up_date" TIMESTAMP(3),
    "follow_up_date_one" TIMESTAMP(3),
    "follow_up_date_two" TIMESTAMP(3),
    "follow_up_date_three" TIMESTAMP(3),
    "calling_date" TIMESTAMP(3),
    "inquiry_date" TEXT,
    "address" TEXT,
    "file_name" TEXT,
    "billing_address" JSONB,
    "shipping_address" JSONB,
    "additional_contacts" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_update" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_permissions" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legacy_permission" TEXT,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_update" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lead_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_import_jobs" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "user_id" UUID,
    "user_name" TEXT,
    "role" TEXT,
    "file_name" TEXT,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "assigned_to_name" TEXT,
    "report_truncated" BOOLEAN NOT NULL DEFAULT false,
    "retry_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_import_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "company" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "lead_id" UUID,

    CONSTRAINT "lead_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "cat_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "p_code" TEXT,
    "s_code" TEXT,
    "p_name" TEXT,
    "category_id" UUID,
    "legacy_category_code" TEXT,
    "p_image" TEXT,
    "p_description" TEXT,
    "p_type" TEXT,
    "p_color" TEXT,
    "hsn_code" TEXT,
    "gst_rate" DECIMAL(6,3),
    "dimension" TEXT NOT NULL DEFAULT '',
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "legacy_data" JSONB,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_code" TEXT,
    "purchase_price" DECIMAL(14,2),
    "sales_5_50" DECIMAL(14,2),
    "sales_50_100" DECIMAL(14,2),
    "sales_100_above" DECIMAL(14,2),
    "gst_rate" DECIMAL(6,3),
    "basic_amount" DECIMAL(14,2),
    "net_amount" DECIMAL(14,2),

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "user_id" UUID NOT NULL,
    "party" JSONB NOT NULL,
    "bank_details" JSONB,
    "invoice_details" JSONB NOT NULL,
    "summary_snapshot" JSONB,
    "legacy_data" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "subtotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hsn" TEXT,
    "image" TEXT,
    "qty" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "tax" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_categories" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "tax_id" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "category_id" UUID,
    "owner_id" UUID,
    "created_by_id" UUID,
    "payment_terms" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT NOT NULL DEFAULT '',
    "bank_details" JSONB,
    "custom_fields" JSONB,
    "legacy_data" JSONB,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contacts" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_addresses" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Office',
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vendor_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_products" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "vendor_item_code" TEXT NOT NULL DEFAULT '',
    "purchase_price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "moq" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_price_tiers" (
    "id" UUID NOT NULL,
    "vendor_product_id" UUID NOT NULL,
    "min_qty" DECIMAL(14,3) NOT NULL,
    "max_qty" DECIMAL(14,3),
    "unit_price" DECIMAL(14,2) NOT NULL,
    "discount_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_activities" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_documents" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL DEFAULT 'Other',
    "description" TEXT NOT NULL DEFAULT '',
    "storage_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT '',
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by_id" UUID,
    "uploaded_by_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_evaluations" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "vendor_id" UUID NOT NULL,
    "quality" INTEGER NOT NULL,
    "delivery" INTEGER NOT NULL,
    "lead_time" INTEGER NOT NULL,
    "pricing" INTEGER NOT NULL,
    "responsiveness" INTEGER NOT NULL,
    "compliance" INTEGER NOT NULL,
    "overall_score" DECIMAL(3,2) NOT NULL,
    "evaluation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_label" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "evaluated_by_id" UUID,
    "evaluated_by_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_import_jobs" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "user_id" UUID,
    "user_name" TEXT NOT NULL DEFAULT '',
    "file_name" TEXT NOT NULL DEFAULT '',
    "storage_path" TEXT NOT NULL DEFAULT '',
    "headers" TEXT[],
    "mapping" JSONB NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "report_truncated" BOOLEAN NOT NULL DEFAULT false,
    "retry_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_import_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "vendor_name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "vendor_id" UUID,

    CONSTRAINT "vendor_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "media_path" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Anonymous',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "blog_id" UUID NOT NULL,
    "user_name" TEXT NOT NULL DEFAULT 'Guest',
    "text" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_jobs" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "work_mode" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "salary_range" TEXT NOT NULL DEFAULT '',
    "vacancies" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 1000,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "qualifications" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "benefits" TEXT NOT NULL DEFAULT '',
    "opens_at" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_applications" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "job_id" UUID NOT NULL,
    "job_title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "job_designation" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "stream" TEXT NOT NULL DEFAULT '',
    "experience" TEXT NOT NULL,
    "key_responsibilities" TEXT NOT NULL DEFAULT '',
    "current_company" TEXT NOT NULL DEFAULT '',
    "designation" TEXT NOT NULL DEFAULT '',
    "expected_salary" TEXT NOT NULL DEFAULT '',
    "notice_period" TEXT NOT NULL,
    "resume_path" TEXT NOT NULL,
    "resume_file_name" TEXT NOT NULL,
    "cover_letter" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "consent" BOOLEAN NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "admin_notes" TEXT NOT NULL DEFAULT '',
    "submission_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_days" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitor_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_events" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "day_id" UUID NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "user_id" UUID,
    "actor_user_code" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "key" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gst" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "bank_details" JSONB NOT NULL,
    "invoice_prefix" TEXT NOT NULL,
    "invoice_start" INTEGER NOT NULL,
    "quotation_prefix" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_counters" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "role" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,

    CONSTRAINT "legacy_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_checkpoints" (
    "id" UUID NOT NULL,
    "collection" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "target_id" TEXT,
    "source_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_client_permissions" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "legacy_user_id" TEXT NOT NULL,
    "legacy_client_id" TEXT NOT NULL,
    "permission" TEXT,
    "duplicate_pair" BOOLEAN NOT NULL DEFAULT false,
    "user_resolved" BOOLEAN NOT NULL DEFAULT false,
    "client_resolved" BOOLEAN NOT NULL DEFAULT false,
    "source_data" JSONB NOT NULL,
    "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_client_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_orphan_records" (
    "id" UUID NOT NULL,
    "collection" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source_data" JSONB NOT NULL,
    "source_hash" TEXT NOT NULL,
    "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_orphan_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_id_key" ON "users"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_enabled_idx" ON "users"("role", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "leads_legacy_id_key" ON "leads"("legacy_id");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_follow_up_date_idx" ON "leads"("follow_up_date");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_contact_idx" ON "leads"("contact");

-- CreateIndex
CREATE INDEX "leads_category_idx" ON "leads"("category");

-- CreateIndex
CREATE INDEX "leads_location_idx" ON "leads"("location");

-- CreateIndex
CREATE INDEX "leads_state_idx" ON "leads"("state");

-- CreateIndex
CREATE INDEX "leads_data_type_idx" ON "leads"("data_type");

-- CreateIndex
CREATE INDEX "lead_assignments_user_id_assigned_at_idx" ON "lead_assignments"("user_id", "assigned_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignments_lead_id_user_id_key" ON "lead_assignments"("lead_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_permissions_legacy_id_key" ON "lead_permissions"("legacy_id");

-- CreateIndex
CREATE INDEX "lead_permissions_user_id_idx" ON "lead_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_permissions_lead_id_user_id_key" ON "lead_permissions"("lead_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_import_jobs_legacy_id_key" ON "lead_import_jobs"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_import_jobs_retry_key_key" ON "lead_import_jobs"("retry_key");

-- CreateIndex
CREATE INDEX "lead_import_jobs_user_id_created_at_idx" ON "lead_import_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "lead_import_rows_job_id_row_number_key" ON "lead_import_rows"("job_id", "row_number");

-- CreateIndex
CREATE UNIQUE INDEX "categories_legacy_id_key" ON "categories"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_cat_id_key" ON "categories"("cat_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_legacy_id_key" ON "products"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_p_code_key" ON "products"("p_code");

-- CreateIndex
CREATE INDEX "products_category_id_updated_at_idx" ON "products"("category_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "products_status_updated_at_idx" ON "products"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "products_p_name_idx" ON "products"("p_name");

-- CreateIndex
CREATE UNIQUE INDEX "product_prices_product_id_key" ON "product_prices"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_prices_price_code_key" ON "product_prices"("price_code");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_legacy_id_key" ON "quotations"("legacy_id");

-- CreateIndex
CREATE INDEX "quotations_user_id_created_at_idx" ON "quotations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_sort_order_idx" ON "quotation_items"("quotation_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_legacy_id_key" ON "vendor_categories"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_name_key" ON "vendor_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_legacy_id_key" ON "vendors"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_vendor_code_key" ON "vendors"("vendor_code");

-- CreateIndex
CREATE INDEX "vendors_status_updated_at_idx" ON "vendors"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "vendors_category_id_status_idx" ON "vendors"("category_id", "status");

-- CreateIndex
CREATE INDEX "vendors_owner_id_idx" ON "vendors"("owner_id");

-- CreateIndex
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "vendor_contacts_vendor_id_is_primary_idx" ON "vendor_contacts"("vendor_id", "is_primary");

-- CreateIndex
CREATE INDEX "vendor_addresses_vendor_id_is_primary_idx" ON "vendor_addresses"("vendor_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_products_legacy_id_key" ON "vendor_products"("legacy_id");

-- CreateIndex
CREATE INDEX "vendor_products_vendor_id_is_active_effective_from_idx" ON "vendor_products"("vendor_id", "is_active", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "vendor_products_product_id_is_active_idx" ON "vendor_products"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "vendor_products_vendor_id_product_id_effective_from_idx" ON "vendor_products"("vendor_id", "product_id", "effective_from");

-- CreateIndex
CREATE INDEX "vendor_price_tiers_vendor_product_id_min_qty_idx" ON "vendor_price_tiers"("vendor_product_id", "min_qty");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_activities_legacy_id_key" ON "vendor_activities"("legacy_id");

-- CreateIndex
CREATE INDEX "vendor_activities_vendor_id_occurred_at_idx" ON "vendor_activities"("vendor_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_documents_legacy_id_key" ON "vendor_documents"("legacy_id");

-- CreateIndex
CREATE INDEX "vendor_documents_vendor_id_status_created_at_idx" ON "vendor_documents"("vendor_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "vendor_documents_expiry_date_status_idx" ON "vendor_documents"("expiry_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_evaluations_legacy_id_key" ON "vendor_evaluations"("legacy_id");

-- CreateIndex
CREATE INDEX "vendor_evaluations_vendor_id_evaluation_date_idx" ON "vendor_evaluations"("vendor_id", "evaluation_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_import_jobs_legacy_id_key" ON "vendor_import_jobs"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_import_jobs_retry_key_key" ON "vendor_import_jobs"("retry_key");

-- CreateIndex
CREATE INDEX "vendor_import_jobs_created_at_idx" ON "vendor_import_jobs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_import_rows_job_id_row_number_key" ON "vendor_import_rows"("job_id", "row_number");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_legacy_id_key" ON "blog_posts"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_published_created_at_idx" ON "blog_posts"("published", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "blog_comments_legacy_id_key" ON "blog_comments"("legacy_id");

-- CreateIndex
CREATE INDEX "blog_comments_blog_id_created_at_idx" ON "blog_comments"("blog_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "career_jobs_legacy_id_key" ON "career_jobs"("legacy_id");

-- CreateIndex
CREATE INDEX "career_jobs_status_is_published_deadline_idx" ON "career_jobs"("status", "is_published", "deadline");

-- CreateIndex
CREATE INDEX "career_jobs_created_at_idx" ON "career_jobs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "career_applications_legacy_id_key" ON "career_applications"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "career_applications_submission_key_key" ON "career_applications"("submission_key");

-- CreateIndex
CREATE INDEX "career_applications_created_at_idx" ON "career_applications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "career_applications_status_created_at_idx" ON "career_applications"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contact_submissions_created_at_idx" ON "contact_submissions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visitor_days_legacy_id_key" ON "visitor_days"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_days_date_key" ON "visitor_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_events_legacy_id_key" ON "visitor_events"("legacy_id");

-- CreateIndex
CREATE INDEX "visitor_events_day_id_ip_hash_idx" ON "visitor_events"("day_id", "ip_hash");

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_legacy_id_key" ON "activity_logs"("legacy_id");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_legacy_id_key" ON "company_settings"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_key_key" ON "company_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_counters_legacy_id_key" ON "legacy_counters"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_counters_role_key" ON "legacy_counters"("role");

-- CreateIndex
CREATE INDEX "migration_checkpoints_collection_status_idx" ON "migration_checkpoints"("collection", "status");

-- CreateIndex
CREATE UNIQUE INDEX "migration_checkpoints_collection_legacy_id_key" ON "migration_checkpoints"("collection", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_client_permissions_legacy_id_key" ON "legacy_client_permissions"("legacy_id");

-- CreateIndex
CREATE INDEX "legacy_client_permissions_legacy_user_id_legacy_client_id_idx" ON "legacy_client_permissions"("legacy_user_id", "legacy_client_id");

-- CreateIndex
CREATE INDEX "legacy_client_permissions_user_resolved_client_resolved_idx" ON "legacy_client_permissions"("user_resolved", "client_resolved");

-- CreateIndex
CREATE INDEX "legacy_orphan_records_collection_reason_idx" ON "legacy_orphan_records"("collection", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_orphan_records_collection_legacy_id_key" ON "legacy_orphan_records"("collection", "legacy_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_permissions" ADD CONSTRAINT "lead_permissions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_permissions" ADD CONSTRAINT "lead_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_jobs" ADD CONSTRAINT "lead_import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_rows" ADD CONSTRAINT "lead_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "lead_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_rows" ADD CONSTRAINT "lead_import_rows_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "vendor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_addresses" ADD CONSTRAINT "vendor_addresses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_price_tiers" ADD CONSTRAINT "vendor_price_tiers_vendor_product_id_fkey" FOREIGN KEY ("vendor_product_id") REFERENCES "vendor_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_activities" ADD CONSTRAINT "vendor_activities_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_activities" ADD CONSTRAINT "vendor_activities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_import_jobs" ADD CONSTRAINT "vendor_import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_import_rows" ADD CONSTRAINT "vendor_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "vendor_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "career_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "visitor_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
