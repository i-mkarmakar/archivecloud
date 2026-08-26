"use client";

import { Button, Card, toast } from "@heroui/react";
import { Cloud } from "@gravity-ui/icons";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { apiFetch } from "@/lib/api";

export function DeveloperProvidersPage() {
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleRedirectUri, setGoogleRedirectUri] = useState("");
  const [defaultRedirectUri, setDefaultRedirectUri] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [savingGoogleConfig, setSavingGoogleConfig] = useState(false);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  async function load() {
    const configData = await apiFetch<{
      exists: boolean;
      clientId: string;
      redirectUri: string;
      hasSecret: boolean;
      defaultRedirectUri: string;
    }>("/system/google-config");
    if (configData.exists) {
      setGoogleClientId(configData.clientId || "");
      setGoogleRedirectUri(configData.redirectUri || "");
      setHasSecret(configData.hasSecret || false);
    }
    setDefaultRedirectUri(configData.defaultRedirectUri || "");
  }

  useEffect(() => {
    load().catch((error) =>
      toast.danger(
        error instanceof Error ? error.message : "Failed to load provider config",
      ),
    );
  }, []);

  async function saveGoogleConfig(event: FormEvent) {
    event.preventDefault();
    setSavingGoogleConfig(true);
    try {
      const res = await apiFetch<{ message: string }>("/system/google-config", {
        method: "POST",
        body: JSON.stringify({
          clientId: googleClientId,
          clientSecret: googleClientSecret || undefined,
          redirectUri: googleRedirectUri || defaultRedirectUri,
        }),
      });
      toast.success(res.message || "Google OAuth credentials saved.");
      setHasSecret(true);
      setGoogleClientSecret("");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to save Google OAuth configuration",
      );
    } finally {
      setSavingGoogleConfig(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Providers"
        description="Configure Google OAuth credentials used when users connect Google Drive."
      />
      <Card className="mt-5 p-4">
        <div className="flex items-center justify-between border-b border-separator pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="h-5 w-5 text-foreground" />
            <h2 className="text-[17px] font-bold">Google OAuth Credentials</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold"
            type="button"
            onClick={() => setShowGoogleHelp(!showGoogleHelp)}
          >
            {showGoogleHelp ? "Hide Guide" : "Setup Guide"}
          </Button>
        </div>

        {showGoogleHelp ? (
          <div className="mb-4 rounded-xl bg-background-secondary p-3.5 text-[13px] leading-relaxed text-muted border border-separator">
            <p className="font-bold text-foreground mb-1.5">
              How to setup Google credentials:
            </p>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>
                Go to{" "}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline"
                >
                  Google Cloud Console
                </a>
                .
              </li>
              <li>
                Enable the <strong>Google Drive API</strong> in your project.
              </li>
              <li>
                Go to <strong>APIs & Services &gt; Credentials</strong>, click{" "}
                <strong>Create Credentials &gt; OAuth client ID</strong>.
              </li>
              <li>
                Set application type to <strong>Web application</strong>.
              </li>
              <li>
                Add this exact URL under{" "}
                <strong>Authorized redirect URIs</strong>:
                <div className="mt-1 font-mono text-[11px] bg-white dark:bg-surface p-1.5 rounded border border-border select-all overflow-x-auto">
                  {googleRedirectUri || defaultRedirectUri}
                </div>
              </li>
              <li>
                Copy the generated <strong>Client ID</strong> and{" "}
                <strong>Client Secret</strong> into the form below and save.
              </li>
            </ol>
          </div>
        ) : null}

        <form onSubmit={saveGoogleConfig} className="grid gap-3.5">
          <label className="grid gap-1.5 text-xs font-bold text-muted">
            Client ID
            <input
              className="h-10 rounded-xl border border-border bg-white dark:bg-surface px-3 text-sm focus:outline-none"
              placeholder="Enter Google Client ID"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-muted">
            Client Secret{" "}
            {hasSecret ? (
              <span className="font-normal text-muted">(Already Configured)</span>
            ) : null}
            <input
              className="h-10 rounded-xl border border-border bg-white dark:bg-surface px-3 text-sm focus:outline-none"
              type="password"
              placeholder={
                hasSecret
                  ? "••••••••••••••••••••••••"
                  : "Enter Google Client Secret"
              }
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              required={!hasSecret}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-muted">
            Redirect URI (Optional)
            <input
              className="h-10 rounded-xl border border-border bg-white dark:bg-surface px-3 text-sm focus:outline-none"
              placeholder={defaultRedirectUri}
              value={googleRedirectUri}
              onChange={(e) => setGoogleRedirectUri(e.target.value)}
            />
          </label>

          <div className="flex justify-end mt-1">
            <Button type="submit" isDisabled={savingGoogleConfig} size="sm">
              {savingGoogleConfig ? "Saving..." : "Save Credentials"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
