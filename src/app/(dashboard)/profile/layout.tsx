import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Profile");

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
