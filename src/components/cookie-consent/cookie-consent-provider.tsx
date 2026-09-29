"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CookieConsentBanner } from "@/components/cookie-consent/cookie-consent-banner";
import { CookieSettingsModal } from "@/components/cookie-consent/cookie-settings-modal";
import { ALL_NON_ESSENTIAL_REJECTED } from "@/lib/cookie-consent/config";
import {
  acceptAllConsent,
  clearPreferenceStorageKeys,
  COOKIE_CONSENT_UPDATED_EVENT,
  readConsent,
  rejectAllConsent,
  writeConsent,
} from "@/lib/cookie-consent/storage";
import type {
  CookieCategory,
  CookieConsentPreferences,
} from "@/lib/cookie-consent/types";

type CookieConsentContextValue = {
  consent: CookieConsentPreferences | null;
  isReady: boolean;
  showBanner: boolean;
  showSettings: boolean;
  hasCategoryConsent: (category: CookieCategory) => boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (categories: CookieConsentPreferences["categories"]) => void;
  openSettings: () => void;
  closeSettings: () => void;
};

const CookieConsentContext = createContext<
  CookieConsentContextValue | undefined
>(undefined);

function applyConsentSideEffects(
  categories: CookieConsentPreferences["categories"],
) {
  if (!categories.preferences) {
    clearPreferenceStorageKeys();
  }
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentPreferences | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const syncFromStorage = useCallback(() => {
    const stored = readConsent();
    setConsent(stored);
    setShowBanner(stored === null);
    return stored;
  }, []);

  useEffect(() => {
    syncFromStorage();
    setIsReady(true);

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsentPreferences>).detail;
      const updated = detail ?? readConsent();
      setConsent(updated);
      setShowBanner(false);
    };

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleUpdate);
  }, [syncFromStorage]);

  const persist = useCallback(
    (categories: CookieConsentPreferences["categories"]) => {
      const saved = writeConsent(categories);
      applyConsentSideEffects(categories);
      setConsent(saved);
      setShowBanner(false);
      setShowSettings(false);
    },
    [],
  );

  const acceptAll = useCallback(() => {
    const saved = acceptAllConsent();
    applyConsentSideEffects(saved.categories);
    setConsent(saved);
    setShowBanner(false);
    setShowSettings(false);
  }, []);

  const rejectAll = useCallback(() => {
    const saved = rejectAllConsent();
    applyConsentSideEffects(saved.categories);
    setConsent(saved);
    setShowBanner(false);
    setShowSettings(false);
  }, []);

  const dismissBanner = useCallback(() => {
    rejectAll();
  }, [rejectAll]);

  const savePreferences = useCallback(
    (categories: CookieConsentPreferences["categories"]) => {
      persist(categories);
    },
    [persist],
  );

  const hasCategoryConsent = useCallback(
    (category: CookieCategory) => {
      if (category === "necessary") return true;
      if (!consent) return false;
      return consent.categories[category];
    },
    [consent],
  );

  const value = useMemo(
    () => ({
      consent,
      isReady,
      showBanner,
      showSettings,
      hasCategoryConsent,
      acceptAll,
      rejectAll,
      savePreferences,
      openSettings: () => setShowSettings(true),
      closeSettings: () => setShowSettings(false),
    }),
    [
      acceptAll,
      consent,
      hasCategoryConsent,
      isReady,
      rejectAll,
      savePreferences,
      showBanner,
      showSettings,
    ],
  );

  const settingsDraft = consent?.categories ?? ALL_NON_ESSENTIAL_REJECTED;

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {isReady && showBanner && !showSettings ? (
        <CookieConsentBanner
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onOpenSettings={() => setShowSettings(true)}
          onDismiss={dismissBanner}
        />
      ) : null}
      {isReady && showSettings ? (
        <CookieSettingsModal
          open={showSettings}
          initialCategories={settingsDraft}
          onClose={() => setShowSettings(false)}
          onSave={savePreferences}
          onRejectAll={() => savePreferences(ALL_NON_ESSENTIAL_REJECTED)}
        />
      ) : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error(
      "useCookieConsent must be used within a CookieConsentProvider",
    );
  }
  return context;
}
