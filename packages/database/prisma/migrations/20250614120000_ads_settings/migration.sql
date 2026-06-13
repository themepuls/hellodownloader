-- CreateTable
CREATE TABLE "ads_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_settings_pkey" PRIMARY KEY ("id")
);

-- Seed default row
INSERT INTO "ads_settings" ("id", "config", "updated_at")
VALUES (1, '{}', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
