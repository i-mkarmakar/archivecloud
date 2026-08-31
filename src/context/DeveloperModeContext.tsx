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
import { apiFetch } from "@/lib/api";

type AccountProfile = {
  id: string;
  name: string;
  email: string;
  developerModeEnabled: boolean;
  developerModeEnabledAt: string | null;
};

type DeveloperModeContextValue = {
  loading: boolean;
  developerModeEnabled: boolean;
  enableDeveloperMode: () => Promise<void>;
  refreshAccount: () => Promise<void>;
};

const DeveloperModeContext = createContext<DeveloperModeContextValue | null>(
  null,
);

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountProfile | null>(null);

  const refreshAccount = useCallback(async () => {
    const data = await apiFetch<{ account: AccountProfile }>("/account");
    setAccount(data.account);
  }, []);

  useEffect(() => {
    refreshAccount()
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, [refreshAccount]);

  const enableDeveloperMode = useCallback(async () => {
    await apiFetch<{ developerModeEnabled: boolean }>(
      "/account/developer-mode",
      { method: "POST" },
    );
    await refreshAccount();
  }, [refreshAccount]);

  const value = useMemo(
    () => ({
      loading,
      developerModeEnabled: account?.developerModeEnabled ?? false,
      enableDeveloperMode,
      refreshAccount,
    }),
    [
      account?.developerModeEnabled,
      enableDeveloperMode,
      loading,
      refreshAccount,
    ],
  );

  return (
    <DeveloperModeContext.Provider value={value}>
      {children}
    </DeveloperModeContext.Provider>
  );
}

export function useDeveloperMode() {
  const context = useContext(DeveloperModeContext);
  if (!context) {
    throw new Error(
      "useDeveloperMode must be used within DeveloperModeProvider",
    );
  }
  return context;
}
