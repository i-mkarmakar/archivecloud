import { Button, Card, Input, toast } from "@heroui/react";
import {
  CircleCheck,
  CloudArrowUpIn,
  Copy,
  Key,
  ShieldCheck,
  TrashBin,
} from "@gravity-ui/icons";
import { type FormEvent, useEffect, useState } from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { PageHeader } from "@/components/drive/PageHeader";
import { API_URL, apiFetch, formatDate } from "@/lib/api";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const curlExample = `curl -X POST "${API_URL}/api/v1/uploads" \\
  -H "Authorization: Bearer 9d_live_xxx" \\
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \\
  -F "file-0=@hello.txt;type=text/plain"`;

const jsExample = `const form = new FormData()
form.append('filesMeta', JSON.stringify([
  { fieldName: 'file-0', fileName: file.name, mimeType: file.type, sizeBytes: String(file.size) },
]))
form.append('file-0', file)

await fetch('${API_URL}/api/v1/uploads', {
  method: 'POST',
  headers: { Authorization: 'Bearer 9d_live_xxx' },
  body: form,
})`;

export function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiFetch<{ apiKeys: ApiKey[] }>("/api-keys");
    setApiKeys(data.apiKeys);
  }

  useEffect(() => {
    load().catch((error) =>
      toast.danger(
        error instanceof Error ? error.message : "Failed to load API keys",
      ),
    );
  }, []);

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<{ apiKey: ApiKey; secret: string }>(
        "/api-keys",
        { method: "POST", body: JSON.stringify({ name: keyName }) },
      );
      setSecret(data.secret);
      setKeyName("");
      setCreateOpen(false);
      await load();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to create API key",
      );
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    await apiFetch(`/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  function copy(value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success("Copied to clipboard."))
      .catch(() => toast.danger("Failed to copy."));
  }

  const activeKeys = apiKeys.filter(
    (apiKey) => apiKey.status === "active",
  ).length;
  const usedKeys = apiKeys.filter((apiKey) => apiKey.lastUsedAt).length;

  return (
    <>
      <PageHeader
        title="API Management"
        description="Create API keys, copy examples, and upload files from external apps."
        actions={
          <Button
            className="col-span-2 w-full sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Key className="h-4 w-4" />
            Create API Key
          </Button>
        }
      />
      {secret ? (
        <Card className="mt-5 min-w-0 overflow-hidden border-border bg-surface-secondary p-0">
          <div className="grid min-w-0 gap-4 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-background">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-foreground">
                  Copy your API key now
                </p>
                <p className="mt-1 text-sm text-foreground">
                  This secret is shown once. Store it securely before closing
                  this page.
                </p>
              </div>
            </div>
            <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
              <code className="block min-w-0 max-w-full overflow-x-auto rounded-xl bg-white p-3 text-xs font-semibold text-foreground sm:text-sm">
                {secret}
              </code>
              <Button
                className="w-full lg:w-auto"
                type="button"
                onClick={() => copy(secret)}
              >
                <Copy className="h-4 w-4" />
                Copy key
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <Key className="h-5 w-5 text-foreground" />
          <p className="mt-3 text-2xl font-extrabold">{activeKeys}</p>
          <p className="text-sm text-muted">Active keys</p>
        </Card>
        <Card className="p-4">
          <CircleCheck className="h-5 w-5 text-muted" />
          <p className="mt-3 text-2xl font-extrabold">{usedKeys}</p>
          <p className="text-sm text-muted">Used keys</p>
        </Card>
        <Card className="p-4">
          <CloudArrowUpIn className="h-5 w-5 text-foreground" />
          <p className="mt-3 text-2xl font-extrabold">1</p>
          <p className="text-sm text-muted">Upload endpoint</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6">
        <Card className="min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-extrabold">API Keys</h2>
            <p className="mt-1 text-sm text-muted">
              Keys can only upload files. Raw secrets are never stored.
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {apiKeys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center sm:p-6">
                <Key className="mx-auto h-8 w-8 text-foreground" />
                <p className="mt-3 font-extrabold">No API keys yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create one key, copy it once, then use the docs below.
                </p>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  onClick={() => setCreateOpen(true)}
                >
                  Create API Key
                </Button>
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="grid min-w-0 gap-4 rounded-2xl bg-background-secondary p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 break-words font-semibold text-foreground">
                        {apiKey.name}
                      </p>
                      <span
                        className={
                          apiKey.status === "active"
                            ? "rounded-full bg-default px-2 py-0.5 text-xs font-bold text-foreground"
                            : "rounded-full bg-default px-2 py-0.5 text-xs font-bold text-muted"
                        }
                      >
                        {apiKey.status}
                      </span>
                    </div>
                    <div className="mt-2 grid min-w-0 gap-1 text-sm text-muted sm:grid-cols-2">
                      <p className="min-w-0 truncate">
                        <span className="font-semibold text-foreground">
                          Prefix:
                        </span>{" "}
                        {apiKey.keyPrefix}...
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">
                          Created:
                        </span>{" "}
                        {formatDate(apiKey.createdAt)}
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">
                          Last used:
                        </span>{" "}
                        {apiKey.lastUsedAt
                          ? formatDate(apiKey.lastUsedAt)
                          : "Never"}
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">
                          Scope:
                        </span>{" "}
                        {apiKey.scopes.join(", ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full lg:w-auto"
                    variant="danger"
                    onClick={() => revokeKey(apiKey.id)}
                    isDisabled={apiKey.status === "revoked"}
                  >
                    <TrashBin className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-extrabold">Upload API Docs</h2>
            <p className="mt-1 text-sm text-muted">
              Multipart upload uses the same storage routing as dashboard
              uploads.
            </p>
          </div>
          <div className="mt-4 grid gap-4 text-sm text-muted">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">Endpoint</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(`${API_URL}/api/v1/uploads`)}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <code className="block min-w-0 max-w-full overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs text-foreground sm:text-sm">
                POST {API_URL}/api/v1/uploads
              </code>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground">Auth Header</p>
              <code className="mt-2 block min-w-0 max-w-full overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs text-foreground sm:text-sm">
                Authorization: Bearer 9d_live_xxx
              </code>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">cURL</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(curlExample)}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-xl bg-background-inverse p-3 text-xs leading-relaxed text-background">
                {curlExample}
              </pre>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">JavaScript</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(jsExample)}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-xl bg-background-inverse p-3 text-xs leading-relaxed text-background">
                {jsExample}
              </pre>
            </div>
          </div>
        </Card>
      </div>

      <DummyModal
        open={createOpen}
        title="Create API Key"
        description="API keys can upload files using the public API."
        onClose={() => setCreateOpen(false)}
      >
        <form className="grid gap-4" onSubmit={createKey}>
          <Input
            fullWidth
            placeholder="Key name"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
            required
          />
          <div className="grid gap-3 sm:flex sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
              isDisabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" isDisabled={loading}>
              {loading ? "Creating..." : "Create Key"}
            </Button>
          </div>
        </form>
      </DummyModal>
    </>
  );
}
