import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Home");

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
