import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Clouds",
  "Browse connected cloud drives from your Archive Cloud home.",
);

export default function CloudsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
