"use client";

import {
  MobileNav,
  MobileNavHeader,
  NavBody,
  Navbar,
  NavbarLogo,
  NavItems,
} from "@/components/ui/resizable-navbar";
import { buttonVariants } from "@/components/site/button";
import { DiscordLink } from "@/components/site/DiscordLink";
import { GithubStarsLink } from "@/components/site/GithubStarsLink";
import { SiteMobileNavbar } from "@/components/site/SiteMobileNavbar";
import { NAV_LINKS } from "@/components/site/nav-links";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = NAV_LINKS.map((link) => ({
  name: link.title,
  link: link.href,
}));

export function SiteNavbar({
  githubStars = null,
  discordMembers = null,
}: {
  githubStars?: number | null;
  discordMembers?: number | null;
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const user = session?.user;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Navbar className="z-[99999]">
      {/* Desktop */}
      <NavBody>
        <div className="relative z-20 flex items-center gap-1">
          <NavbarLogo />
          <NavItems items={NAV_ITEMS} />
        </div>
        <div className="relative z-20 flex items-center gap-2">
          <GithubStarsLink stars={githubStars} />
          <DiscordLink members={discordMembers} />
          {sessionPending ? (
            <span className="inline-block h-9 w-[7.5rem]" aria-hidden />
          ) : user ? (
            <Link href="/home" className={cn(buttonVariants({ size: "sm" }))}>
              Dashboard
            </Link>
          ) : (
            <InteractiveHoverButton
              href="/auth/sign-up"
              className="h-9 px-4 text-sm"
            >
              Try for free
            </InteractiveHoverButton>
          )}
        </div>
      </NavBody>

      {/* Mobile: hide pill while sidebar is open so it doesn't show black behind */}
      <MobileNav
        className={cn(
          mobileMenuOpen && "pointer-events-none opacity-0 shadow-none",
        )}
      >
        <MobileNavHeader>
          <NavbarLogo />
          <SiteMobileNavbar
            githubStars={githubStars}
            discordMembers={discordMembers}
            onOpenChange={setMobileMenuOpen}
          />
        </MobileNavHeader>
      </MobileNav>
    </Navbar>
  );
}
