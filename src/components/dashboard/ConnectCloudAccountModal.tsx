"use client";

import { CircleInfo, Eye, EyeSlash } from "@gravity-ui/icons";
import { Button, Drawer, toast, useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { apiFetch } from "@/lib/api";
import {
  connectOAuthPopup,
  OAUTH_CONNECT_MESSAGE_HANDLERS,
} from "@/lib/oauth-connect";
import { PROVIDER_LABELS, type SupportedProviderId } from "@/lib/providers";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type ProviderAuthKind = "oauth" | "credentials";

type ConnectProvider = {
  id: SupportedProviderId;
  label: string;
  authKind: ProviderAuthKind;
  section: "platform" | "business";
  connectUrlPath?: string;
  popupName?: string;
};

const CONNECT_PROVIDERS: ConnectProvider[] = [
  {
    id: "google_drive",
    label: "Google Drive",
    authKind: "oauth",
    section: "platform",
    connectUrlPath: "/connected-accounts/google/connect-url",
    popupName: "google-drive-connect",
  },
  {
    id: "dropbox",
    label: "Dropbox",
    authKind: "oauth",
    section: "platform",
    connectUrlPath: "/connected-accounts/dropbox/connect-url",
    popupName: "dropbox-connect",
  },
  {
    id: "onedrive",
    label: "OneDrive",
    authKind: "oauth",
    section: "platform",
    connectUrlPath: "/connected-accounts/onedrive/connect-url",
    popupName: "onedrive-connect",
  },
  {
    id: "pcloud",
    label: "pCloud",
    authKind: "oauth",
    section: "platform",
    connectUrlPath: "/connected-accounts/pcloud/connect-url",
    popupName: "pcloud-connect",
  },
  {
    id: "google_photos",
    label: "Google Photos",
    authKind: "oauth",
    section: "platform",
    connectUrlPath: "/connected-accounts/google-photos/connect-url",
    popupName: "google-photos-connect",
  },
  {
    id: "icloud_photos",
    label: "iCloud Photos",
    authKind: "credentials",
    section: "platform",
  },
  {
    id: "icloud_drive",
    label: "iCloud Drive",
    authKind: "credentials",
    section: "platform",
  },
  {
    id: "google_shared_drive",
    label: "Shared Drive",
    authKind: "oauth",
    section: "business",
    connectUrlPath: "/connected-accounts/google-shared-drive/connect-url",
    popupName: "google-shared-connect",
  },
];

function defaultAliasForProvider(label: string) {
  return `My ${label}`;
}

function ProviderIcon({
  providerId,
  label,
}: {
  providerId: string;
  label: string;
}) {
  const isGoogleMark = providerId === "google_shared_drive";
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
      <ProviderBrandIcon
        name={providerId}
        className={cn(
          "shrink-0 object-contain",
          isGoogleMark ? "h-5 w-5" : "h-7 w-7",
        )}
        fallback={
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
            {label.charAt(0)}
          </span>
        }
      />
    </span>
  );
}

function notifyStorageChanged() {
  window.dispatchEvent(new Event("archivecloud:storage-changed"));
}

