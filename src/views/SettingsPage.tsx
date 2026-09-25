"use client";

import {
  Bell,
  Camera,
  CircleInfo,
  Envelope,
  FileText,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  TrashBin,
  TriangleExclamation,
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
import {
  loadProviderOrder,
  PROVIDER_ORDER_CHANGED_EVENT,
  sortAccountsByProviderOrder,
} from "@/lib/provider-order";
import { syncGoogleProfileImageIfNeeded } from "@/lib/sync-google-avatar";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { id: "settings-profile", label: "Profile" },
  { id: "settings-password", label: "Password" },
  { id: "settings-subscription", label: "Subscription" },
  { id: "settings-preferences", label: "Preferences" },
  { id: "settings-accounts", label: "Accounts" },
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
  } catch {}
}

function ConnectedAccountProviderIcon({ provider }: { provider: string }) {
  return (
    <ProviderBrandIcon
      name={provider}
      className="h-8 w-8"
      fallback={
        <span className="text-sm font-bold text-foreground">
          {providerLabel(provider).charAt(0)}
        </span>
      }
    />
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
  const [providerOrder, setProviderOrder] = useState<string[]>([]);
  const orderedAccounts = useMemo(
    () => sortAccountsByProviderOrder(accounts, providerOrder),
    [accounts, providerOrder],
  );
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<
    string | null
  >(null);
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ConnectedAccount | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<ConnectedAccount | null>(
    null,
  );
  const [editAlias, setEditAlias] = useState("");
  const [savingAlias, setSavingAlias] = useState(false);
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

  const loadAccounts = useCallback(async () => {
    const accountsData = await apiFetch<{ accounts: ConnectedAccount[] }>(
      "/connected-accounts",
    );
    setAccounts(accountsData.accounts);
  }, []);

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
    loadLinkedAccounts().catch(() => undefined);
  }, [loadAccounts, loadLinkedAccounts]);

  useEffect(() => {
    setProviderOrder(loadProviderOrder());
    function onProviderOrderChanged() {
      setProviderOrder(loadProviderOrder());
    }
    window.addEventListener(
      PROVIDER_ORDER_CHANGED_EVENT,
      onProviderOrderChanged,
    );
    window.addEventListener("storage", onProviderOrderChanged);
    return () => {
      window.removeEventListener(
        PROVIDER_ORDER_CHANGED_EVENT,
        onProviderOrderChanged,
      );
      window.removeEventListener("storage", onProviderOrderChanged);
    };
  }, []);

  useEffect(() => {
    function onStorageChanged() {
      loadAccounts().catch(() => undefined);
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        loadAccounts().catch(() => undefined);
        setProviderOrder(loadProviderOrder());
      }
    }
    window.addEventListener("archivecloud:storage-changed", onStorageChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(
        "archivecloud:storage-changed",
        onStorageChanged,
      );
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadAccounts]);

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

  function openEditAlias(account: ConnectedAccount) {
    const current =
      account.displayName?.trim() || `My ${providerLabel(account.provider)}`;
    setAccountToEdit(account);
    setEditAlias(current.slice(0, 50));
  }

  function closeEditAlias() {
    if (savingAlias) return;
    setAccountToEdit(null);
    setEditAlias("");
  }

  async function saveAlias() {
    if (!accountToEdit) return;
    const nextAlias = editAlias.trim();
    if (!nextAlias) {
      toast.danger("Alias cannot be empty.");
      return;
    }
    const current =
      accountToEdit.displayName?.trim() ||
      `My ${providerLabel(accountToEdit.provider)}`;
    if (nextAlias === current) {
      closeEditAlias();
      return;
    }
    setSavingAlias(true);
    try {
      await apiFetch(`/connected-accounts/${accountToEdit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ alias: nextAlias }),
      });
      toast.success("Account renamed.");
      setAccountToEdit(null);
      setEditAlias("");
      await loadAccounts();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to update alias",
      );
    } finally {
      setSavingAlias(false);
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
                <div className="group relative w-fit shrink-0">
                  <UserAvatar
                    name={user?.name}
                    email={user?.email}
                    imageUrl={
                      profileImageUrl && !avatarError ? profileImageUrl : null
                    }
                    size="lg"
                    storyRing
                    storyRingThick
                    className="size-24"
                    fallbackClassName="text-2xl font-bold"
                    alt="User"
                    onImageError={() => setAvatarError(true)}
                  />
                  <button
                    type="button"
                    className="absolute inset-[6px] z-10 flex cursor-pointer items-end justify-center overflow-hidden rounded-full border-0 bg-transparent p-0 opacity-0 shadow-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={savingAvatar}
                    aria-label="Change photo"
                  >
                    <span className="flex h-1/2 w-full items-center justify-center bg-black/40 hover:bg-black/50">
                      <Camera className="size-5 text-white" aria-hidden />
                    </span>
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
                  <span
                    className={cn(
                      "inline-flex h-4 shrink-0 items-center justify-center rounded-full px-1.5 text-[9px] font-bold leading-none tracking-wide text-white",
                      !planLoaded
                        ? "invisible"
                        : hasThunder
                          ? "bg-[#f97316] uppercase"
                          : "bg-[#22c55e]",
                    )}
                  >
                    {planLoaded ? (hasThunder ? "Thunder" : "Free") : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {planLoaded
                    ? `You are on the ${currentPlan.name} plan · ${bandwidthLabel} transfers`
                    : "Loading plan details…"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {!planLoaded ? null : hasThunder ? (
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
                    <Link href="/billing/history">
                      <Button size="sm" variant="outline" className="shrink-0">
                        View invoices
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
                      View payment history and download invoices.
                    </p>
                  </div>
                </div>
                <Link href="/billing/history">
                  <Button size="sm" variant="outline" className="shrink-0">
                    History
                  </Button>
                </Link>
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
              {!planLoaded ? null : hasSmartDistribution ? (
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
                Stay updated with product tips, feature launches, and Archive
                Cloud news.
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

            {orderedAccounts.length === 0 ? (
              <div className="mt-6 flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border px-4 py-8">
                <p className="text-center text-sm text-muted">
                  No connected accounts yet. Click Connect Account to link a
                  cloud.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {orderedAccounts.map((account) => {
                  const title =
                    account.displayName?.trim() ||
                    `My ${providerLabel(account.provider)}`;
                  const connectedOn = formatConnectedOn(account.createdAt);

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
                            title="Edit alias"
                            aria-label={`Edit alias for ${title}`}
                            onClick={() => openEditAlias(account)}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                          >
                            <Pencil className="h-4 w-4" />
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

          <DeleteAccountSection email={user?.email ?? ""} />
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

      {planLoaded && canUpgrade ? (
        <UpgradePlanModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          currentPlanId={planId}
        />
      ) : null}

      <DummyModal
        open={Boolean(accountToEdit)}
        title="Rename Account"
        onClose={closeEditAlias}
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <label
              htmlFor="edit-account-alias"
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Account Name
              <span className="text-danger" aria-hidden>
                *
              </span>
              <CircleInfo className="h-3.5 w-3.5 text-primary" aria-hidden />
            </label>
            <input
              id="edit-account-alias"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={editAlias}
              onChange={(event) =>
                setEditAlias(event.target.value.slice(0, 50))
              }
              maxLength={50}
              autoComplete="off"
              disabled={savingAlias}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveAlias();
                }
              }}
            />
            <p className="text-xs text-muted">
              {editAlias.length}/50 characters
            </p>
          </div>
          <div>
            <Button
              variant="primary"
              onPress={() => void saveAlias()}
              isDisabled={savingAlias || !editAlias.trim()}
            >
              {savingAlias ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DummyModal>

      <DummyModal
        open={Boolean(accountToDisconnect)}
        title="Disconnect Cloud Account"
        size="lg"
        className="sm:min-w-[36rem]"
        onClose={() => {
          if (disconnectingAccountId) return;
          setAccountToDisconnect(null);
        }}
      >
        <div className="grid gap-4">
          {accountToDisconnect ? (
            <p className="text-sm leading-relaxed text-muted">
              Are you sure you want to disconnect the{" "}
              <span className="font-semibold text-foreground">
                {accountToDisconnect.displayName?.trim() ||
                  `My ${providerLabel(accountToDisconnect.provider)}`}
              </span>{" "}
              cloud account from your Archive Cloud account? This action will
              remove Archive Cloud&apos;s access to the account. You can
              reconnect it at any time.
            </p>
          ) : null}

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

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <TriangleExclamation className="h-4 w-4 shrink-0" />
              Warning
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-800/90">
              If you have any active schedule jobs, they will also be deleted
              automatically.
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
              {disconnectingAccountId ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      </DummyModal>
    </>
  );
}
