-- C-17-S2: move AI and McDonald's credentials behind the authenticated account.
-- The first account lazily imports the legacy runtime files; later accounts get
-- empty settings so one user's credentials can never become another user's defaults.

CREATE TABLE "account_settings" (
    "settings_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "ai_settings_json" TEXT,
    "mcdonalds_endpoint" TEXT NOT NULL DEFAULT 'https://mcp.mcd.cn',
    "mcdonalds_token" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_settings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_accounts" ("account_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "account_settings_account_id_key" ON "account_settings"("account_id");
