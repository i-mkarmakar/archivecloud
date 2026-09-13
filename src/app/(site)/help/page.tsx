import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";
import { HelpPage } from "@/views/HelpPage";

export const metadata: Metadata = createPageMetadata(
  "Help Center",
  "Find answers for each cloud service and common topics: Google Drive, Dropbox, OneDrive, sync, uploads, search, and virtual folders.",
);

export default function Page() {
  return <HelpPage />;
}
