import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Run History",
  "Audit trail of scheduled Move, Copy, and Delete runs across connected clouds.",
);

export default function RunHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
