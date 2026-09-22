"use client";

import { useState } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { FileItem } from "@/data/drive-data";
import { getProfileImageUrl } from "@/lib/gravatar";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

export function AccountAccessBadge({
  file,
  compact = false,
  showLabel = false,
}: {
  file: FileItem;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarSrc = getProfileImageUrl({
    image: file.accountAvatarUrl,
    size: 64,
  });
  const providerKey = file.accountProvider?.trim() || "";
  const label =
    file.accountEmail ||
    file.accountDisplayName ||
    file.accountProvider ||
    file.access ||
    "Cloud account";
  const showAvatar = Boolean(avatarSrc) && !avatarFailed;

  return (
    <span className="flex min-w-0 items-center gap-2" title={label}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5 dark:bg-surface dark:ring-white/10",
          compact ? "h-4 w-4" : "h-5 w-5",
        )}
      >
        {showAvatar ? (
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <ProviderBrandIcon
            name={providerKey || "google_drive"}
            className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}
            fallback={
              <span
                className={cn(
                  "flex items-center justify-center rounded-full bg-accent/15 font-bold text-accent",
                  compact ? "h-2.5 w-2.5 text-[6px]" : "h-3.5 w-3.5 text-[8px]",
                )}
              >
                {(providerLabel(providerKey) || label).charAt(0).toUpperCase()}
              </span>
            }
          />
        )}
      </span>
      {showLabel ? (
        <span className="truncate text-muted">{file.access || label}</span>
      ) : null}
    </span>
  );
}
