-- C-25 / ADR-0015: per-account daily article batches and durable image metadata.
-- The migration is additive: existing profile, meal, conversation, memory,
-- activity and exercise rows are intentionally untouched and no historical
-- article backfill is performed.
CREATE TABLE "agent_daily_article_batches" (
    "batch_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "content_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_kind" TEXT NOT NULL DEFAULT 'agent',
    "requested_count" INTEGER NOT NULL DEFAULT 10,
    "ready_count" INTEGER NOT NULL DEFAULT 0,
    "image_pending_count" INTEGER NOT NULL DEFAULT 0,
    "generation_error" TEXT,
    "started_at" DATETIME,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_daily_article_batches_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "agent_daily_articles" (
    "article_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batch_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "visual_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "image_status" TEXT NOT NULL DEFAULT 'fallback',
    "image_provider" TEXT,
    "image_task_id" TEXT,
    "image_asset_key" TEXT,
    "image_mime_type" TEXT,
    "image_alt" TEXT NOT NULL,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" DATETIME,
    "saved_at" DATETIME,
    "hidden_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_daily_articles_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "agent_daily_article_batches" ("batch_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_daily_articles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_daily_article_batch_user_date"
  ON "agent_daily_article_batches" ("user_id", "content_date");
CREATE INDEX "idx_daily_article_batch_user_date_status"
  ON "agent_daily_article_batches" ("user_id", "content_date", "status");
CREATE UNIQUE INDEX "uq_daily_article_batch_slot"
  ON "agent_daily_articles" ("batch_id", "slot");
CREATE INDEX "idx_daily_article_user_status_published"
  ON "agent_daily_articles" ("user_id", "status", "published_at");
CREATE INDEX "idx_daily_article_batch_image_status"
  ON "agent_daily_articles" ("batch_id", "image_status");
