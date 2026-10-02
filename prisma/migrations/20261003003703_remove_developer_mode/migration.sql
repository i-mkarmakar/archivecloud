-- Drop unused developer-mode columns (UI/guards already removed).
ALTER TABLE "users" DROP COLUMN IF EXISTS "developer_mode_enabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "developer_mode_enabled_at";
