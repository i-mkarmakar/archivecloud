"use client";

import { RouterProvider, Toast } from "@heroui/react";

import { CookieConsentProvider } from "@/components/cookie-consent/cookie-consent-provider";
import { UploadProvider } from "@/context/UploadContext";
import { useRouter } from "next/navigation";

function HeroUIRouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIRouterProvider>
      <CookieConsentProvider>
        <Toast.Provider placement="bottom end" maxVisibleToasts={4} />
        <UploadProvider>{children}</UploadProvider>
      </CookieConsentProvider>
    </HeroUIRouterProvider>
  );
}
