"use client";

import { Avatar } from "@heroui/react";
import { cn } from "@/lib/utils";

const DEFAULT_USER_AVATAR_COLORS = [
  "blue",
  "green",
  "purple",
  "orange",
  "red",
  "indigo",
] as const;

type DefaultUserAvatarColor = (typeof DEFAULT_USER_AVATAR_COLORS)[number];

const AVATAR_CDN =
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getDefaultUserAvatarColor(
  seed?: string | null,
): DefaultUserAvatarColor {
  const key = seed?.trim().toLowerCase() || "user";
  const index = hashSeed(key) % DEFAULT_USER_AVATAR_COLORS.length;
  return DEFAULT_USER_AVATAR_COLORS[index]!;
}

function getDefaultUserAvatarSrc(seed?: string | null): string {
  const color = getDefaultUserAvatarColor(seed);
  return `${AVATAR_CDN}/${color}.jpg`;
}

function getUserInitials(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
    }
    return trimmedName.slice(0, 2).toUpperCase();
  }

  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail.charAt(0).toUpperCase();
  }

  return "U";
}

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  color?: "default" | "accent" | "success" | "warning" | "danger";
  className?: string;
  fallbackClassName?: string;
  alt?: string;
  onImageError?: () => void;
};

export function UserAvatar({
  name,
  email,
  imageUrl,
  size = "md",
  color = "accent",
  className,
  fallbackClassName,
  alt,
  onImageError,
}: UserAvatarProps) {
  const custom = imageUrl?.trim() ?? "";
  const src = custom || getDefaultUserAvatarSrc(email ?? name);
  const initials = getUserInitials(name, email);
  const label = alt ?? name ?? email ?? "User";

  return (
    <Avatar size={size} color={color} className={className}>
      <Avatar.Image
        src={src}
        alt={label}
        referrerPolicy="no-referrer"
        onError={() => {
          if (custom) onImageError?.();
        }}
      />
      <Avatar.Fallback className={cn(fallbackClassName)}>
        {initials}
      </Avatar.Fallback>
    </Avatar>
  );
}
