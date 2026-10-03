-- CreateTable
CREATE TABLE "share_bandwidth_daily" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "share_id" CHAR(36) NOT NULL,
    "day" DATE NOT NULL,
    "bytes_sent" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_bandwidth_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_bandwidth_daily_share_id_day_key" ON "share_bandwidth_daily"("share_id", "day");

-- CreateIndex
CREATE INDEX "share_bandwidth_daily_user_id_day_idx" ON "share_bandwidth_daily"("user_id", "day");

-- AddForeignKey
ALTER TABLE "share_bandwidth_daily" ADD CONSTRAINT "share_bandwidth_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_bandwidth_daily" ADD CONSTRAINT "share_bandwidth_daily_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "file_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
