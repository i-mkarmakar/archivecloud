-- AlterTable
ALTER TABLE "files" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_starred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_accessed_at" TIMESTAMP(3),
ADD COLUMN     "starred_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "files_user_id_status_is_starred_starred_at_idx" ON "files"("user_id", "status", "is_starred", "starred_at");

-- CreateIndex
CREATE INDEX "files_user_id_status_is_archived_archived_at_idx" ON "files"("user_id", "status", "is_archived", "archived_at");

-- CreateIndex
CREATE INDEX "files_user_id_status_last_accessed_at_idx" ON "files"("user_id", "status", "last_accessed_at");
