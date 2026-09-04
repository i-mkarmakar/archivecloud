import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Privacy Policy");

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-muted-foreground">
        ArchiveCloud stores account information and Google Drive connection
        tokens needed to provide the service. We do not sell your personal data.
        Contact us if you need access, correction, or deletion of your account
        data.
      </p>
    </div>
  );
}
