export const GITHUB_REPO_URL = "https://github.com/i-mkarmakar/archivecloud";
/** Real Discord invite — /discord redirect destination + member-count API. */
export const DISCORD_INVITE_URL = "https://discord.gg/z9rg9MrWSn";
/** Public short link used in UI (navbar, footer, etc.). */
export const DISCORD_URL = "https://archivecloud.in/discord";

export type NavLink = {
  title: string;
  href: string;
};

export const NAV_LINKS: NavLink[] = [
  { title: "Features", href: "/#features" },
  { title: "Integrations", href: "/#integrations" },
  { title: "Open source", href: "/#open-source" },
  { title: "Pricing", href: "/#pricing" },
  { title: "FAQ", href: "/#faq" },
];
