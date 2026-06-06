-- CreateTable
CREATE TABLE "thumbnail_prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "thumbnail_prompts_slug_key" ON "thumbnail_prompts"("slug");

-- CreateIndex
CREATE INDEX "thumbnail_prompts_type_idx" ON "thumbnail_prompts"("type");

-- CreateIndex
CREATE INDEX "thumbnail_prompts_status_idx" ON "thumbnail_prompts"("status");
