"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { RouterProvider, Toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { UploadProvider } from "@/context/UploadContext";

function HeroUIRouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <HeroUIRouterProvider>
        <Toast.Provider placement="bottom end" maxVisibleToasts={4} />
        <UploadProvider>{children}</UploadProvider>
      </HeroUIRouterProvider>
    </ClerkProvider>
  );
}
