-- AlterTable
ALTER TABLE "connected_accounts" ADD COLUMN "index_root_provider_id" VARCHAR(191);

-- AlterTable
ALTER TABLE "files" ADD COLUMN "provider_path_lower" VARCHAR(1024);

-- CreateIndex
CREATE INDEX "files_connected_account_id_provider_path_lower_idx" ON "files"("connected_account_id", "provider_path_lower");
