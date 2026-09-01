import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Shared file");

export default function PublicFileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
