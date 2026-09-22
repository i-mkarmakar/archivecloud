import type { Metadata } from "next";
import Link from "next/link";
import {
  KeyRoundIcon,
  LockIcon,
  ServerOffIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Security",
  "How Archive Cloud protects your cloud accounts: OAuth, encrypted tokens, and stream-through transfers without storing your files on our servers.",
);

const SECURITY_POINTS = [
  {
    title: "OAuth, not passwords",
    description:
      "Google Drive, Photos, Shared Drive, OneDrive, Dropbox, and pCloud connect with official OAuth. Providers that require keys or app-specific passwords store those credentials encrypted, never in plaintext logs.",
    icon: KeyRoundIcon,
  },
  {
    title: "Encrypted provider tokens",
    description:
      "Access and refresh tokens are encrypted at rest with a dedicated encryption key before they are stored in the database. Secrets are never logged.",
    icon: LockIcon,
  },
  {
    title: "No disk dump of your files",
    description:
      "Uploads and cloud-to-cloud transfers stream through the backend into the destination provider. We do not keep a long-term copy of your file bytes on Archive Cloud disk.",
    icon: ServerOffIcon,
  },
  {
    title: "Share links with control",
    description:
      "Public share and preview tokens are stored as hashes where applicable. You can revoke shares and manage invites from your Shared page.",
    icon: ShieldCheckIcon,
  },
] as const;

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-24 sm:px-6">
      <p className="text-sm font-semibold text-primary">Security</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0F172A] md:text-4xl">
        Built to connect clouds without becoming another vault of your files
      </h1>
      <p className="mt-4 text-[#64748B]">
        Archive Cloud is a gateway across the providers you already trust. We
        focus on encrypted credentials, least-privilege OAuth, and
        stream-through transfers so your content stays in your clouds.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {SECURITY_POINTS.map((point) => (
          <article
            key={point.title}
            className="rounded-2xl border border-[#E5EEF7] bg-white p-5"
          >
            <point.icon className="size-5 text-[#0F172A]" />
            <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
              {point.title}
            </h2>
            <p className="mt-2 text-sm text-[#64748B]">{point.description}</p>
          </article>
        ))}
      </div>

      <p className="mt-12 text-sm text-[#64748B]">
        Read the full legal details in our{" "}
        <Link
          href="/privacy-policy"
          className="text-[#0F172A] underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link
          href="/terms-of-service"
          className="text-[#0F172A] underline-offset-4 hover:underline"
        >
          Terms
        </Link>
        , or start connecting accounts in Settings.
      </p>
      <Link
        href="/settings"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
      >
        Open Settings
      </Link>
    </div>
  );
}
