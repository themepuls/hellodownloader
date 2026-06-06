-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN "google_auth_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "site_settings" ADD COLUMN "google_client_id" TEXT NOT NULL DEFAULT '';
