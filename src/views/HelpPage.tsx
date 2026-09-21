"use client";

import {
  DownloadIcon,
  FolderPlusIcon,
  LogInIcon,
  RefreshCwIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CLOUD_SERVICES = [
  {
    id: "google_drive",
    title: "Google Drive",
    description: "Securely access, share & manage your Google Drive files.",
    href: "/settings",
    keywords: ["google", "drive", "gdrive"],
  },
  {
    id: "dropbox",
    title: "Dropbox",
    description: "Securely access, share & manage your Dropbox files.",
    href: "/settings",
    keywords: ["dropbox"],
  },
  {
    id: "onedrive",
    title: "OneDrive",
    description: "Securely access, share & manage your OneDrive files.",
    href: "/settings",
    keywords: ["onedrive", "microsoft"],
  },
  {
    id: "pcloud",
    title: "pCloud",
    description: "Securely access, share & manage your pCloud files.",
    href: "/settings",
    keywords: ["pcloud"],
  },
  {
    id: "google_photos",
    title: "Google Photos",
    description: "Securely access, share & manage your Google Photos.",
    href: "/settings",
    keywords: ["photos", "google photos"],
  },
  {
    id: "icloud_photos",
    title: "iCloud Photos",
    description: "Securely access, share & manage your iCloud Photos.",
    href: "/settings",
    keywords: ["icloud", "photos", "apple"],
  },
  {
    id: "icloud_drive",
    title: "iCloud Drive",
    description: "Securely access, share & manage your iCloud Drive files.",
    href: "/settings",
    keywords: ["icloud", "drive", "apple"],
  },
  {
    id: "google_shared_drive",
    title: "Google Shared Drive",
    description: "Securely access, share & manage Shared Drive files.",
    href: "/settings",
    keywords: ["shared", "team drive", "google"],
  },
] as const;

const TOPICS = [
  {
    id: "connect",
    title: "Connect Account",
    href: "/settings",
    icon: LogInIcon,
    keywords: ["connect", "account", "oauth", "login"],
  },
  {
    id: "sync",
    title: "File Sync",
    href: "/automation",
    icon: RefreshCwIcon,
    keywords: ["sync", "automation", "mirror"],
  },
  {
    id: "upload",
    title: "Upload Files",
    href: "/all-files",
    icon: UploadIcon,
    keywords: ["upload", "files"],
  },
  {
    id: "download",
    title: "Download Files",
    href: "/all-files",
    icon: DownloadIcon,
    keywords: ["download", "files"],
  },
  {
    id: "search",
    title: "Search Files",
    href: "/search",
    icon: SearchIcon,
    keywords: ["search", "find"],
  },
  {
    id: "virtual-folders",
    title: "Virtual Folders",
    href: "/virtual-folders",
    icon: FolderPlusIcon,
    keywords: ["virtual", "folders", "organize"],
  },
] as const;

function shortcutLabel() {
  if (typeof navigator === "undefined") return "Ctrl + K";
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMac ? "⌘ K" : "Ctrl + K";
}

function ServiceIcon({
  providerId,
  label,
}: {
  providerId: string;
  label: string;
}) {
  return (
    <ProviderBrandIcon
      name={providerId}
      className="size-10"
      fallback={
        <span className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-500">
          {label.charAt(0)}
        </span>
      }
    />
  );
}

export function HelpPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl + K");

  useEffect(() => {
    setShortcut(shortcutLabel());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const services = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CLOUD_SERVICES;
    return CLOUD_SERVICES.filter((service) => {
      const haystack = [service.title, service.description, ...service.keywords]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const topics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter((topic) => {
      const haystack = [topic.title, ...topic.keywords].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <div className="relative -mt-32 w-full bg-white pb-8">
      <section className="bg-gradient-to-b from-[#0b6db8] via-primary to-[#1a8ad6] px-4 pt-24 pb-12 md:px-6 md:pt-28 md:pb-16">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Help Center
          </h1>

          <label className="relative mt-5 block w-full max-w-xl">
            <span className="sr-only">Search for help articles</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/70" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for help articles..."
              className="h-11 w-full rounded-lg border border-white/20 bg-white/15 pr-24 pl-10 text-sm text-white outline-none backdrop-blur-sm placeholder:text-white/65 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/30"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-white/20 px-2 py-1 text-[11px] font-medium tracking-wide text-white/80">
              {shortcut}
            </kbd>
          </label>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 md:px-6">
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            Cloud Services
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {services.map((service) => (
              <Link
                key={service.id}
                href={service.href}
                className={cn(
                  "flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-3 py-5 text-center transition-colors",
                  "hover:border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <ServiceIcon providerId={service.id} label={service.title} />
                <h3 className="mt-3 text-sm font-semibold text-neutral-900">
                  {service.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                  {service.description}
                </p>
              </Link>
            ))}
          </div>

          {services.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              No cloud services match “{query.trim()}”.
            </p>
          ) : null}
        </section>

        <hr className="my-10 border-neutral-200" />

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            Topics
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={topic.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 transition-colors",
                  "hover:border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <topic.icon
                  strokeWidth={1.75}
                  className="size-5 shrink-0 text-primary"
                />
                <span className="text-sm font-semibold text-neutral-900">
                  {topic.title}
                </span>
              </Link>
            ))}
          </div>

          {topics.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              No topics match “{query.trim()}”.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
