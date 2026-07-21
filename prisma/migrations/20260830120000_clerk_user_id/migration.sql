-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_user_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_key" ON "users"("clerk_user_id");
