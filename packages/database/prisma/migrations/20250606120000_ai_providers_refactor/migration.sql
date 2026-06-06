-- Refactor AI provider settings: remove Freepik, add fal.ai + provider architecture
-- SQLite: recreate ai_api_settings table

PRAGMA foreign_keys=OFF;

CREATE TABLE "ai_api_settings_new" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "text_provider" TEXT NOT NULL DEFAULT 'openai',
  "text_model" TEXT NOT NULL DEFAULT 'gpt-5-mini',
  "openai_api_key" TEXT NOT NULL DEFAULT '',
  "openai_connection_status" TEXT NOT NULL DEFAULT 'unknown',
  "openai_last_tested_at" DATETIME,
  "image_provider" TEXT NOT NULL DEFAULT 'fal',
  "basic_image_model" TEXT NOT NULL DEFAULT 'flux-dev',
  "pro_image_model" TEXT NOT NULL DEFAULT 'flux-kontext-pro',
  "fal_api_key" TEXT NOT NULL DEFAULT '',
  "fal_connection_status" TEXT NOT NULL DEFAULT 'unknown',
  "fal_last_tested_at" DATETIME,
  "enable_ai_analysis" BOOLEAN NOT NULL DEFAULT true,
  "enable_ai_thumbnail_generation" BOOLEAN NOT NULL DEFAULT true,
  "enable_ai_improve_thumbnail" BOOLEAN NOT NULL DEFAULT true,
  "enable_auto_category_detection" BOOLEAN NOT NULL DEFAULT true,
  "enable_thumbnail_scoring" BOOLEAN NOT NULL DEFAULT true,
  "enable_auto_layout_detection" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" DATETIME NOT NULL
);

INSERT INTO "ai_api_settings_new" (
  "id",
  "text_provider",
  "text_model",
  "openai_api_key",
  "openai_connection_status",
  "openai_last_tested_at",
  "image_provider",
  "basic_image_model",
  "pro_image_model",
  "fal_api_key",
  "fal_connection_status",
  "fal_last_tested_at",
  "enable_ai_analysis",
  "enable_ai_thumbnail_generation",
  "enable_ai_improve_thumbnail",
  "enable_auto_category_detection",
  "enable_thumbnail_scoring",
  "enable_auto_layout_detection",
  "updated_at"
)
SELECT
  "id",
  'openai',
  COALESCE("openai_model", 'gpt-5-mini'),
  COALESCE("openai_api_key", ''),
  COALESCE("openai_connection_status", 'unknown'),
  "openai_last_tested_at",
  'fal',
  CASE
    WHEN "basic_plan_model" IN ('flux-schnell', 'flux-dev', 'gpt-image-1') THEN "basic_plan_model"
    WHEN "basic_plan_model" IN ('flux-2-turbo', 'flux-2-klein-1k', 'classic-fast') THEN 'flux-dev'
    ELSE 'flux-dev'
  END,
  CASE
    WHEN "pro_plan_model" IN ('flux-pro', 'flux-kontext-pro', 'gpt-image-1') THEN "pro_plan_model"
    WHEN "pro_plan_model" IN ('flux-pro-1-1', 'flux-2-pro') THEN 'flux-pro'
    ELSE 'flux-kontext-pro'
  END,
  '',
  'unknown',
  NULL,
  COALESCE("enable_ai_analysis", 1),
  COALESCE("enable_ai_thumbnail_generation", 1),
  COALESCE("enable_ai_improve_thumbnail", 1),
  COALESCE("enable_auto_category_detection", 1),
  COALESCE("enable_thumbnail_scoring", 1),
  COALESCE("enable_auto_layout_detection", 1),
  COALESCE("updated_at", CURRENT_TIMESTAMP)
FROM "ai_api_settings";

DROP TABLE "ai_api_settings";
ALTER TABLE "ai_api_settings_new" RENAME TO "ai_api_settings";

PRAGMA foreign_keys=ON;
