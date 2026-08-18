-- C-17-A1: account identity, database sessions, and invite registration.
-- Existing UserProfile and business rows are intentionally untouched. The
-- first registration claims an unbound profile in an application transaction.

CREATE TABLE "user_accounts" (
    "account_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "login" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "profile_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "auth_sessions" (
    "session_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "token_digest" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_accounts" ("account_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "invite_codes" (
    "invite_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code_digest" TEXT NOT NULL,
    "label" TEXT,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "user_accounts_login_key" ON "user_accounts"("login");
CREATE UNIQUE INDEX "user_accounts_profile_id_key" ON "user_accounts"("profile_id");
CREATE INDEX "idx_user_account_status" ON "user_accounts"("status");
CREATE UNIQUE INDEX "auth_sessions_token_digest_key" ON "auth_sessions"("token_digest");
CREATE INDEX "idx_auth_session_account_expiry" ON "auth_sessions"("account_id", "expires_at");
CREATE UNIQUE INDEX "invite_codes_code_digest_key" ON "invite_codes"("code_digest");
CREATE INDEX "idx_invite_code_active_expiry" ON "invite_codes"("active", "expires_at");
