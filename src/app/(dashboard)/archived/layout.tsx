import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Archived");

export default function ArchivedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
