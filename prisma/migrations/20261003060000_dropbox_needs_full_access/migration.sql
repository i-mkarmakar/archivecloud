-- Dropbox App-folder vs Full Dropbox is not visible in OAuth scopes.
-- Flag existing Dropbox accounts for reconnect once whole-account indexing is enabled.
ALTER TABLE "connected_accounts"
ADD COLUMN "dropbox_needs_full_access" BOOLEAN NOT NULL DEFAULT false;

UPDATE "connected_accounts"
SET "dropbox_needs_full_access" = true
WHERE "provider" = 'dropbox';
