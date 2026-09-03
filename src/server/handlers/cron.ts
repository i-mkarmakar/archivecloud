import { env } from "@/server/config/env";
import { errorJson, json } from "@/server/http/responses";
import { runScheduledTransferTick } from "@/server/modules/automation/run-scheduled-tick";

export function assertCronAuthorized(request: Request): Response | null {
  const secret = env.CRON_SECRET?.trim();
  if (!secret || secret.startsWith("build-cron-secret")) {
    return errorJson(
      "CRON_NOT_CONFIGURED",
      "Set CRON_SECRET in the environment to enable the cron tick endpoint.",
      503,
    );
  }

  const header =
    request.headers.get("authorization") ??
    request.headers.get("x-cron-secret") ??
    "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : header.trim();

  if (!token || token !== secret) {
    return errorJson("UNAUTHORIZED", "Invalid cron secret.", 401);
  }
  return null;
}

export async function cronTickHandler(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const automation = await runScheduledTransferTick({ limit: 100 });

  const { tickFolderSyncsGlobal } = await import("@/server/handlers/sync");
  const sync = await tickFolderSyncsGlobal({ limit: 20 });

  const { renewExpiringGoogleDriveWatches } = await import(
    "@/server/modules/webhooks/google-drive-watch"
  );
  const watches = await renewExpiringGoogleDriveWatches(20);

  const { renewExpiringOneDriveSubscriptions } = await import(
    "@/server/modules/webhooks/onedrive-subscription"
  );
  const onedrive = await renewExpiringOneDriveSubscriptions(20);

  return json({
    ok: true,
    at: new Date().toISOString(),
    automation,
    sync,
    watches,
    onedrive,
  });
}
