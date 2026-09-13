import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getDiscordMemberCount } from "@/lib/discord-members";
import { getGithubStars } from "@/lib/github-stars";

export async function SiteLayout({ children }: { children: ReactNode }) {
  const [githubStars, discordMembers] = await Promise.all([
    getGithubStars(),
    getDiscordMemberCount(),
  ]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#0F172A] antialiased">
      <SiteHeader githubStars={githubStars} discordMembers={discordMembers} />
      <main className="relative z-0 mx-auto mt-[calc(5rem+var(--site-banner-offset,0px))] w-full transition-[margin] duration-300 md:mt-[calc(6rem+var(--site-banner-offset,0px))]">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
