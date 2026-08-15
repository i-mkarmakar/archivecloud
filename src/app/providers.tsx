"use client";

import { RouterProvider, Toast } from "@heroui/react";

import { UploadProvider } from "@/context/UploadContext";
import { useRouter } from "next/navigation";

function HeroUIRouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIRouterProvider>
      <Toast.Provider placement="bottom end" maxVisibleToasts={4} />
      <UploadProvider>{children}</UploadProvider>
    </HeroUIRouterProvider>
  );
}
