import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Quota Tracker");

export default function QuotaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
