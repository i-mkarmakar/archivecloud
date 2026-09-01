import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Embed");

export default function PublicEmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
