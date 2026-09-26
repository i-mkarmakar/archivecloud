"use client";

import {
  ArrowRightFromSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  EllipsisVertical,
  Gear,
  Grip,
  Plus,
  TrashBin,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  AlertDialog,
  Button,
  buttonVariants,
  Popover,
  ScrollShadow,
  Surface,
  toast,
} from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { DummyModal } from "@/components/drive/DummyModal";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserPlan } from "@/hooks/useUserPlan";
import { apiFetch, formatBytes } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-user";
import { getProfileImageUrl } from "@/lib/gravatar";
import {
  loadProviderOrder,
  saveProviderOrder,
  sortByProviderOrder,
} from "@/lib/provider-order";
import { providerLabel } from "@/lib/providers";
import { syncGoogleProfileImageIfNeeded } from "@/lib/sync-google-avatar";
import { cn } from "@/lib/utils";
import { ConnectCloudAccountModal } from "./ConnectCloudAccountModal";
import { dashboardNavSections } from "./config";
import { SidebarNewButton } from "./SidebarNewButton";
import { SidebarPlanLimits } from "./SidebarPlanLimits";

type TransferUsage = {
  yearMonth: string;
  transferredBytes: string;
  limitBytes: string | null;
  remainingBytes: string | null;
};

export type SidebarConnectedAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
  status: string;
  storageAccount?: {
    usedBytes?: string | null;
  } | null;
};

function accountTitle(account: SidebarConnectedAccount) {
  const label = providerLabel(account.provider);
  const name = account.displayName?.trim();
  const email = account.email?.trim();
  if (name && email && name !== email) return `${label} · ${name} · ${email}`;
  if (email) return `${label} · ${email}`;
  if (name) return `${label} · ${name}`;
  return label;
}

function accountDisplayName(account: SidebarConnectedAccount) {
  const name = account.displayName?.trim();
  const email = account.email?.trim();
  if (name && (!email || name !== email)) return name;
  if (email) return email.split("@")[0] || email;
  return providerLabel(account.provider);
}

function accountEmail(account: SidebarConnectedAccount) {
  return account.email?.trim() || null;
}

function groupAccountsByProvider(accounts: SidebarConnectedAccount[]) {
  const groups: {
    provider: string;
    label: string;
    accounts: SidebarConnectedAccount[];
  }[] = [];
  const indexByProvider = new Map<string, number>();

  for (const account of accounts) {
    const existing = indexByProvider.get(account.provider);
    if (existing !== undefined) {
      groups[existing].accounts.push(account);
      continue;
    }
    indexByProvider.set(account.provider, groups.length);
    groups.push({
      provider: account.provider,
      label: providerLabel(account.provider),
      accounts: [account],
    });
  }

  return groups;
}

function ProviderMark({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  return (
    <ProviderBrandIcon
      name={provider}
      className={cn("h-5 w-5 shrink-0", className)}
      fallback={
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent/15 text-[10px] font-bold text-accent",
            className,
          )}
        >
          {providerLabel(provider).charAt(0)}
        </span>
      }
    />
  );
}

function isNavActive(
  pathname: string,
  href: string,
  searchParams: URLSearchParams,
) {
  const [path, query = ""] = href.split("?");
  const pathActive = pathname === path || pathname.startsWith(`${path}/`);
  if (!pathActive) return false;
  if (!query) return true;

  const required = new URLSearchParams(query);
  for (const [key, value] of required.entries()) {
    const current = searchParams.get(key);
    if (current === null && key === "view" && value === "sync") continue;
    if (current !== value) return false;
  }
  return true;
}

