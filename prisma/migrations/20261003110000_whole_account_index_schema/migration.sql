-- Whole-account indexing (Phase 2a): scan progress on connected_accounts,
-- provider parent + folder marker on files, nullable size, unique provider file id.
-- Duplicate check (read-only) reported 0 groups before applying this unique constraint.

ALTER TABLE "connected_accounts"
ADD COLUMN IF NOT EXISTS "index_status" VARCHAR(32) NOT NULL DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS "index_files_indexed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "index_page_token" TEXT,
ADD COLUMN IF NOT EXISTS "index_scan_id" CHAR(36),
ADD COLUMN IF NOT EXISTS "index_last_error" TEXT,
ADD COLUMN IF NOT EXISTS "index_started_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "index_finished_at" TIMESTAMP(3);

ALTER TABLE "files"
ADD COLUMN IF NOT EXISTS "provider_parent_id" VARCHAR(191),
ADD COLUMN IF NOT EXISTS "is_folder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "last_index_scan_id" CHAR(36);

ALTER TABLE "files" ALTER COLUMN "size_bytes" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'files_connected_account_id_provider_file_id_key'
  ) THEN
    ALTER TABLE "files"
    ADD CONSTRAINT "files_connected_account_id_provider_file_id_key"
    UNIQUE ("connected_account_id", "provider_file_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "files_connected_account_id_last_index_scan_id_idx"
ON "files" ("connected_account_id", "last_index_scan_id");

CREATE INDEX IF NOT EXISTS "files_provider_parent_id_idx"
ON "files" ("provider_parent_id");
