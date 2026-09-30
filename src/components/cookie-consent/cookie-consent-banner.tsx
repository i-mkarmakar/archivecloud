"use client";

import Link from "next/link";
import { Button } from "@heroui/react";

type CookieConsentBannerProps = {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CookieConsentBanner({
  onAcceptAll,
  onRejectAll,
  onOpenSettings,
  onDismiss,
}: CookieConsentBannerProps) {
  return (
    <section
      className="cookie-consent-banner-enter fixed inset-x-0 bottom-0 z-[150] border-t border-[#E5EEF7] bg-white text-[#0F172A] shadow-[0_-4px_24px_rgba(15,23,42,0.08)] max-sm:rounded-t-2xl"
      aria-label="Cookie consent"
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-1/2 right-5 z-10 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-black/5 hover:text-[#0F172A] sm:right-8 max-sm:top-3 max-sm:right-3 max-sm:translate-y-0"
        aria-label="Close and keep only strictly necessary cookies"
      >
        <CloseIcon className="h-5 w-5" />
      </button>

      <div className="relative mx-auto flex max-w-[1400px] items-center justify-center px-4 py-4 sm:px-6 sm:py-5 lg:px-8 max-sm:py-8 max-sm:pr-12">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-x-20 gap-y-3 sm:gap-x-32 lg:gap-x-40 max-sm:w-full max-sm:flex-col max-sm:items-center max-sm:gap-6 max-sm:text-center">
          <p className="min-w-0 max-w-3xl text-sm leading-snug text-[#0F172A]">
            We use essential cookies to keep you signed in and connect cloud
            accounts.
            <br />
            Optional cookies remember UI preferences.{" "}
            <Link
              href="/privacy-policy"
              className="font-semibold text-primary underline underline-offset-2 hover:text-[#0F172A]"
            >
              Privacy Policy
            </Link>{" "}
            ·{" "}
            <Link
              href="/cookie-policy"
              className="font-semibold text-primary underline underline-offset-2 hover:text-[#0F172A]"
            >
              Cookie Policy
            </Link>
          </p>

          <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:flex-col max-sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full max-sm:h-10 max-sm:w-full max-sm:rounded-md"
              onPress={onOpenSettings}
            >
              Cookie settings
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="rounded-full max-sm:h-10 max-sm:w-full max-sm:rounded-md"
              onPress={onRejectAll}
            >
              Reject optional
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="rounded-full max-sm:h-10 max-sm:w-full max-sm:rounded-md"
              onPress={onAcceptAll}
            >
              Accept all
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
