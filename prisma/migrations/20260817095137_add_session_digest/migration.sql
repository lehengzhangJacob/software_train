-- CreateTable
CREATE TABLE "agent_session_digests" (
    "digest_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "thread_id" INTEGER NOT NULL,
    "covered_message_id" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_session_digests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "agent_threads" ("thread_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_session_digests_thread_id_key" ON "agent_session_digests"("thread_id");

-- CreateIndex
CREATE INDEX "idx_digest_thread_covered" ON "agent_session_digests"("thread_id", "covered_message_id");
