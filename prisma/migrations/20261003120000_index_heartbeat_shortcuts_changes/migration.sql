ALTER TABLE "connected_accounts"
ADD COLUMN IF NOT EXISTS "index_heartbeat_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "index_changes_page_token" TEXT,
ADD COLUMN IF NOT EXISTS "index_needs_full_scan" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "files"
ADD COLUMN IF NOT EXISTS "is_shortcut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "shortcut_target_id" VARCHAR(191);
