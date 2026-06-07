-- CreateTable
CREATE TABLE "storage_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "r2_enabled" BOOLEAN NOT NULL DEFAULT false,
    "r2_account_id" TEXT NOT NULL DEFAULT '',
    "r2_access_key_id" TEXT NOT NULL DEFAULT '',
    "r2_secret_access_key" TEXT NOT NULL DEFAULT '',
    "r2_bucket_name" TEXT NOT NULL DEFAULT 'hellodownloader',
    "r2_public_url" TEXT NOT NULL DEFAULT '',
    "video_retention_hours" INTEGER NOT NULL DEFAULT 1,
    "thumbnail_retention_days" INTEGER NOT NULL DEFAULT 30,
    "updated_at" DATETIME NOT NULL
);

INSERT INTO "storage_settings" ("id", "r2_enabled", "updated_at")
VALUES (1, false, CURRENT_TIMESTAMP);
