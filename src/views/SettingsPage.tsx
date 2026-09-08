"use client";

import {
  ArrowRotateRight,
  Bell,
  Camera,
  CircleInfo,
  Envelope,
  FileText,
  Key,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  TrashBin,
} from "@gravity-ui/icons";
import { Button, Switch, toast } from "@heroui/react";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConnectCloudAccountModal } from "@/components/dashboard/ConnectCloudAccountModal";
import { DummyModal } from "@/components/drive/DummyModal";
import { PageHeader } from "@/components/drive/PageHeader";
import {
  FormPageSkeleton,
  SectionSkeleton,
} from "@/components/drive/PageSkeletons";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { ProfilePasswordSection } from "@/components/profile-password-section";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import { UserAvatar } from "@/components/UserAvatar";
import { HookSidebar } from "@/components/ui/hook-sidebar";
import { useUserPlan } from "@/hooks/useUserPlan";
import { apiFetch, formatBytes } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { sessionUserToAuthUser } from "@/lib/auth-user";
import { getProfileImageUrl } from "@/lib/gravatar";
import { fileToAvatarDataUrl } from "@/lib/profile-avatar";
import { providerLabel } from "@/lib/providers";
import { syncGoogleProfileImageIfNeeded } from "@/lib/sync-google-avatar";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { id: "settings-profile", label: "Profile" },
  { id: "settings-password", label: "Password" },
  { id: "settings-subscription", label: "Subscription" },
  { id: "settings-preferences", label: "Preferences" },
  { id: "settings-accounts", label: "Accounts" },
  { id: "settings-api-keys", label: "API keys" },
  { id: "settings-delete", label: "Delete account" },
] as const;

const SETTINGS_SCROLL_OFFSET = 96;

function getScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  status: string;
  lastError?: string | null;
  createdAt?: string;
  storageAccount?: {
    totalBytes: string | null;
    usedBytes: string;
    availableBytes: string | null;
    lastSyncedAt: string | null;
  } | null;
};

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
};

const PREFS_KEY = "archivecloud:settings-prefs";

type RoutingMode = "most_available" | "round_robin" | "priority";
type RoutingPolicy = {
  mode: RoutingMode;
  priorityAccountIds: string[];
  roundRobinCursor: number;
};

type SettingsPrefs = {
  newsletter: boolean;
  defaultNotifications: boolean;
  announcements: boolean;
};

const DEFAULT_PREFS: SettingsPrefs = {
  newsletter: true,
  defaultNotifications: true,
  announcements: true,
};

const inputClassName =
  "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

function splitDisplayName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function joinDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function loadPrefs(): SettingsPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<SettingsPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: SettingsPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
  }
}

function providerIconTint(provider: string) {
  switch (provider) {
    case "google_drive":
    case "google_shared_drive":
    case "google_photos":
      return "bg-rose-50";
    case "dropbox":
      return "bg-sky-50";
    case "onedrive":
      return "bg-blue-50";
    case "pcloud":
      return "bg-indigo-50";
    default:
      return "bg-surface-secondary";
  }
}

function ConnectedAccountProviderIcon({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        providerIconTint(provider),
      )}
    >
      <ProviderBrandIcon
        name={provider}
        className="h-6 w-6"
        fallback={
          <span className="text-sm font-bold text-foreground">
            {providerLabel(provider).charAt(0)}
          </span>
        }
      />
    </span>
  );
}