export function DashboardSidebar({
  safePathname,
  user,
  accounts = [],
  onLogout,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  hideNewButton = false,
  className,
}: {
  safePathname: string;
  user: AuthUser | null;
  accounts?: SidebarConnectedAccount[];
  onLogout: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Hide the New button (e.g. mobile drawer — FAB is shown instead). */
  hideNewButton?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<SidebarConnectedAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const {
    planId: currentPlanId,
    plan: currentPlan,
    hasThunder,
    loaded: planLoaded,
  } = useUserPlan();
  const [transferUsage, setTransferUsage] = useState<TransferUsage | null>(
    null,
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        dashboardNavSections.map((section) => [section.id, true]),
      ),
  );
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>(
    {},
  );
  const [providerOrder, setProviderOrder] = useState<string[]>([]);
  const [draggingProvider, setDraggingProvider] = useState<string | null>(null);
  const [dragOverProvider, setDragOverProvider] = useState<string | null>(null);

  function openConnectModal() {
    setConnectOpen(true);
    onNavigate?.();
  }

  async function disconnectAccount() {
    if (!accountToDisconnect || disconnecting) return;
    setDisconnecting(true);
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, {
        method: "DELETE",
      });
      toast.success("Storage account disconnected.");
      if (searchParams.get("accountId") === accountToDisconnect.id) {
        router.push("/home");
      }
      setAccountToDisconnect(null);
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to disconnect storage account",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  const connectedAccounts = accounts.filter(
    (account) => account.status === "connected",
  );
  const providerGroups = sortByProviderOrder(
    groupAccountsByProvider(connectedAccounts),
    providerOrder,
  );

  useEffect(() => {
    setProviderOrder(loadProviderOrder());
  }, []);

  function reorderProviders(fromProvider: string, toProvider: string) {
    if (fromProvider === toProvider) return;
    const ids = providerGroups.map((group) => group.provider);
    const fromIndex = ids.indexOf(fromProvider);
    const toIndex = ids.indexOf(toProvider);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...ids];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, fromProvider);
    setProviderOrder(next);
    saveProviderOrder(next);
  }

  function isProviderOpen(provider: string) {
    return openProviders[provider] === true;
  }

  function toggleProvider(provider: string) {
    setOpenProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  }

  function isAccountActive(accountId: string) {
    return (
      safePathname === "/home" && searchParams.get("accountId") === accountId
    );
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    setAvatarError(false);
    setProfileImageUrl(
      getProfileImageUrl({
        image: user?.image,
        email: user?.email,
        size: 128,
      }),
    );

    void syncGoogleProfileImageIfNeeded(user?.image).then((image) => {
      if (image) {
        setProfileImageUrl(getProfileImageUrl({ image, size: 128 }));
        setAvatarError(false);
      }
    });
  }, [user?.image, user?.email]);

  useEffect(() => {
    if (!planLoaded) return;
    let cancelled = false;

    async function loadTransferUsage() {
      try {
        const usage = await apiFetch<TransferUsage>("/transfers/usage");
        if (!cancelled) setTransferUsage(usage);
      } catch {
        if (cancelled) return;
        const limit = currentPlan.limits.monthlyTransferBytes;
        setTransferUsage({
          yearMonth: "",
          transferredBytes: "0",
          limitBytes: limit === null ? null : limit.toString(),
          remainingBytes: limit === null ? null : limit.toString(),
        });
      }
    }

    void loadTransferUsage();
    function onStorageChanged() {
      void loadTransferUsage();
    }
    window.addEventListener("archivecloud:storage-changed", onStorageChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        "archivecloud:storage-changed",
        onStorageChanged,
      );
    };
  }, [planLoaded, currentPlan]);

  const edgeToggle =
    onToggleCollapse != null ? (
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-16 right-0 z-30 flex h-6 w-6 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-transparent bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] text-primary-foreground shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition-transform hover:scale-105"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    ) : null;

  const connectModal = (
    <ConnectCloudAccountModal
      open={connectOpen}
      onClose={() => setConnectOpen(false)}
    />
  );

  if (collapsed) {
    return (
      <>
        {connectModal}
        <Surface
          variant="default"
          className={cn(
            "relative flex h-full w-[4.5rem] shrink-0 flex-col overflow-visible border-r border-separator bg-[#f4f7fa]",
            className,
          )}
        >
          {edgeToggle}

          <div className="flex h-14 items-center justify-center px-2 pb-2 pt-4">
            {planLoaded ? (
              <BrandLogo className="h-10 w-10 shrink-0" thunder={hasThunder} />
            ) : (
              <span className="inline-block h-10 w-10 shrink-0" aria-hidden />
            )}
          </div>

          {hideNewButton ? null : (
            <div className="mt-5 flex justify-center px-2 pb-2">
              <SidebarNewButton
                safePathname={safePathname}
                onNavigate={onNavigate}
                iconOnly
                disabled={connectedAccounts.length === 0}
              />
            </div>
          )}

          <ScrollShadow className="flex-1 px-2 py-2" hideScrollBar>
            <nav className="grid gap-2.5">
              {dashboardNavSections.map((section) => {
                const isOpen = openSections[section.id] !== false;

                return (
                  <div key={section.id}>
                    {}
                    <div className="flex h-6 items-center justify-center px-2">
                      <span className="h-1 w-4 rounded-full bg-[#d5dae6]" />
                    </div>

                    {isOpen ? (
                      <div className="mt-0.5 grid gap-0">
                        {section.id === "linked-storage" ? (
                          <>
                            {providerGroups.map((group) => {
                              const groupOpen = isProviderOpen(group.provider);
                              const groupActive = group.accounts.some((a) =>
                                isAccountActive(a.id),
                              );
                              return (
                                <div
                                  key={group.provider}
                                  className="flex flex-col items-center gap-0.5"
                                >
                                  <button
                                    type="button"
                                    title={`${group.label} (${group.accounts.length})`}
                                    aria-label={`${group.label} (${group.accounts.length})`}
                                    aria-expanded={groupOpen}
                                    onClick={() =>
                                      toggleProvider(group.provider)
                                    }
                                    className={cn(
                                      "mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-transparent bg-white transition-colors",
                                      groupActive
                                        ? "border-primary/30 bg-primary/10"
                                        : "border-separator hover:bg-black/5",
                                    )}
                                  >
                                    <ProviderMark provider={group.provider} />
                                  </button>
                                  {groupOpen
                                    ? group.accounts.map((account) => {
                                        const href = `/home?accountId=${account.id}`;
                                        const isActive = isAccountActive(
                                          account.id,
                                        );
                                        return (
                                          <Link
                                            key={account.id}
                                            href={href}
                                            title={accountTitle(account)}
                                            onClick={onNavigate}
                                            aria-label={accountTitle(account)}
                                            className={cn(
                                              "mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent transition-colors",
                                              isActive
                                                ? "border-primary/30 bg-primary/10"
                                                : "hover:bg-black/5",
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                isActive
                                                  ? "bg-primary"
                                                  : "bg-[#888ea8]",
                                              )}
                                            />
                                          </Link>
                                        );
                                      })
                                    : null}
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              title="Link storage"
                              aria-label="Link storage"
                              onClick={openConnectModal}
                              className="mx-auto mt-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-dashed border-primary/50 text-primary transition-colors hover:bg-primary/10"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          section.items.map((item) => {
                            const isActive = isNavActive(
                              safePathname,
                              item.href,
                              searchParams,
                            );
                            return (
                              <Link
                                key={item.label}
                                href={item.href}
                                title={item.label}
                                onClick={onNavigate}
                                aria-label={item.label}
                                className={cn(
                                  "mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors",
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-[#4a5568] hover:bg-black/5",
                                )}
                              >
                                <item.icon className="h-5 w-5" />
                              </Link>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </ScrollShadow>

          <div className="flex justify-center border-t border-separator px-2 py-3">
            <Link
              href="/settings"
              onClick={onNavigate}
              title={user?.name ?? "Profile"}
              className="flex h-11 w-11 cursor-pointer items-center justify-center"
            >
              <UserAvatar
                name={user?.name}
                email={user?.email}
                imageUrl={
                  profileImageUrl && !avatarError ? profileImageUrl : null
                }
                size="md"
                storyRing
                onImageError={() => setAvatarError(true)}
              />
            </Link>
          </div>
        </Surface>
      </>
    );
  }

  return (
    <>
      {connectModal}
      <Surface
        variant="default"
        className={cn(
          "relative flex h-full w-[17rem] min-w-0 shrink-0 flex-col overflow-visible border-r border-separator bg-[#f4f7fa]",
          className,
        )}
      >
        {edgeToggle}

        <div className="flex h-14 min-w-0 items-center gap-2 px-3 pb-2 pt-4">
          {planLoaded ? (
            <BrandLogo className="h-10 w-10 shrink-0" thunder={hasThunder} />
          ) : (
            <span className="inline-block h-10 w-10 shrink-0" aria-hidden />
          )}
          <span className="truncate text-xl font-extrabold leading-none tracking-tight text-foreground">
            Archive Cloud
          </span>
        </div>

        {hideNewButton ? null : (
          <div className="mt-5 min-w-0 px-3 pb-2">
            <SidebarNewButton
              safePathname={safePathname}
              onNavigate={onNavigate}
              disabled={connectedAccounts.length === 0}
            />
          </div>
        )}

        <ScrollShadow
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden px-2 py-2"
          hideScrollBar
        >
          <nav className="grid min-w-0 gap-2.5">
            {dashboardNavSections.map((section) => {
              const isOpen = openSections[section.id] !== false;
              const sectionTitle = section.showAccountCount
                ? `${section.title} (${connectedAccounts.length})`
                : section.title;

              return (
                <div key={section.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex h-6 w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#888ea8]">
                      {sectionTitle}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[#888ea8]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#888ea8]" />
                    )}
                  </button>

                  {isOpen ? (
                    <div className="mt-0.5 grid min-w-0 gap-0">
                      {section.id === "linked-storage" ? (
                        <>
                          {providerGroups.map((group) => {
                            const groupOpen = isProviderOpen(group.provider);
                            const groupActive = group.accounts.some((a) =>
                              isAccountActive(a.id),
                            );
                            const isDragging =
                              draggingProvider === group.provider;
                            const isDragOver =
                              dragOverProvider === group.provider &&
                              draggingProvider !== group.provider;

                            return (
                              // biome-ignore lint/a11y/noStaticElementInteractions: provider group is a drag-and-drop target
                              <div
                                key={group.provider}
                                className={cn(
                                  "min-w-0 rounded-lg transition-colors",
                                  isDragOver && "bg-primary/10",
                                  isDragging && "opacity-50",
                                )}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  if (dragOverProvider !== group.provider) {
                                    setDragOverProvider(group.provider);
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dragOverProvider === group.provider) {
                                    setDragOverProvider(null);
                                  }
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const from =
                                    event.dataTransfer.getData("text/plain") ||
                                    draggingProvider;
                                  if (from) {
                                    reorderProviders(from, group.provider);
                                  }
                                  setDraggingProvider(null);
                                  setDragOverProvider(null);
                                }}
                              >
                                <div className="group relative flex min-h-8 w-full min-w-0 items-center gap-0.5">
                                  <button
                                    type="button"
                                    draggable
                                    title="Drag to reorder"
                                    aria-label={`Reorder ${group.label}`}
                                    onClick={(event) => event.preventDefault()}
                                    onDragStart={(event) => {
                                      setDraggingProvider(group.provider);
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData(
                                        "text/plain",
                                        group.provider,
                                      );
                                    }}
                                    onDragEnd={() => {
                                      setDraggingProvider(null);
                                      setDragOverProvider(null);
                                    }}
                                    className={cn(
                                      "flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-[#64748b] transition-opacity active:cursor-grabbing",
                                      "opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100",
                                      "focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                      isDragging &&
                                        "pointer-events-auto opacity-100 text-primary",
                                    )}
                                  >
                                    <Grip className="h-4 w-4" aria-hidden />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleProvider(group.provider)
                                    }
                                    aria-expanded={groupOpen}
                                    className={cn(
                                      "relative flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-1.5 py-1 text-sm transition-colors",
                                      groupActive
                                        ? "bg-primary/10 font-semibold text-primary"
                                        : "font-medium text-[#4a5568] hover:bg-black/5",
                                    )}
                                  >
                                    {groupActive ? (
                                      <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                                    ) : null}
                                    <ProviderMark
                                      provider={group.provider}
                                      className="shrink-0"
                                    />
                                    <span className="min-w-0 flex-1 overflow-hidden text-left">
                                      <span
                                        className={cn(
                                          "block truncate text-sm leading-tight",
                                          groupActive
                                            ? "font-semibold text-primary"
                                            : "font-semibold text-[#4a5568]",
                                        )}
                                      >
                                        {group.label}
                                      </span>
                                      <span
                                        className={cn(
                                          "block truncate text-[11px] font-normal leading-tight",
                                          groupActive
                                            ? "text-primary/80"
                                            : "text-[#888ea8]",
                                        )}
                                      >
                                        {group.accounts.length}{" "}
                                        {group.accounts.length === 1
                                          ? "account"
                                          : "accounts"}
                                      </span>
                                    </span>
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                      {groupOpen ? (
                                        <ChevronUp className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      )}
                                    </span>
                                  </button>
                                </div>

                                {groupOpen ? (
                                  <div className="mt-0.5 grid min-w-0 gap-0.5 pl-5">
                                    {group.accounts.map((account) => {
                                      const href = `/home?accountId=${account.id}`;
                                      const isActive = isAccountActive(
                                        account.id,
                                      );
                                      const name = accountDisplayName(account);
                                      const email = accountEmail(account);

                                      return (
                                        <div
                                          key={account.id}
                                          className={cn(
                                            "group/account relative flex min-h-8 min-w-0 items-center overflow-hidden rounded-lg transition-colors",
                                            isActive
                                              ? "bg-primary/10"
                                              : "hover:bg-black/5",
                                          )}
                                        >
                                          {isActive ? (
                                            <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                                          ) : null}
                                          <Link
                                            href={href}
                                            onClick={onNavigate}
                                            title={accountTitle(account)}
                                            className={cn(
                                              "flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 pr-8 pl-2.5 text-sm",
                                              isActive
                                                ? "font-semibold text-primary"
                                                : "font-medium text-[#4a5568]",
                                            )}
                                          >
                                            <span className="min-w-0 flex-1 overflow-hidden">
                                              <span
                                                className={cn(
                                                  "block truncate text-xs",
                                                  isActive
                                                    ? "font-semibold text-primary"
                                                    : "font-semibold text-[#4a5568]",
                                                )}
                                              >
                                                {name}
                                              </span>
                                              {email ? (
                                                <span
                                                  className={cn(
                                                    "mt-0.5 block truncate text-[11px] font-normal",
                                                    isActive
                                                      ? "text-primary/80"
                                                      : "text-[#888ea8]",
                                                  )}
                                                >
                                                  {email}
                                                </span>
                                              ) : null}
                                            </span>
                                          </Link>
                                          <button
                                            type="button"
                                            title="Disconnect"
                                            aria-label={`Disconnect ${accountTitle(account)}`}
                                            onClick={() =>
                                              setAccountToDisconnect(account)
                                            }
                                            className="absolute top-1/2 right-1 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-danger opacity-0 transition-opacity hover:bg-danger/10 group-hover/account:opacity-100 focus-visible:opacity-100"
                                          >
                                            <TrashBin className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={openConnectModal}
                            className="mt-5 flex min-h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            <Plus className="h-5 w-5 shrink-0" />
                            Link storage
                          </button>
                        </>
                      ) : (
                        section.items.map((item) => {
                          const isActive = isNavActive(
                            safePathname,
                            item.href,
                            searchParams,
                          );

                          if (item.disabled) {
                            return (
                              <span
                                key={item.label}
                                className="flex min-h-8 min-w-0 items-center gap-2 rounded-lg px-2.5 py-1 text-sm font-medium text-[#4a5568]/50"
                              >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </span>
                            );
                          }

                          return (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={onNavigate}
                              className={cn(
                                "relative flex min-h-8 min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2.5 py-1 text-sm transition-colors",
                                isActive
                                  ? "bg-primary/10 font-semibold text-primary"
                                  : "font-medium text-[#4a5568] hover:bg-black/5",
                              )}
                            >
                              {isActive ? (
                                <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                              ) : null}
                              <item.icon
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  isActive ? "text-primary" : "text-[#4a5568]",
                                )}
                              />
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate leading-none">
                                  {item.label}
                                </span>
                                {item.badge &&
                                planLoaded &&
                                currentPlanId !== "thunder" ? (
                                  <span className="inline-flex h-4 shrink-0 items-center justify-center rounded-full bg-[#f97316] px-1.5 text-[9px] font-bold leading-none tracking-wide text-white">
                                    {item.badge}
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </ScrollShadow>

        {planLoaded && connectedAccounts.length > 0 ? (
          <div className="min-w-0 overflow-hidden border-t border-separator px-3 pb-3 pt-3">
            <SidebarPlanLimits
              transferUsedBytes={transferUsage?.transferredBytes ?? "0"}
              transferLimitBytes={
                transferUsage?.limitBytes ??
                (currentPlan.limits.monthlyTransferBytes === null
                  ? null
                  : currentPlan.limits.monthlyTransferBytes.toString())
              }
            />
          </div>
        ) : null}

        <div className="min-w-0 overflow-hidden border-t border-separator px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/settings"
              onClick={onNavigate}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl transition-colors hover:bg-background-secondary"
            >
              <UserAvatar
                name={user?.name}
                email={user?.email}
                imageUrl={
                  profileImageUrl && !avatarError ? profileImageUrl : null
                }
                size="md"
                storyRing
                className="shrink-0"
                onImageError={() => setAvatarError(true)}
              />
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-bold text-foreground">
                  {user?.name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted">
                  {user?.email ?? "Loading..."}
                </p>
              </div>
            </Link>
            <Popover isOpen={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
              <Popover.Trigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  isIconOnly: true,
                  className:
                    "inline-flex shrink-0 cursor-pointer items-center justify-center text-muted",
                })}
                aria-label="Account options"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Popover.Trigger>
              <Popover.Content placement="top end" className="w-44 p-1">
                <Popover.Dialog>
                  <div className="grid gap-0.5">
                    <Link
                      href="/settings"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onNavigate?.();
                      }}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className:
                          "w-full cursor-pointer justify-start gap-2 font-semibold",
                      })}
                    >
                      <Gear className="h-4 w-4 shrink-0" />
                      Settings
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="justify-start gap-2 font-semibold text-danger cursor-pointer"
                      onPress={() => {
                        setAccountMenuOpen(false);
                        setLogoutOpen(true);
                      }}
                    >
                      <ArrowRightFromSquare className="h-4 w-4 shrink-0" />
                      Log Out
                    </Button>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </div>
        </div>
      </Surface>
      <AlertDialog.Backdrop isOpen={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger">
                <ArrowRightFromSquare className="size-5" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>
                Sign out of your account?
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>You&apos;ll need to sign in again to continue.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="danger"
                onPress={() => {
                  setLogoutOpen(false);
                  onLogout();
                }}
              >
                Sign out
              </Button>
              <Button slot="close" variant="tertiary">
                Stay signed in
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <DummyModal
        open={Boolean(accountToDisconnect)}
        title="Disconnect Cloud Account"
        size="lg"
        className="sm:min-w-[36rem]"
        onClose={() => {
          if (disconnecting) return;
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
              isDisabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                void disconnectAccount();
              }}
              isDisabled={disconnecting}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      </DummyModal>
    </>
  );
}
