"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DriveLayout } from "@/layouts/DriveLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<AppPreloader />}>
        <DriveLayout>{children}</DriveLayout>
      </Suspense>
    </ProtectedRoute>
  );
}
