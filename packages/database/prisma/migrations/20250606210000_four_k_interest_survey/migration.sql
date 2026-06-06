-- CreateTable
CREATE TABLE "four_k_interest_surveys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interested" BOOLEAN NOT NULL,
    "user_id" TEXT,
    "visitor_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "four_k_interest_surveys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "four_k_interest_surveys_user_id_key" ON "four_k_interest_surveys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "four_k_interest_surveys_visitor_id_key" ON "four_k_interest_surveys"("visitor_id");
