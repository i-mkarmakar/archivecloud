import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Schedule Tasks",
  "Automate Move and Copy operations across connected clouds.",
);

export default function AutomationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

