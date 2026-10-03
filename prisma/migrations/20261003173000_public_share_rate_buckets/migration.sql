-- Fixed-window public share rate-limit counters (shared across app replicas).
-- bucket_key is ip:<ip> or tok:<sha256(token)> — never the raw share token.
CREATE TABLE IF NOT EXISTS "public_share_rate_buckets" (
    "bucket_key" VARCHAR(128) NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_share_rate_buckets_pkey" PRIMARY KEY ("bucket_key")
);
