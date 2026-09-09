"use client";

import { Button, Card, toast } from "@heroui/react";
import {
  Cloud,
  Folder,
  Magnifier,
} from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { CardListSkeleton } from "@/components/drive/PageSkeletons";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

type LocalFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  updatedAt?: string;
  connectedAccount?: {
    id: string;
    email: string;
    provider: string;
    displayName?: string | null;
  } | null;
  folder?: { id: string; name: string } | null;
};

type CloudHit = {
  id: string;
  name: string;
  kind: "file" | "folder";
  mimeType?: string;
  sizeBytes?: string;
  modifiedTime?: string;
  pathHint?: string;
};

type CloudResult = {
  accountId: string;
  provider: string;
  email: string;
  displayName: string | null;
  files: CloudHit[];
  folders: CloudHit[];
  error?: string;
};

type SearchResponse = {
  query: string;
  localFiles: LocalFile[];
  clouds: CloudResult[];
};

export function SearchPage() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const q = sp.get("q")?.trim() ?? "";
  const accountId = sp.get("accountId")?.trim() ?? "";

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);

  const runSearch = useCallback(async () => {
    if (!q) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (accountId) params.set("accountId", accountId);
      const result = await apiFetch<SearchResponse>(
        `/search/query?${params.toString()}`,
      );
      setData(result);
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Search failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q, accountId]);

  useEffect(() => {
    runSearch().catch(() => undefined);
  }, [runSearch]);

  const cloudHitCount =
    data?.clouds.reduce(
      (sum, cloud) => sum + cloud.files.length + cloud.folders.length,
      0,
    ) ?? 0;

  return (
    <>
      <PageHeader
        title="Search"
        description={
          q
            ? `Results for “${q}” across Archive Cloud and connected clouds.`
            : "Search your library and every connected cloud drive."
        }
      />

      {!q ? (
        <Card className="mt-6 p-8 text-center">
          <Magnifier className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-4 font-extrabold">Type a query in the header search</p>
          <p className="mt-2 text-sm text-muted">
            We’ll scan your Archive Cloud files and connected providers.
          </p>
        </Card>
      ) : null}

      {q && loading ? (
        <CardListSkeleton
          className="mt-6"
          count={6}
          label="Searching all clouds"
        />
      ) : null}

      {q && !loading && data ? (
        <div className="mt-6 grid gap-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold">Archive Cloud library</h2>
              <span className="text-xs text-muted">
                {data.localFiles.length} file
                {data.localFiles.length === 1 ? "" : "s"}
              </span>
            </div>
            {data.localFiles.length === 0 ? (
              <p className="text-sm text-muted">No matching library files.</p>
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {data.localFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-secondary"
                    onClick={() => router.push(`/home?q=${encodeURIComponent(file.name)}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{file.name}</p>
                      <p className="truncate text-xs text-muted">
                        {providerLabel(file.connectedAccount?.provider ?? "")}
                        {file.folder?.name ? ` · ${file.folder.name}` : ""}
                        {" · "}
                        {formatBytes(file.sizeBytes)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {file.updatedAt ? formatDate(file.updatedAt) : ""}
                    </span>
                  </button>
                ))}
              </Card>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold">Connected clouds</h2>
              <span className="text-xs text-muted">
                {cloudHitCount} hit{cloudHitCount === 1 ? "" : "s"}
              </span>
            </div>

            {data.clouds.length === 0 ? (
              <p className="text-sm text-muted">
                No connected clouds to search. Connect providers in Settings.
              </p>
            ) : (
              <div className="grid gap-4">
                {data.clouds.map((cloud) => {
                  const hits = [...cloud.folders, ...cloud.files];
                  return (
                    <Card key={cloud.accountId} className="overflow-hidden p-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {providerLabel(cloud.provider)} ·{" "}
                            {cloud.displayName || cloud.email}
                          </p>
                          {cloud.error ? (
                            <p className="text-xs text-danger">{cloud.error}</p>
                          ) : (
                            <p className="text-xs text-muted">
                              {hits.length} result{hits.length === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() =>
                            router.push(`/clouds?accountId=${cloud.accountId}`)
                          }
                        >
                          <Cloud className="h-4 w-4" />
                          Open cloud
                        </Button>
                      </div>
                      {hits.length === 0 && !cloud.error ? (
                        <p className="px-4 py-3 text-sm text-muted">
                          No matches in this cloud.
                        </p>
                      ) : null}
                      <div className="divide-y divide-border">
                        {hits.map((hit) => (
                          <div
                            key={`${cloud.accountId}-${hit.kind}-${hit.id}`}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3",
                            )}
                          >
                            {hit.kind === "folder" ? (
                              <Folder className="h-4 w-4 shrink-0 text-muted" />
                            ) : (
                              <Cloud className="h-4 w-4 shrink-0 text-muted" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold">
                                {hit.name}
                              </p>
                              <p className="truncate text-xs text-muted">
                                {hit.kind === "folder" ? "Folder" : hit.mimeType}
                                {hit.sizeBytes
                                  ? ` · ${formatBytes(hit.sizeBytes)}`
                                  : ""}
                                {hit.pathHint ? ` · ${hit.pathHint}` : ""}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() =>
                                router.push(
                                  `/clouds?accountId=${cloud.accountId}&parentId=${encodeURIComponent(hit.kind === "folder" ? hit.id : "root")}`,
                                )
                              }
                            >
                              Browse
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
