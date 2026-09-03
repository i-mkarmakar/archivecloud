import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Virtual Folders",
  "Cross-cloud virtual folders that reference files without moving them.",
);

export default function VirtualFoldersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
