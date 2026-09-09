import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Search",
  "Search files across Archive Cloud and all connected cloud drives.",
);

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
