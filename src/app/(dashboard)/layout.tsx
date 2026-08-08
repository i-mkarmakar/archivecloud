"use client";

import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DeveloperModeProvider } from "@/context/DeveloperModeContext";
import { DriveLayout } from "@/layouts/DriveLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DeveloperModeProvider>
        <Suspense
          fallback={
            <main className="flex min-h-screen items-center justify-center text-sm text-muted">
              Loading...
            </main>
          }
        >
          <DriveLayout>{children}</DriveLayout>
        </Suspense>
      </DeveloperModeProvider>
    </ProtectedRoute>
  );
}
