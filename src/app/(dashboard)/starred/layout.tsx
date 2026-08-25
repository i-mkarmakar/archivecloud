import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Starred");

export default function StarredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
