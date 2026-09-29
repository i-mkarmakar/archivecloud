"use client";

import { useCookieConsent } from "@/components/cookie-consent/cookie-consent-provider";

type CookieSettingsLinkProps = {
  className?: string;
};

export function CookieSettingsLink({ className }: CookieSettingsLinkProps) {
  const { openSettings } = useCookieConsent();

  return (
    <button type="button" onClick={openSettings} className={className}>
      Cookie settings
    </button>
  );
}
