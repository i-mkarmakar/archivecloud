"use client";

import {
  AlertDialog,
  Avatar,
  Button,
  buttonVariants,
  Popover,
  ScrollShadow,
  Surface,
} from "@heroui/react";
import {
  ArrowRightFromSquare,
  EllipsisVertical,
  Gear,
  Persons,
} from "@gravity-ui/icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { formatBytes } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-user";
import { getGravatarUrl } from "@/lib/gravatar";
import { cn } from "@/lib/utils";
import { dashboardNavItems } from "./config";

type StorageSummary = {
  totalBytes: string | null;
  usedBytes: string;
  availableBytes: string | null;
};

type StorageBreakdown = {
  photo: string;
  video: string;
  document: string;
  other: string;
};

function formatStorageAmount(
  input: string | number | bigint | null | undefined,
  unlimitedLabel = "Unlimited",
) {
  if (input === null || input === undefined) return unlimitedLabel;
  return formatBytes(input);
}

export function DashboardSidebar({
  safePathname,
  user,
  storage,
  breakdown,
  onLogout,
  onNavigate,
  className,
}: {
  safePathname: string;
  user: AuthUser | null;
  storage: StorageSummary;
  breakdown: StorageBreakdown;
  onLogout: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const used = Number(storage?.usedBytes ?? 0);
  const available = storage?.availableBytes
    ? Number(storage.availableBytes)
    : 0;
  const total = storage?.totalBytes
    ? Number(storage.totalBytes)
    : used + available > 0
      ? used + available
      : used;
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const storageSegments = [
    {
      label: "Photo",
      bytes: Number(breakdown.photo) || 0,
      barClass: "bg-success",
      dotClass: "bg-success",
    },
    {
      label: "Video",
      bytes: Number(breakdown.video) || 0,
      barClass: "bg-accent",
      dotClass: "bg-accent",
    },
    {
      label: "Document",
      bytes: Number(breakdown.document) || 0,
      barClass: "bg-warning",
      dotClass: "bg-warning",
    },
    {
      label: "Other",
      bytes: Number(breakdown.other) || 0,
      barClass: "bg-muted-foreground/70",
      dotClass: "bg-muted",
    },
  ];

  function segmentWidth(bytes: number) {
    if (total <= 0 || bytes <= 0) return 0;
    return Math.min(100, (bytes / total) * 100);
  }

  const activeSegments = storageSegments.filter((segment) => segment.bytes > 0);

  const breakdownItems = storageSegments.map(({ label, bytes, dotClass }) => ({
    label,
    value: formatBytes(bytes),
    dotClass,
  }));

  useEffect(() => {
    setAvatarError(false);
    getGravatarUrl(user?.email, 64)
      .then(setProfileImageUrl)
      .catch(() => setProfileImageUrl(""));
  }, [user?.email]);

  return (
    <>
      <Surface
        variant="default"
        className={cn(
          "flex h-full w-64 shrink-0 flex-col border-r border-separator bg-surface",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
          <BrandLogo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            ArchiveCloud
          </span>
        </div>

        <ScrollShadow className="flex-1 px-3 py-3" hideScrollBar>
          <nav className="grid gap-1">
            {dashboardNavItems.map((item) => {
              const isActive =
                safePathname === item.href ||
                safePathname.startsWith(`${item.href}/`);

              if (item.disabled) {
                return (
                  <Button
                    key={item.label}
                    variant="ghost"
                    size="sm"
                    fullWidth
                    isDisabled
                    className="justify-start gap-2.5 font-semibold"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Button>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className={buttonVariants({
                    variant: isActive ? "secondary" : "ghost",
                    size: "sm",
                    className: cn(
                      "w-full justify-start gap-2.5 font-semibold",
                      isActive && "bg-accent-soft text-accent-soft-foreground",
                    ),
                  })}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollShadow>

        <div className="border-t border-separator px-4 pb-3 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Connected drive storage
          </p>
          <div className="mb-3 space-y-2">
            {breakdownItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between text-xs text-muted"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", item.dotClass)}
                  />
                  {item.label}
                </span>
                <span className="font-semibold text-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm font-bold text-foreground">
            <span>{formatBytes(storage?.usedBytes ?? 0)} used</span>
            <span className="text-muted">
              {formatStorageAmount(storage?.availableBytes, "Unlimited")} free
            </span>
          </div>
          <div
            className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-secondary"
            role="progressbar"
            aria-label="Storage usage by category"
            aria-valuemin={0}
            aria-valuemax={total > 0 ? total : used}
            aria-valuenow={used}
          >
            {activeSegments.map((segment) => (
              <div
                key={segment.label}
                className={cn("h-full shrink-0", segment.barClass)}
                style={{ width: `${segmentWidth(segment.bytes)}%` }}
                title={`${segment.label}: ${formatBytes(segment.bytes)}`}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-separator px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-colors hover:bg-background-secondary"
            >
              <Avatar size="sm">
                {profileImageUrl && !avatarError ? (
                  <Avatar.Image
                    src={profileImageUrl}
                    alt=""
                    onError={() => setAvatarError(true)}
                  />
                ) : null}
                <Avatar.Fallback>
                  {(user?.name ?? user?.email ?? "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </Avatar.Fallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {user?.name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted">
                  {user?.email ?? "Loading..."}
                </p>
              </div>
            </Link>
            <Popover>
              <Popover.Trigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  isIconOnly: true,
                  className:
                    "inline-flex shrink-0 items-center justify-center text-muted",
                })}
                aria-label="Account options"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Popover.Trigger>
              <Popover.Content placement="top end" className="w-44 p-1">
                <Popover.Dialog>
                  <div className="grid gap-0.5">
                    <Link
                      href="/profile"
                      onClick={onNavigate}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "w-full justify-start gap-2 font-semibold",
                      })}
                    >
                      <Persons className="h-4 w-4 shrink-0" />
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={onNavigate}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "w-full justify-start gap-2 font-semibold",
                      })}
                    >
                      <Gear className="h-4 w-4 shrink-0" />
                      Settings
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="justify-start gap-2 font-semibold text-danger"
                      onPress={() => setLogoutOpen(true)}
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
              <AlertDialog.Icon status="accent" />
              <AlertDialog.Heading>
                Sign out of your account?
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                You&apos;ll need to sign in again to access ArchiveCloud. Any
                unsaved changes may be lost.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Stay signed in
              </Button>
              <Button
                onPress={() => {
                  setLogoutOpen(false);
                  onLogout();
                }}
              >
                Sign out
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
