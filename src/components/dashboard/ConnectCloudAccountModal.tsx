"use client";

import {
  ChevronRight,
  CircleInfo,
  Cloud,
  Eye,
  EyeSlash,
  Globe,
  ShieldCheck,
} from "@gravity-ui/icons";
import { Button, Drawer, Tooltip, toast, useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { apiFetch } from "@/lib/api";
import { sanitizeConnectAliasInput } from "@/lib/connect-alias";
import {
  connectOAuthPopup,
  connectOAuthRedirect,
  isGoogleOAuthProvider,
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

const ICLOUD_WEB_ACCESS_PATH = [
  "Apple Device",
  "Settings",
  "Your Name",
  "iCloud",
  "Access iCloud Data on the Web",
] as const;

function ICloudBeforeConnectPanel() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e8ecf2] bg-[#f4f7fa]">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Cloud className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-[11px] font-bold tracking-wider text-primary uppercase">
          Before you connect
        </p>
      </div>

      <div className="border-t border-dashed border-[#d7dee8] px-4 py-4">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Globe className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              Enable Web Access
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Turn on{" "}
              <span className="font-semibold text-foreground">
                Access iCloud Data on the Web
              </span>{" "}
              in your Apple settings before connecting.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {ICLOUD_WEB_ACCESS_PATH.map((step, index) => {
                const isLast = index === ICLOUD_WEB_ACCESS_PATH.length - 1;
                return (
                  <span key={step} className="flex items-center gap-1.5">
                    {index > 0 ? (
                      <ChevronRight
                        className="h-3 w-3 shrink-0 text-muted"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-semibold",
                        isLast
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-white text-foreground shadow-sm ring-1 ring-[#e8ecf2]",
                      )}
                    >
                      {step}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-[#d7dee8] px-4 py-4">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              Secure Connection
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Your Apple ID password is used to sign in and create a trusted
              session. Session data is encrypted at rest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
  const onConnectedRef = useRef(onConnected);
  const onCloseRef = useRef(onClose);
  onConnectedRef.current = onConnected;
  onCloseRef.current = onClose;

  const [alias, setAlias] = useState("");
  const [selectedId, setSelectedId] = useState<SupportedProviderId | null>(
    null,
  );
  const [step, setStep] = useState<"pick" | "credentials" | "mfa">("pick");
  const [connecting, setConnecting] = useState(false);

  const [appleId, setAppleId] = useState("");
  const [applePassword, setApplePassword] = useState("");
  const [showApplePassword, setShowApplePassword] = useState(false);
  const [icloudWebAccessOn, setIcloudWebAccessOn] = useState(false);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

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
    setApplePassword("");
    setShowApplePassword(false);
    setIcloudWebAccessOn(false);
    setMfaChallengeId(null);
    setMfaCode("");
  }, [open, initialProviderId]);

  function selectProvider(providerId: SupportedProviderId) {
    const provider = CONNECT_PROVIDERS.find((p) => p.id === providerId);
    setSelectedId(providerId);
    if (provider) setAlias(defaultAliasForProvider(provider.label));
  }

  function finishConnected(options?: {
    type?: string;
    accountId?: string;
    toastMessage?: string;
  }) {
    if (options?.toastMessage) toast.success(options.toastMessage);
    notifyStorageChanged();
    onConnectedRef.current?.();
    onCloseRef.current();
    if (options?.type === "GOOGLE_PHOTOS_CONNECTED" && options.accountId) {
      router.push(
        `/home?accountId=${encodeURIComponent(options.accountId)}&photosHowto=1`,
      );
    }
  }

  async function startOAuth(provider: ConnectProvider) {
    if (!provider.connectUrlPath || !provider.popupName) return;
    setConnecting(true);
    try {
      const connectUrl = new URL(
        provider.connectUrlPath,
        window.location.origin,
      );
      connectUrl.searchParams.set("alias", alias.trim());
      const connectUrlPath = `${connectUrl.pathname}${connectUrl.search}`;

      // Google: full-page OAuth (account chooser), not an in-app popup.
      if (isGoogleOAuthProvider(provider.id)) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        connectOAuthRedirect({
          connectUrlPath,
          returnTo: returnTo.startsWith("/") ? returnTo : "/home",
        });
        return;
      }

      const result = await connectOAuthPopup({
        connectUrlPath,
        popupName: provider.popupName,
      });

      if (result.status === "redirect") return;

      if (result.status === "success") {
        const config = result.type
          ? OAUTH_CONNECT_MESSAGE_HANDLERS[result.type]
          : undefined;
        finishConnected({
          type: result.type,
          accountId: result.accountId,
          toastMessage: config?.success ?? `${provider.label} connected.`,
        });
        return;
      }

      if (result.status === "failure") {
        const config = result.type
          ? OAUTH_CONNECT_MESSAGE_HANDLERS[result.type]
          : undefined;
        toast.danger(config?.failure ?? `${provider.label} connection failed.`);
        return;
      }

      // Popup closed without an explicit result — close drawer and refresh.
      // Do not assume success (user may have cancelled).
      notifyStorageChanged();
      onCloseRef.current();
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
        const result = await apiFetch<{
          needsMfa?: boolean;
          challengeId?: string;
          account?: { id: string };
        }>("/connected-accounts/icloud/connect", {
          method: "POST",
          body: JSON.stringify({
            appleId: appleId.trim(),
            password: applePassword,
            provider: selected.id,
            alias: alias.trim(),
          }),
        });
        if (result.needsMfa && result.challengeId) {
          setMfaChallengeId(result.challengeId);
          setMfaCode("");
          setStep("mfa");
          return;
        }
        toast.success(`${PROVIDER_LABELS[selected.id]} connected.`);
      }
      notifyStorageChanged();
      onConnectedRef.current?.();
      onCloseRef.current();
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

  async function submitMfa() {
    if (!selected || !mfaChallengeId) return;
    setConnecting(true);
    try {
      await apiFetch("/connected-accounts/icloud/mfa", {
        method: "POST",
        body: JSON.stringify({
          challengeId: mfaChallengeId,
          code: mfaCode.trim(),
        }),
      });
      toast.success(`${PROVIDER_LABELS[selected.id]} connected.`);
      notifyStorageChanged();
      onConnectedRef.current?.();
      onCloseRef.current();
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Invalid verification code. Try again.",
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
      ? Boolean(appleId.trim() && applePassword && icloudWebAccessOn)
      : false;
  const mfaReady = Boolean(mfaChallengeId && mfaCode.trim().length >= 4);

  return (
    <Drawer state={state}>
      <Drawer.Backdrop isDismissable={!connecting}>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="h-full w-full max-w-lg sm:max-w-xl">
            <Drawer.CloseTrigger isDisabled={connecting} />
            <Drawer.Header className="pb-2">
              <Drawer.Heading className="text-xl font-bold tracking-tight text-foreground">
                Connect Cloud Account
              </Drawer.Heading>
            </Drawer.Header>

            <Drawer.Body className="pt-1">
              {step === "pick" ? (
                <div className="grid gap-6">
                  <div className="grid gap-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <label
                        htmlFor="connect-account-alias"
                        className="flex items-center gap-1.5"
                      >
                        Account name (Alias)
                        <span className="text-danger" aria-hidden>
                          *
                        </span>
                      </label>
                      <Tooltip delay={0}>
                        <Button
                          isIconOnly
                          aria-label="Alias naming rules"
                          variant="tertiary"
                          size="sm"
                          className="h-5 w-5 min-w-5 text-muted"
                        >
                          <CircleInfo className="h-3.5 w-3.5" />
                        </Button>
                        <Tooltip.Content showArrow placement="right">
                          <Tooltip.Arrow />
                          <p>
                            Only letters, numbers, spaces, underscores (_), dots
                            (.), and hyphens (-) are allowed.
                          </p>
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted">
                      You can change this later
                    </p>
                    <input
                      id="connect-account-alias"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Enter account name"
                      value={alias}
                      onChange={(event) =>
                        setAlias(sanitizeConnectAliasInput(event.target.value))
                      }
                      autoComplete="off"
                      maxLength={50}
                    />
                    <p className="text-right text-xs text-muted">
                      {alias.length}/50
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
              ) : step === "mfa" ? (
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
                        Two-factor authentication
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Check your iPhone, iPad, or Mac for a prompt with a
                        6-digit code (not an email OTP).
                      </p>
                    </div>
                  </div>

                  <label className="grid gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      Verification code
                    </span>
                    <input
                      className={fieldClass}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={mfaCode}
                      onChange={(e) =>
                        setMfaCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                    />
                  </label>
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
                        {selected?.id === "icloud_photos"
                          ? "Connect your iCloud Photos"
                          : selected?.id === "icloud_drive"
                            ? "Connect your iCloud Drive"
                            : selected?.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Saving as “{alias.trim()}”
                      </p>
                    </div>
                  </div>

                  {selected?.id === "icloud_drive" ||
                  selected?.id === "icloud_photos" ? (
                    <div className="grid gap-5">
                      <ICloudBeforeConnectPanel />

                      <label className="grid gap-1.5">
                        <span className="text-sm font-semibold text-foreground">
                          Apple ID (email or phone number)
                        </span>
                        <input
                          className={fieldClass}
                          type="text"
                          placeholder="Apple ID"
                          value={appleId}
                          onChange={(e) => setAppleId(e.target.value)}
                          autoComplete="username"
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-sm font-semibold text-foreground">
                          Password
                        </span>
                        <div className="relative">
                          <input
                            className={cn(fieldClass, "pr-10")}
                            type={showApplePassword ? "text" : "password"}
                            placeholder="Apple ID password"
                            value={applePassword}
                            onChange={(e) => setApplePassword(e.target.value)}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-black/5 hover:text-foreground"
                            onClick={() =>
                              setShowApplePassword((value) => !value)
                            }
                            aria-label={
                              showApplePassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showApplePassword ? (
                              <EyeSlash className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-3 transition-colors hover:bg-surface-secondary has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                          checked={icloudWebAccessOn}
                          onChange={(e) =>
                            setIcloudWebAccessOn(e.target.checked)
                          }
                        />
                        <span className="grid min-w-0 gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            I enabled Access iCloud Data on the Web
                          </span>
                          <span className="text-xs leading-relaxed text-muted">
                            Required before Archive Cloud can link this Apple
                            account.
                          </span>
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>
              )}
            </Drawer.Body>

            <Drawer.Footer>
              {step === "pick" ? (
                <div className="flex flex-row gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 sm:flex-none"
                    onPress={onClose}
                    isDisabled={connecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="min-w-0 flex-1 sm:flex-none"
                    onPress={handleConnect}
                    isDisabled={!canConnect}
                  >
                    {connecting ? "Connecting..." : "Connect Account"}
                  </Button>
                </div>
              ) : step === "mfa" ? (
                <div className="flex flex-row flex-wrap gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 sm:flex-none"
                    onPress={onClose}
                    isDisabled={connecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 sm:flex-none"
                    onPress={() => {
                      setStep("credentials");
                      setMfaChallengeId(null);
                      setMfaCode("");
                    }}
                    isDisabled={connecting}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    className="min-w-0 flex-[1_1_100%] sm:flex-none"
                    onPress={() => void submitMfa()}
                    isDisabled={!mfaReady || connecting}
                  >
                    {connecting ? "Verifying..." : "Verify & Connect"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-row flex-wrap gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 sm:flex-none"
                    onPress={onClose}
                    isDisabled={connecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 sm:flex-none"
                    onPress={() => setStep("pick")}
                    isDisabled={connecting}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    className="min-w-0 flex-[1_1_100%] sm:flex-none"
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
