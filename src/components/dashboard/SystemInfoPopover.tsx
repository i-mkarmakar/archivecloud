"use client";

import { Popover, Separator, Surface } from "@heroui/react";
import { CircleInfo, HardDrive, ShieldCheck } from "@gravity-ui/icons";
import { GoogleDriveLogo } from "@/components/drive/GoogleDriveLogo";
import { NotificationBell } from "@/components/ui/notification-bell";

export function SystemInfoPopover({
  accounts,
}: {
  accounts: Array<{
    id: string;
    email: string;
    provider: string;
    status: string;
  }>;
}) {
  const activeGoogle = accounts.filter(
    (a) => a.provider === "google_drive" && a.status === "connected",
  );

  return (
    <Popover>
      <NotificationBell
        count={activeGoogle.length}
        size={36}
        color="red"
        aria-label="App status"
      />
      <Popover.Content
        placement="bottom end"
        className="w-[min(calc(100vw-2rem),22rem)] p-0"
      >
        <Popover.Dialog>
          <div className="border-b border-separator px-4 py-3">
            <Popover.Heading className="text-sm font-extrabold">
              Status & Info
            </Popover.Heading>
            <p className="text-xs text-muted">
              Overview of your connections & guidelines
            </p>
          </div>
          <div className="max-h-96 space-y-4 overflow-y-auto p-4">
            <section>
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <ShieldCheck className="h-3.5 w-3.5" />
                Connection Status
              </h4>
              <Surface
                variant="secondary"
                className="mt-2 rounded-xl border border-separator p-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <GoogleDriveLogo className="h-3.5 w-3.5" />
                    Google Drive accounts
                  </span>
                  <span className="rounded-full border border-border bg-surface-secondary px-2 py-0.5 font-bold text-muted">
                    {activeGoogle.length} Connected
                  </span>
                </div>
                {activeGoogle.map((acc) => (
                  <p
                    key={acc.id}
                    className="truncate px-0.5 text-[11px] text-muted"
                  >
                    — {acc.email}
                  </p>
                ))}
              </Surface>
            </section>

            <Separator />

            <section>
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <HardDrive className="h-3.5 w-3.5" />
                Storage Engine
              </h4>
              <div className="mt-2 space-y-1 rounded-xl border border-separator bg-background-secondary p-2.5 text-xs text-muted">
                <p>
                  • <b>DB Type:</b> PostgreSQL
                </p>
                <p>
                  • <b>Upload Folder:</b> Google Drive dedicated{" "}
                  <code>archivecloud</code>
                </p>
                <p>
                  • <b>Max Upload Size:</b> 5 GB per stream
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <CircleInfo className="h-3.5 w-3.5" />
                Usage Tips
              </h4>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-1 text-[11px] text-muted">
                <li>Virtual folders exist only in your PostgreSQL database.</li>
                <li>
                  Physical files are always uploaded straight to Google Drive.
                </li>
                <li>
                  Use the Sync button to fetch changes made directly on Drive.
                </li>
              </ul>
            </section>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
