import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Recent",
  "Recently opened and downloaded files.",
);

export default function RecentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
