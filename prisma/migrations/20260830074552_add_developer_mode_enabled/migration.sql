-- AlterTable
ALTER TABLE "users" ADD COLUMN     "developer_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "developer_mode_enabled_at" TIMESTAMP(3);
