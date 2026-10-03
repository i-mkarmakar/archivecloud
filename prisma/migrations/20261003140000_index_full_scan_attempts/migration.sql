-- AlterTable
ALTER TABLE "connected_accounts" ADD COLUMN "index_full_scan_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "connected_accounts" ADD COLUMN "index_full_scan_next_attempt_at" TIMESTAMP(3);