function formatConnectedOn(createdAt?: string) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Connected on ${date.toLocaleDateString()}`;
}

function SettingsCard({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PrefSwitch({
  isSelected,
  onChange,
  isDisabled,
  "aria-label": ariaLabel,
}: {
  isSelected: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
  "aria-label": string;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      size="md"
      aria-label={ariaLabel}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

export function SettingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ? sessionUserToAuthUser(session.user) : null;
  const {
    plan: currentPlan,
    planId,
    hasThunder,
    hasFeature,
    bandwidthLabel,
    billingEnabled,
    canUpgrade,
    loaded: planLoaded,
  } = useUserPlan();
  const hasSmartDistribution = hasFeature("smartDistribution");

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<
    string | null
  >(null);
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ConnectedAccount | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicy>({
    mode: "most_available",
    priorityAccountIds: [],
    roundRobinCursor: 0,
  });
  const [routingSaving, setRoutingSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyName, setApiKeyName] = useState("");
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [revokingApiKeyId, setRevokingApiKeyId] = useState<string | null>(null);
  const [newApiKeySecret, setNewApiKeySecret] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<SettingsPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [newsletterSaving, setNewsletterSaving] = useState(false);
  const [activeNavIndex, setActiveNavIndex] = useState(0);
  const scrollingToRef = useRef<number | null>(null);
  const scrollClearTimerRef = useRef<number | null>(null);

  const setActiveNav = useCallback((index: number, updateHash = true) => {
    setActiveNavIndex(index);
    if (!updateHash) return;
    const id = SETTINGS_NAV[index]?.id;
    if (!id) return;
    const hash = `#${id}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, []);

  const scrollToSettingsSection = useCallback(
    (index: number) => {
      const id = SETTINGS_NAV[index]?.id;
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      setActiveNav(index);
      scrollingToRef.current = index;
      if (scrollClearTimerRef.current !== null) {
        window.clearTimeout(scrollClearTimerRef.current);
        scrollClearTimerRef.current = null;
      }

      const scroller = getScrollParent(target);
      if (scroller) {
        const top =
          target.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop -
          SETTINGS_SCROLL_OFFSET;
        const maxTop = Math.max(
          0,
          scroller.scrollHeight - scroller.clientHeight,
        );
        scroller.scrollTo({
          top: Math.min(Math.max(0, top), maxTop),
          behavior: "smooth",
        });
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      const unlock = () => {
        if (scrollClearTimerRef.current !== null) {
          window.clearTimeout(scrollClearTimerRef.current);
          scrollClearTimerRef.current = null;
        }
        scrollingToRef.current = null;
        scroller?.removeEventListener("scrollend", unlock);
      };

      scroller?.addEventListener("scrollend", unlock, { once: true });
      scrollClearTimerRef.current = window.setTimeout(unlock, 1200);
    },
    [setActiveNav],
  );

  useEffect(() => {
    if (isPending) return;

    const first = document.getElementById(SETTINGS_NAV[0].id);
    const scroller = getScrollParent(first);
    const lastIndex = SETTINGS_NAV.length - 1;

    const syncActiveFromScroll = () => {
      if (scrollingToRef.current !== null) return;

      if (scroller) {
        const remaining =
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        if (remaining <= 80) {
          setActiveNav(lastIndex);
          return;
        }
      }

      const rootTop = scroller?.getBoundingClientRect().top ?? 0;
      let next = 0;
      for (let i = 0; i < SETTINGS_NAV.length; i += 1) {
        const el = document.getElementById(SETTINGS_NAV[i].id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - rootTop;
        if (top <= SETTINGS_SCROLL_OFFSET + 12) next = i;
      }
      setActiveNav(next);
    };

    const scrollTarget: HTMLElement | Window = scroller ?? window;
    scrollTarget.addEventListener("scroll", syncActiveFromScroll, {
      passive: true,
    });
    window.addEventListener("resize", syncActiveFromScroll);
    syncActiveFromScroll();

    return () => {
      scrollTarget.removeEventListener("scroll", syncActiveFromScroll);
      window.removeEventListener("resize", syncActiveFromScroll);
      if (scrollClearTimerRef.current !== null) {
        window.clearTimeout(scrollClearTimerRef.current);
      }
    };
  }, [isPending, setActiveNav]);

  useEffect(() => {
    if (isPending) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const index = SETTINGS_NAV.findIndex((item) => item.id === hash);
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToSettingsSection(index);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isPending, scrollToSettingsSection]);

  const initialNames = useMemo(
    () => splitDisplayName(user?.name ?? ""),
    [user?.name],
  );
  const nameDirty =
    firstName.trim() !== initialNames.firstName ||
    lastName.trim() !== initialNames.lastName;
  const canSaveName =
    nameDirty &&
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    !savingName;

  const hasCredentialAccount = linkedAccounts.some(
    (account) => account.providerId === "credential",
  );
  const isGoogleUser = linkedAccounts.some(
    (account) => account.providerId === "google",
  );

  const loadApiKeys = useCallback(async () => {
    const data = await apiFetch<{ keys: ApiKeyRow[] }>("/api-keys");
    setApiKeys(data.keys);
  }, []);

  const loadLinkedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        toast.danger(error.message ?? "Failed to load sign-in methods");
        return;
      }
      setLinkedAccounts((data ?? []) as LinkedAccount[]);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  async function loadAccounts() {
    const accountsData = await apiFetch<{ accounts: ConnectedAccount[] }>(
      "/connected-accounts",
    );
    setAccounts(accountsData.accounts);
  }

  function reloadAfterConnect() {
    loadAccounts()
      .then(() => {
        window.dispatchEvent(new Event("archivecloud:storage-changed"));
      })
      .catch(() => undefined);
  }

  function updatePrefs(patch: Partial<SettingsPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }

  async function setNewsletterSubscribed(subscribed: boolean) {
    const previous = prefs.newsletter;
    updatePrefs({ newsletter: subscribed });
    setNewsletterSaving(true);
    try {
      const data = await apiFetch<{ subscribed: boolean }>(
        "/account/newsletter",
        {
          method: "PATCH",
          body: JSON.stringify({ subscribed }),
        },
      );
      updatePrefs({ newsletter: data.subscribed });
    } catch {
      updatePrefs({ newsletter: previous });
      toast.danger("Could not update newsletter preference.");
    } finally {
      setNewsletterSaving(false);
    }
  }

  useEffect(() => {
    const local = loadPrefs();
    setPrefs(local);
    setPrefsReady(true);

    void apiFetch<{ subscribed: boolean }>("/account/newsletter")
      .then((data) => {
        setPrefs((prev) => {
          const next = { ...prev, newsletter: data.subscribed };
          savePrefs(next);
          return next;
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const names = splitDisplayName(user?.name ?? "");
    setFirstName(names.firstName);
    setLastName(names.lastName);
  }, [user?.name]);

  useEffect(() => {
    setAvatarError(false);
    setProfileImageUrl(
      getProfileImageUrl({
        image: user?.image,
        email: user?.email,
        size: 512,
      }),
    );
    void syncGoogleProfileImageIfNeeded(user?.image).then((image) => {
      if (image) {
        setProfileImageUrl(image);
        setAvatarError(false);
      }
    });
  }, [user?.image, user?.email]);

  useEffect(() => {
    loadAccounts().catch(() => undefined);
    loadApiKeys().catch(() => undefined);
    loadLinkedAccounts().catch(() => undefined);
  }, [loadApiKeys, loadLinkedAccounts]);

  useEffect(() => {
    if (!planLoaded || !hasSmartDistribution) return;
    void apiFetch<{ policy: RoutingPolicy }>("/storage/routing-policy")
      .then((data) => setRoutingPolicy(data.policy))
      .catch(() => undefined);
  }, [planLoaded, hasSmartDistribution]);

  async function saveRoutingPolicy(nextPolicy: RoutingPolicy) {
    setRoutingSaving(true);
    try {
      const data = await apiFetch<{ policy: RoutingPolicy }>(
        "/storage/routing-policy",
        {
          method: "PATCH",
          body: JSON.stringify({
            mode: nextPolicy.mode,
            priorityAccountIds: nextPolicy.priorityAccountIds,
          }),
        },
      );
      setRoutingPolicy(data.policy);
      toast.success("Upload routing policy updated.");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to update routing policy",
      );
    } finally {
      setRoutingSaving(false);
    }
  }

  async function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSavingAvatar(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const { error } = await authClient.updateUser({ image: dataUrl });
      if (error) {
        toast.danger(error.message ?? "Failed to update profile photo");
        return;
      }
      setProfileImageUrl(dataUrl);
      setAvatarError(false);
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to update photo",
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const trimmed = joinDisplayName(firstName, lastName);
    if (!firstName.trim()) {
      toast.danger("First name cannot be empty.");
      return;
    }
    if (!lastName.trim()) {
      toast.danger("Last name cannot be empty.");
      return;
    }
    if (trimmed === (user?.name ?? "").trim()) {
      toast.info("No changes to save.");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) {
        toast.danger(error.message ?? "Failed to update profile");
        return;
      }
      toast.success("Profile updated.");
    } finally {
      setSavingName(false);
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId);
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, {
        method: "POST",
      });
      await loadAccounts();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function disconnect() {
    if (!accountToDisconnect) return;
    setDisconnectingAccountId(accountToDisconnect.id);
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, {
        method: "DELETE",
      });
      setAccountToDisconnect(null);
      toast.success("Storage account disconnected.");
      await loadAccounts();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to disconnect storage account",
      );
    } finally {
      setDisconnectingAccountId(null);
    }
  }

  async function createApiKey() {
    const name = apiKeyName.trim() || "API key";
    setCreatingApiKey(true);
    try {
      const created = await apiFetch<{ key: ApiKeyRow; secret: string }>(
        "/api-keys",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            scopes: ["accounts:read", "transfers"],
          }),
        },
      );
      setNewApiKeySecret(created.secret);
      setApiKeyName("");
      toast.success("API key created.");
      await loadApiKeys();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to create API key",
      );
    } finally {
      setCreatingApiKey(false);
    }
  }

  async function revokeApiKey(id: string) {
    setRevokingApiKeyId(id);
    try {
      await apiFetch(`/api-keys/${id}`, { method: "DELETE" });
      toast.success("API key revoked.");
      await loadApiKeys();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to revoke API key",
      );
    } finally {
      setRevokingApiKeyId(null);
    }
  }

  if (isPending) {
    return (
      <main className="p-8">
        <FormPageSkeleton label="Loading settings" />
      </main>
    );
  }

  return (
    <>
      <div className="relative flex gap-20 pb-8 lg:gap-28">
        <div className="min-w-0 flex-1 space-y-5">
          {}
          <div id="settings-profile" className="scroll-mt-24">
            <PageHeader
              title="Profile"
              description="Manage your personal information and account security."
            />

            <div className="mt-5">
              <h2 className="text-lg font-bold text-foreground">
                Personal information
              </h2>

              <div className="mt-5 flex flex-col gap-2">
                <div className="group relative size-24 shrink-0 overflow-hidden rounded-full">
                  <UserAvatar
                    name={user?.name}
                    email={user?.email}
                    imageUrl={
                      profileImageUrl && !avatarError ? profileImageUrl : null
                    }
                    size="lg"
                    className="size-24"
                    fallbackClassName="text-2xl font-bold"
                    alt="User"
                    onImageError={() => setAvatarError(true)}
                  />
                  <button
                    type="button"
                    className="absolute inset-x-0 bottom-0 z-10 flex h-1/2 w-full cursor-pointer items-center justify-center rounded-b-full border-0 bg-black/40 p-0 opacity-0 shadow-none transition-opacity hover:bg-black/50 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={savingAvatar}
                    aria-label="Change photo"
                  >
                    <Camera className="size-5 text-white" aria-hidden />
                    <span className="sr-only">Change photo</span>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={onAvatarFileChange}
                  />
                </div>
                <p className="text-sm text-muted">
                  {savingAvatar ? "Updating photo..." : ".jpg or .png, max 1MB"}
                </p>
              </div>

              <form className="mt-6" onSubmit={saveProfile}>
                <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.55fr)]">
                  <div className="grid min-w-0 gap-1.5">
                    <label
                      htmlFor="settings-first-name"
                      className="flex min-h-5 items-center text-sm font-medium text-foreground"
                    >
                      First name <span className="ml-0.5 text-danger">*</span>
                    </label>
                    <input
                      id="settings-first-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      required
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p
                      className="min-h-4 text-xs text-transparent select-none"
                      aria-hidden
                    >
                      &nbsp;
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <label
                      htmlFor="settings-last-name"
                      className="flex min-h-5 items-center text-sm font-medium text-foreground"
                    >
                      Last name <span className="ml-0.5 text-danger">*</span>
                    </label>
                    <input
                      id="settings-last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      required
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p
                      className="min-h-4 text-xs text-transparent select-none"
                      aria-hidden
                    >
                      &nbsp;
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <label
                      htmlFor="settings-email"
                      className="flex min-h-5 items-center text-sm font-medium text-foreground"
                    >
                      Email address{" "}
                      <span className="ml-0.5 text-danger">*</span>
                    </label>
                    <div className="relative">
                      <Envelope className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input
                        id="settings-email"
                        type="email"
                        value={user?.email ?? ""}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-10 w-full cursor-default rounded-xl border border-border bg-surface-secondary py-2 pr-10 pl-10 text-sm text-muted focus:outline-none"
                      />
                      <Lock className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" />
                    </div>
                    <p className="min-h-4 text-xs text-muted">
                      Email addresses are verified and cannot be changed here.
                    </p>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="mt-5"
                  isDisabled={!canSaveName}
                >
                  {savingName ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </div>
          </div>

          <div id="settings-password" className="scroll-mt-24">
            {!loadingAccounts ? (
              <ProfilePasswordSection
                email={user?.email ?? ""}
                hasCredentialAccount={hasCredentialAccount}
                isGoogleUser={isGoogleUser}
                onCredentialLinked={loadLinkedAccounts}
              />
            ) : (
              <SectionSkeleton rows={4} label="Loading password settings" />
            )}
          </div>

          {}
          <div className="pt-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              Settings
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage your smart file distribution, connected services,
              subscription, and billing
            </p>
          </div>

          <SettingsCard id="settings-subscription">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    Subscription & Billing
                  </h3>
                  <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                    {currentPlan.name} plan
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  You are on the {currentPlan.name} plan · {bandwidthLabel}{" "}
                  transfers
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {hasThunder ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CircleInfo className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Thunder lifetime access
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Automation, folder sync, real-time sync, and smart
                        routing are enabled on your account.
                      </p>
                    </div>
                  </div>
                  {billingEnabled ? (
                    <Link href="/billing/portal">
                      <Button size="sm" variant="outline" className="shrink-0">
                        Billing portal
                      </Button>
                    </Link>
                  ) : null}
                </div>
              ) : canUpgrade ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CircleInfo className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Upgrade plan
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Automation, folder sync, real-time sync, and unlimited
                        bandwidth. $9 lifetime.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="shrink-0"
                    onPress={() => setUpgradeOpen(true)}
                  >
                    Upgrade
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-secondary/60 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CircleInfo className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Free plan
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Thunder features on this instance are managed by your
                        administrator. Contact them to upgrade your account.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      Billing & invoices
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      View payment history when checkout is live.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onPress={() =>
                    toast.info(
                      "Billing history will appear after payments go live.",
                    )
                  }
                >
                  History
                </Button>
              </div>
            </div>
          </SettingsCard>

          <div id="settings-preferences" className="scroll-mt-24 space-y-5">
            <SettingsCard>
              <h3 className="text-base font-bold text-foreground">
                Smart File Distribution
              </h3>
              <p className="mt-2 text-sm text-muted">
                Automatically route uploads across Google Drive, Dropbox,
                OneDrive, and other connected clouds based on available space
                and your routing policy.
              </p>
              {hasSmartDistribution ? (
                <div className="mt-4 grid gap-3 sm:max-w-md">
                  <label className="grid gap-2 text-sm font-semibold text-foreground">
                    Routing mode
                    <select
                      className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium"
                      value={routingPolicy.mode}
                      disabled={routingSaving}
                      onChange={(event) =>
                        void saveRoutingPolicy({
                          ...routingPolicy,
                          mode: event.target.value as RoutingMode,
                        })
                      }
                    >
                      <option value="most_available">
                        Most available space
                      </option>
                      <option value="round_robin">Round robin</option>
                      <option value="priority">Priority order</option>
                    </select>
                  </label>
                  <p className="text-xs text-muted">
                    Set account priority order on the{" "}
                    <Link
                      href="/quota"
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      Quota Tracker
                    </Link>{" "}
                    page.
                  </p>
                </div>
              ) : canUpgrade ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PrefSwitch
                    isSelected={false}
                    onChange={() => setUpgradeOpen(true)}
                    aria-label="Smart file distribution"
                  />
                  <Button size="sm" onPress={() => setUpgradeOpen(true)}>
                    Upgrade to Enable
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Smart routing is a Thunder feature. Ask your instance
                  administrator to enable Thunder on your account.
                </p>
              )}
            </SettingsCard>

            <SettingsCard>
              <div className="flex items-center gap-2">
                <Envelope className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Newsletter
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted">
                Stay updated with product tips, feature launches, and
                Archive Cloud news.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  Subscribe to Newsletter
                </p>
                {prefsReady ? (
                  <PrefSwitch
                    isSelected={prefs.newsletter}
                    isDisabled={newsletterSaving}
                    onChange={(value) => void setNewsletterSubscribed(value)}
                    aria-label="Subscribe to newsletter"
                  />
                ) : null}
              </div>
            </SettingsCard>

            <SettingsCard>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Notifications
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted">
                Receive push notifications for file operations like upload,
                download, copy, and move, along with important updates and
                offers.
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-3">
                  <div className="flex items-start gap-3">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Default Notifications
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Important updates about your files and account activity.
                      </p>
                    </div>
                  </div>
                  {prefsReady ? (
                    <PrefSwitch
                      isSelected={prefs.defaultNotifications}
                      onChange={(value) =>
                        updatePrefs({ defaultNotifications: value })
                      }
                      aria-label="Default notifications"
                    />
                  ) : null}
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-3">
                  <div className="flex items-start gap-3">
                    <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Announcements
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Offers, tips, product updates, and promotional messages.
                      </p>
                    </div>
                  </div>
                  {prefsReady ? (
                    <PrefSwitch
                      isSelected={prefs.announcements}
                      onChange={(value) =>
                        updatePrefs({ announcements: value })
                      }
                      aria-label="Announcements"
                    />
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-muted">
                <CircleInfo className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                You can update your preferences at any time.
              </div>
            </SettingsCard>
          </div>

          {}
          <SettingsCard id="settings-accounts">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-foreground">
                  Connected Accounts
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Manage your cloud storage integrations
                </p>
              </div>
              <Button
                variant="primary"
                className="shrink-0"
                onPress={() => setConnectOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Connect Account
              </Button>
            </div>

            {accounts.length === 0 ? (
              <div className="mt-6 flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border px-4 py-8">
                <p className="text-center text-sm text-muted">
                  No connected accounts yet. Click Connect Account to link a
                  cloud.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => {
                  const title =
                    account.displayName?.trim() ||
                    `My ${providerLabel(account.provider)}`;
                  const connectedOn = formatConnectedOn(account.createdAt);
                  const isSyncing = syncingAccountId === account.id;

                  return (
                    <div
                      key={account.id}
                      className="rounded-2xl border border-border bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <ConnectedAccountProviderIcon
                          provider={account.provider}
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Sync quota"
                            aria-label={`Sync ${title}`}
                            disabled={isSyncing}
                            onClick={() =>
                              sync(account.id).catch(() => undefined)
                            }
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                          >
                            {isSyncing ? (
                              <ArrowRotateRight className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Disconnect"
                            aria-label={`Disconnect ${title}`}
                            onClick={() => setAccountToDisconnect(account)}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                          >
                            <TrashBin className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted">
                          {providerLabel(account.provider)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {account.email}
                        </p>
                        {connectedOn ? (
                          <p className="mt-0.5 text-xs text-muted">
                            {connectedOn}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SettingsCard>

          {}
          <SettingsCard id="settings-api-keys">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-foreground" />
              <h3 className="text-base font-bold text-foreground">API keys</h3>
            </div>
            <p className="mt-2 text-sm text-muted">
              Automate Archive Cloud with Bearer keys for{" "}
              <code className="rounded bg-surface-secondary px-1 text-xs">
                /api/v1/accounts
              </code>{" "}
              and{" "}
              <code className="rounded bg-surface-secondary px-1 text-xs">
                /api/v1/transfers
              </code>
              .
            </p>
            {newApiKeySecret ? (
              <div className="mt-3 rounded-xl border border-border bg-surface-secondary p-3">
                <p className="text-xs font-semibold text-muted">
                  Copy this key now. It won’t be shown again.
                </p>
                <code className="mt-2 block break-all text-sm">
                  {newApiKeySecret}
                </code>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      void navigator.clipboard.writeText(newApiKeySecret);
                      toast.success("Copied to clipboard.");
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setNewApiKeySecret(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className={`${inputClassName} max-w-xs`}
                placeholder="Key name (e.g. CI bot)"
                value={apiKeyName}
                onChange={(event) => setApiKeyName(event.target.value)}
              />
              <Button
                size="sm"
                onPress={() => createApiKey().catch(() => undefined)}
                isDisabled={creatingApiKey}
              >
                {creatingApiKey ? "Creating..." : "Create API key"}
              </Button>
            </div>
            <div className="mt-3 grid gap-2">
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted">No API keys yet.</p>
              ) : (
                apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{key.name}</p>
                      <p className="text-xs text-muted">
                        {key.keyPrefix}… · {key.status}
                      </p>
                    </div>
                    {key.status === "active" ? (
                      <Button
                        size="sm"
                        variant="danger"
                        isDisabled={revokingApiKeyId === key.id}
                        onPress={() =>
                          revokeApiKey(key.id).catch(() => undefined)
                        }
                      >
                        {revokingApiKeyId === key.id ? "Revoking..." : "Revoke"}
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </SettingsCard>

          <DeleteAccountSection email={user?.email ?? ""} />

          {}
          <div aria-hidden className="h-[45vh] shrink-0" />
        </div>

        <aside className="hidden w-40 shrink-0 lg:block">
          <div className="sticky top-24">
            <HookSidebar
              items={SETTINGS_NAV.map((item) => item.label)}
              value={activeNavIndex}
              onChange={scrollToSettingsSection}
              color="var(--primary)"
              aria-label="Settings sections"
            />
          </div>
        </aside>
      </div>

      <ConnectCloudAccountModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={reloadAfterConnect}
      />

      {canUpgrade ? (
        <UpgradePlanModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          currentPlanId={planId}
        />
      ) : null}

      <DummyModal
        open={Boolean(accountToDisconnect)}
        title="Disconnect storage?"
        description="This will remove this storage account from Archive Cloud."
        onClose={() => setAccountToDisconnect(null)}
      >
        <div className="grid gap-4">
          <div className="rounded-xl bg-background-secondary p-4 text-sm text-muted">
            <p className="font-semibold text-foreground">
              {accountToDisconnect?.email}
            </p>
            <p className="mt-1">
              {accountToDisconnect
                ? providerLabel(accountToDisconnect.provider)
                : null}
            </p>
            <p className="mt-1">
              Used storage:{" "}
              {formatBytes(accountToDisconnect?.storageAccount?.usedBytes)}
            </p>
          </div>
          <div className="grid gap-3 sm:flex sm:justify-end">
            <Button
              variant="outline"
              onPress={() => setAccountToDisconnect(null)}
              isDisabled={Boolean(disconnectingAccountId)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={disconnect}
              isDisabled={Boolean(disconnectingAccountId)}
            >
              <TrashBin className="h-4 w-4" />
              {disconnectingAccountId ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      </DummyModal>
    </>
  );
}
