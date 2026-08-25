"use client";

import { DeveloperRoute } from "@/components/auth/DeveloperRoute";

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DeveloperRoute>{children}</DeveloperRoute>;
}
