import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Trash");

export default function TrashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
