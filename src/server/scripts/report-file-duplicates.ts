/**
 * Read-only: report duplicate File rows by (connectedAccountId, providerFileId).
 * Run: pnpm exec tsx src/server/scripts/report-file-duplicates.ts
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const groups = await client.query<{
    connected_account_id: string;
    provider_file_id: string;
    cnt: number;
    ids: string[];
  }>(`
    SELECT
      connected_account_id,
      provider_file_id,
      COUNT(*)::int AS cnt,
      array_agg(id::text ORDER BY created_at ASC) AS ids
    FROM files
    GROUP BY connected_account_id, provider_file_id
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 100
  `);

  const total = await client.query<{ groups: number }>(`
    SELECT COUNT(*)::int AS groups FROM (
      SELECT 1 FROM files
      GROUP BY connected_account_id, provider_file_id
      HAVING COUNT(*) > 1
    ) t
  `);

  console.log(
    JSON.stringify(
      {
        duplicateGroups: total.rows[0]?.groups ?? 0,
        sample: groups.rows,
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
