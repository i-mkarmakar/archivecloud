import { Button, toast } from "@heroui/react";
import {
  Archive,
  Clock,
  Folder,
  Person,
  Persons,
  TrashBin,
} from "@gravity-ui/icons";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/drive/MetricCard";
import { PageHeader } from "@/components/drive/PageHeader";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

type InviteTarget = {
  id: string;
  name: string;
  type: "file" | "folder";
  mimeType?: string;
  sizeBytes?: string;
};
type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  targetType: "file" | "folder";
  targetId: string;
  target: InviteTarget | null;
  createdAt: string;
  acceptedAt: string | null;
  user: { id: string; name: string; email: string } | null;
};

function ResourceIcon({ type }: { type: "file" | "folder" }) {
  return type === "folder" ? (
    <Folder className="h-5 w-5 text-foreground" />
  ) : (
    <Archive className="h-5 w-5 text-foreground" />
  );
}

export function SharedPage() {
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invite[]>([]);
  const pendingCount = sentInvites.filter(
    (invite) => invite.status === "pending",
  ).length;
  const acceptedCount = sentInvites.filter(
    (invite) => invite.status === "accepted",
  ).length;

  async function loadInvites() {
    const data = await apiFetch<{ sent: Invite[]; received: Invite[] }>(
      "/invites",
    );
    setSentInvites(data.sent);
    setReceivedInvites(data.received);
  }

  useEffect(() => {
    loadInvites().catch((error) =>
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to load shared resources",
      ),
    );
    window.addEventListener("archivecloud:invites-changed", loadInvites);
    return () =>
      window.removeEventListener("archivecloud:invites-changed", loadInvites);
  }, []);

  async function revokeInvite(id: string) {
    await apiFetch(`/invites/${id}`, { method: "DELETE" });
    await loadInvites();
  }

  return (
    <>
      <PageHeader
        title="Shared"
        description="Files and folders shared with members or shared with you."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Shared Resources"
          value={String(sentInvites.length + receivedInvites.length)}
          icon={Persons}
        />
        <MetricCard
          label="Accepted Members"
          value={String(acceptedCount)}
          icon={Person}
        />
        <MetricCard
          label="Pending Invites"
          value={String(pendingCount)}
          icon={Clock}
        />
      </div>

      <section className="mt-8">
        <h2 className="font-extrabold">Shared With You</h2>
        <div className="mt-4 grid gap-3">
          {receivedInvites.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center py-8">
              <p className="text-center text-sm text-muted">
                No files or folders have been shared with you yet.
              </p>
            </div>
          ) : (
            receivedInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ResourceIcon type={invite.targetType} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {invite.target?.name ?? "Unavailable resource"}
                    </p>
                    <p className="text-sm text-muted capitalize">
                      {invite.targetType} • {invite.role}
                      {invite.target?.sizeBytes
                        ? ` • ${formatBytes(invite.target.sizeBytes)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "w-fit rounded-full px-3 py-1 text-xs font-bold capitalize",
                    invite.status === "accepted"
                      ? "bg-surface-secondary text-foreground"
                      : "bg-surface-secondary text-foreground",
                  )}
                >
                  {invite.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-extrabold">Resources You Shared</h2>
        <div className="mt-4 grid gap-3">
          {sentInvites.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center py-8">
              <p className="text-center text-sm text-muted">
                No files or folders shared yet. Use Invite Members from the top
                bar.
              </p>
            </div>
          ) : (
            sentInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ResourceIcon type={invite.targetType} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {invite.target?.name ?? "Unavailable resource"}
                    </p>
                    <p className="break-all text-sm text-muted">
                      Shared with {invite.email}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Invited {formatDate(invite.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize text-muted">
                    {invite.role}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold capitalize",
                      invite.status === "accepted"
                        ? "bg-surface-secondary text-foreground"
                        : "bg-surface-secondary text-foreground",
                    )}
                  >
                    {invite.status}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => revokeInvite(invite.id)}
                  >
                    <TrashBin className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
