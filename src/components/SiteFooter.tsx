import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { DiscordLogo } from "@/components/drive/DiscordLogo";
import { GithubLogo } from "@/components/drive/GithubLogo";
import {
  DISCORD_INVITE_URL,
  GITHUB_REPO_URL,
} from "@/components/site/nav-links";

const PRODUCT = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Integrations", href: "/#integrations" },
  { label: "FAQs", href: "/faqs" },
  { label: "Solutions", href: "/solutions" },
  { label: "About", href: "/#open-source" },
] as const;

const CLOUDS = [
  { label: "Google Drive", href: "/#integrations" },
  { label: "Google Shared Drive", href: "/#integrations" },
  { label: "Google Photos", href: "/#integrations" },
  { label: "Dropbox", href: "/#integrations" },
  { label: "pCloud", href: "/#integrations" },
  { label: "OneDrive", href: "/#integrations" },
  { label: "iCloud", href: "/#integrations" },
] as const;

const LINKS = [
  { label: "Privacy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms-of-service" },
  { label: "Support", href: "mailto:hello@archivecloud.app" },
  { label: "Help Center", href: "/help" },
  { label: "Security", href: "/security" },
] as const;

const MORE = [
  {
    label: "GitHub",
    href: GITHUB_REPO_URL,
    external: true,
    emphasized: true,
  },
  {
    label: "Discord",
    href: DISCORD_INVITE_URL,
    external: true,
    emphasized: true,
  },
] as const;

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  emphasized?: boolean;
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLink[];
}) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold tracking-tight text-[#111827]">
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => {
          const className = link.emphasized
            ? "inline-flex items-center gap-0.5 text-[15px] text-[#111827] underline decoration-[#111827]/40 underline-offset-4 transition-colors hover:decoration-[#111827]"
            : "text-[15px] text-[#6B7280] transition-colors hover:text-[#111827]";

          const content = link.emphasized ? (
            <>
              {link.label}
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
            </>
          ) : (
            link.label
          );

          return (
            <li key={link.label}>
              {link.href.startsWith("mailto:") || link.external ? (
                <a
                  href={link.href}
                  {...(link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className={className}
                >
                  {content}
                </a>
              ) : (
                <Link href={link.href} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandLogo className="h-10 w-10" />
            <span className="text-lg font-semibold tracking-tight text-[#111827]">
              Archive Cloud
            </span>
          </Link>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6B7280]">
            Open-source multi-cloud storage hub that doesn&apos;t lock you in.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[#111827]">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="transition-opacity hover:opacity-70"
            >
              <GithubLogo className="size-5" />
            </a>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="group"
            >
              <DiscordLogo className="size-5" />
            </a>
          </div>
          <p className="mt-3 text-[15px] text-[#6B7280]">
            Copyright © 2026 Archive Cloud. All rights reserved.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 sm:mt-20 sm:grid-cols-4 sm:gap-x-12">
          <FooterColumn title="Product" links={PRODUCT} />
          <FooterColumn title="Clouds" links={CLOUDS} />
          <FooterColumn title="Links" links={LINKS} />
          <FooterColumn title="More" links={MORE} />
        </div>
      </div>
    </footer>
  );
}
