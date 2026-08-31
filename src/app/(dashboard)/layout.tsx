"use client";

import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DriveLayout } from "@/layouts/DriveLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center text-sm text-muted">
            Loading...
          </main>
        }
      >
        <DriveLayout>{children}</DriveLayout>
      </Suspense>
    </ProtectedRoute>
  );
}
