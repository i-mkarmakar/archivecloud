"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "hi", label: "हिन्दी" },
] as const;

const STORAGE_KEY = "archivecloud-lang";

export function AuthLanguageSelect({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string>("en");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) setCode(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-white drop-shadow-sm transition hover:text-white/90"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="size-4" aria-hidden />
        {current.label}
        <ChevronDown
          className={cn("size-3.5 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute top-full right-0 z-40 mt-2 min-w-[9rem] overflow-hidden rounded-xl border border-black/5 bg-white py-1 shadow-lg"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={lang.code === code}
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100",
                lang.code === code && "font-semibold",
              )}
              onClick={() => {
                setCode(lang.code);
                localStorage.setItem(STORAGE_KEY, lang.code);
                setOpen(false);
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
