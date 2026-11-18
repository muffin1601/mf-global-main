-- Careers admin workspace: PIN settings, cookie sessions, and login lockouts.
-- Mirrors the original MongoDB collections careersettings, careersessions and
-- careerloginattempts used by /careers/admin.

-- CreateTable
CREATE TABLE "career_admin_settings" (
    "key" TEXT NOT NULL DEFAULT 'admin',
    "pin_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_admin_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "career_admin_sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_login_attempts" (
    "ip_hash" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_login_attempts_pkey" PRIMARY KEY ("ip_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "career_admin_sessions_token_hash_key" ON "career_admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "career_admin_sessions_expires_at_idx" ON "career_admin_sessions"("expires_at");

-- Server-side Prisma access only (see supabase/storage-and-database-security.sql).
ALTER TABLE "career_admin_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_admin_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_login_attempts" ENABLE ROW LEVEL SECURITY;
