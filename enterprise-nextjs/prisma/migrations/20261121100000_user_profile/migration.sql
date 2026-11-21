-- My profile: self-service details, profile photo and password-change timestamp.
-- Additive only: nullable columns, no defaults to backfill, no locks beyond a brief ALTER, no data changed.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "designation" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_path" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