export function ConnectCloudAccountModal({
  open,
  onClose,
  onConnected,
  initialProviderId = null,
}: {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;

  initialProviderId?: SupportedProviderId | null;
}) {
  const router = useRouter();
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  const [alias, setAlias] = useState("");
  const [selectedId, setSelectedId] = useState<SupportedProviderId | null>(
    null,
  );
  const [step, setStep] = useState<"pick" | "credentials">("pick");
  const [connecting, setConnecting] = useState(false);

  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [icloudWebAccessOn, setIcloudWebAccessOn] = useState(false);

  const selected = CONNECT_PROVIDERS.find((p) => p.id === selectedId) ?? null;
  const platformProviders = CONNECT_PROVIDERS.filter(
    (p) => p.section === "platform",
  );
  const businessProviders = CONNECT_PROVIDERS.filter(
    (p) => p.section === "business",
  );

  const canConnect =
    alias.trim().length > 0 && selectedId != null && !connecting;

  useEffect(() => {
    if (open) state.open();
    else state.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const initial = CONNECT_PROVIDERS.find((p) => p.id === initialProviderId);
    setSelectedId(initial?.id ?? null);
    setAlias(initial ? defaultAliasForProvider(initial.label) : "");
    setStep("pick");
    setConnecting(false);
    setAppleId("");
    setAppPassword("");
    setShowAppPassword(false);
    setIcloudWebAccessOn(false);
  }, [open, initialProviderId]);

  function selectProvider(providerId: SupportedProviderId) {
    const provider = CONNECT_PROVIDERS.find((p) => p.id === providerId);
    setSelectedId(providerId);
    if (provider) setAlias(defaultAliasForProvider(provider.label));
  }

  useEffect(() => {
    if (!open) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const type = event.data?.type as string | undefined;
      const config = type ? OAUTH_CONNECT_MESSAGE_HANDLERS[type] : undefined;
      if (!config) return;

      if (event.data.status === "success") {
        toast.success(config.success);
        notifyStorageChanged();
        onConnected?.();
        onClose();
        if (
          type === "GOOGLE_PHOTOS_CONNECTED" &&
          typeof event.data.accountId === "string" &&
          event.data.accountId
        ) {
          router.push(
            `/home?accountId=${encodeURIComponent(event.data.accountId)}&photosHowto=1`,
          );
        }
      } else {
        toast.danger(config.failure);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onClose, onConnected, router]);

  async function startOAuth(provider: ConnectProvider) {
    if (!provider.connectUrlPath || !provider.popupName) return;
    setConnecting(true);
    try {
      const connectUrl = new URL(
        provider.connectUrlPath,
        window.location.origin,
      );
      connectUrl.searchParams.set("alias", alias.trim());
      await connectOAuthPopup({
        connectUrlPath: `${connectUrl.pathname}${connectUrl.search}`,
        popupName: provider.popupName,
      });
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : `Failed to start ${provider.label} connection`,
      );
    } finally {
      setConnecting(false);
    }
  }

  async function submitCredentials() {
    if (!selected) return;
    setConnecting(true);
    try {
      if (selected.id === "icloud_drive" || selected.id === "icloud_photos") {
        await apiFetch("/connected-accounts/icloud/connect", {
          method: "POST",
          body: JSON.stringify({
            appleId: appleId.trim(),
            appSpecificPassword: appPassword,
            provider: selected.id,
            alias: alias.trim(),
          }),
        });
        toast.success(`${PROVIDER_LABELS[selected.id]} connected.`);
      }
      notifyStorageChanged();
      onConnected?.();
      onClose();
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : `Failed to connect ${selected.label}`,
      );
    } finally {
      setConnecting(false);
    }
  }

  function handleConnect() {
    if (!canConnect || !selected) return;
    if (selected.authKind === "oauth") {
      void startOAuth(selected);
      return;
    }
    setStep("credentials");
  }

  const credentialsReady =
    selected?.id === "icloud_drive" || selected?.id === "icloud_photos"
      ? Boolean(appleId.trim() && appPassword && icloudWebAccessOn)
      : false;

  return (
    <Drawer state={state}>
      <Drawer.Backdrop isDismissable={!connecting}>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="h-full w-full max-w-lg sm:max-w-xl">
            <Drawer.CloseTrigger isDisabled={connecting} />
            <Drawer.Header>
              <Drawer.Heading>Connect Cloud Account</Drawer.Heading>
            </Drawer.Header>

            <Drawer.Body>
              {step === "pick" ? (
                <div className="grid gap-5">
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="connect-account-alias"
                      className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                    >
                      Account name (Alias)
                      <span className="text-danger" aria-hidden>
                        *
                      </span>
                      <CircleInfo
                        className="h-3.5 w-3.5 text-muted"
                        aria-hidden
                      />
                    </label>
                    <p className="text-xs text-muted">
                      You can change this later
                    </p>
                    <input
                      id="connect-account-alias"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Enter account name"
                      value={alias}
                      onChange={(event) =>
                        setAlias(event.target.value.slice(0, 50))
                      }
                      autoComplete="off"
                      maxLength={50}
                    />
                    <p className="text-xs text-muted">
                      {alias.length}/50 characters
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    <p className="text-sm font-medium text-foreground">
                      Select Cloud Platform
                      <span className="ml-0.5 text-danger" aria-hidden>
                        *
                      </span>
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {platformProviders.map((provider) => {
                        const isSelected = selectedId === provider.id;
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => selectProvider(provider.id)}
                            className={cn(
                              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors",
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border hover:border-primary/60 hover:bg-surface-secondary",
                            )}
                          >
                            <ProviderIcon
                              providerId={provider.id}
                              label={provider.label}
                            />
                            <span className="min-w-0 truncate">
                              {provider.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    <p className="text-sm font-medium text-foreground">
                      Business Services
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {businessProviders.map((provider) => {
                        const isSelected = selectedId === provider.id;
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => selectProvider(provider.id)}
                            className={cn(
                              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors",
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border hover:border-primary/60 hover:bg-surface-secondary",
                            )}
                          >
                            <ProviderIcon
                              providerId={provider.id}
                              label={provider.label}
                            />
                            <span className="min-w-0 truncate">
                              {provider.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5">
                  <div className="flex items-start gap-3">
                    {selected ? (
                      <ProviderIcon
                        providerId={selected.id}
                        label={selected.label}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground">
                        {selected?.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Saving as “{alias.trim()}”
                      </p>
                    </div>
                  </div>

                  {selected?.id === "icloud_drive" ||
                  selected?.id === "icloud_photos" ? (
                    <div className="grid gap-4">
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium text-foreground">
                          Apple ID
                        </span>
                        <input
                          className={fieldClass}
                          type="email"
                          placeholder="email@icloud.com"
                          value={appleId}
                          onChange={(e) => setAppleId(e.target.value)}
                          autoComplete="username"
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                          App-specific password
                          <a
                            href="https://appleid.apple.com/account/manage"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Create one
                          </a>
                        </span>
                        <div className="relative">
                          <input
                            className={cn(fieldClass, "pr-10")}
                            type={showAppPassword ? "text" : "password"}
                            placeholder="xxxx-xxxx-xxxx-xxxx"
                            value={appPassword}
                            onChange={(e) => setAppPassword(e.target.value)}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-black/5 hover:text-foreground"
                            onClick={() =>
                              setShowAppPassword((value) => !value)
                            }
                            aria-label={
                              showAppPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showAppPassword ? (
                              <EyeSlash className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <span className="text-xs text-muted">
                          Not your normal Apple password — generate an
                          app-specific one on appleid.apple.com.
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-surface-secondary has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                          checked={icloudWebAccessOn}
                          onChange={(e) =>
                            setIcloudWebAccessOn(e.target.checked)
                          }
                        />
                        <span className="min-w-0 grid gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            iCloud web access is enabled
                          </span>
                          <span className="text-xs leading-relaxed text-muted">
                            On an Apple device: Settings → your name → iCloud →
                            Access iCloud Data on the Web.
                          </span>
                        </span>
                      </label>

                      <p className="flex items-start gap-2 text-xs text-muted">
                        <CircleInfo
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden
                        />
                        Credentials are encrypted at rest. We never store your
                        normal Apple ID password.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </Drawer.Body>

            <Drawer.Footer>
              {step === "pick" ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onPress={onClose}
                    isDisabled={connecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onPress={handleConnect}
                    isDisabled={!canConnect}
                  >
                    {connecting ? "Connecting..." : "Connect Account"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onPress={onClose}
                    isDisabled={connecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => setStep("pick")}
                    isDisabled={connecting}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => void submitCredentials()}
                    isDisabled={!credentialsReady || connecting}
                  >
                    {connecting ? "Connecting..." : "Connect Account"}
                  </Button>
                </div>
              )}
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
