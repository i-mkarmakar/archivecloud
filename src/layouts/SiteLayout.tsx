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
      <main className="relative z-0 mx-auto mt-16 w-full md:mt-20">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
