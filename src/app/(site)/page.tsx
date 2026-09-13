import type { Metadata } from "next";
import { HomePage } from "@/views/HomePage";

export const metadata: Metadata = {
  title: "One place for all your cloud storage",
  description:
    "Archive Cloud is an open-source multi-cloud storage hub. Connect Google Drive, Google Photos, Dropbox, OneDrive, pCloud, iCloud and more. Browse, search, organize and move files from one dashboard. Your files stay in your clouds.",
};

export default function Page() {
  return <HomePage />;
}
