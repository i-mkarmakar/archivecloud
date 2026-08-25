import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Shared");

export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
