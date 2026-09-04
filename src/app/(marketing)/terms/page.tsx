import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Terms of Service");

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-muted-foreground">
        By using ArchiveCloud, you agree to use the service lawfully and keep
        your account credentials secure. We may update these terms from time to
        time; continued use constitutes acceptance of the updated terms.
      </p>
    </div>
  );
}
