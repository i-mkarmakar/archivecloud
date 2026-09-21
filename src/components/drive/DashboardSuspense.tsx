"use client";

import { Suspense, type ReactNode } from "react";
import {
  AccountCardsSkeleton,
  CardListSkeleton,
  FileGridSkeleton,
  FormPageSkeleton,
  StatCardsSkeleton,
} from "@/components/drive/PageSkeletons";

export function DashboardSuspense({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

export function FilesPageFallback() {
  return (
    <div className="mt-6 space-y-6">
      <StatCardsSkeleton count={3} label="Loading" />
      <FileGridSkeleton count={8} label="Loading files" />
    </div>
  );
}

export function SharedPageFallback() {
  return (
    <div className="mt-6 space-y-6">
      <FileGridSkeleton count={4} label="Loading folders" />
      <FileGridSkeleton count={8} label="Loading files" />
    </div>
  );
}

export function SettingsPageFallback() {
  return (
    <div className="mt-2">
      <FormPageSkeleton label="Loading settings" />
    </div>
  );
}

export function AutomationPageFallback() {
  return (
    <div className="mt-6 space-y-5">
      <StatCardsSkeleton count={3} label="Loading automation" />
      <CardListSkeleton count={4} label="Loading tasks" />
    </div>
  );
}

export function SearchPageFallback() {
  return <CardListSkeleton className="mt-6" count={6} label="Loading search" />;
}

export function CloudsPageFallback() {
  return (
    <AccountCardsSkeleton className="mt-6" count={3} label="Loading clouds" />
  );
}

export function BillingSuccessFallback() {
  return <FormPageSkeleton className="p-6" label="Loading" />;
}
