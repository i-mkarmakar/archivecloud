import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Google Connected");

export default function GoogleConnectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
