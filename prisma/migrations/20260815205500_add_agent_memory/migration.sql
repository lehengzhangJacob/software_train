CREATE TABLE "agent_threads" (
    "thread_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "agent_messages" (
    "message_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "thread_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "agent_threads" ("thread_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "memory_items" (
    "memory_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "source_message_id" INTEGER,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "source_ref" TEXT,
    "confidence" REAL NOT NULL DEFAULT 1,
    "importance" REAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_user_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "user_edited_at" DATETIME,
    "last_used_at" DATETIME,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memory_items_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "agent_messages" ("message_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_agent_thread_user_updated" ON "agent_threads"("user_id", "updated_at");
CREATE INDEX "idx_agent_message_thread_created" ON "agent_messages"("thread_id", "created_at");
CREATE INDEX "idx_memory_user_status_importance" ON "memory_items"("user_id", "status", "importance");
CREATE INDEX "idx_memory_user_updated" ON "memory_items"("user_id", "updated_at");
CREATE INDEX "idx_memory_source_message" ON "memory_items"("source_message_id");
