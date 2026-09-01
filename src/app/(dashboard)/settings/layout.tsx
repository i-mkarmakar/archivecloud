import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Settings");

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
