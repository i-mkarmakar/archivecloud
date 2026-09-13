"use client";

import { buttonVariants } from "@/components/site/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { AnimationContainer } from "@/components/site/AnimationContainer";
import { DiscordLink } from "@/components/site/DiscordLink";
import { GithubStarsLink } from "@/components/site/GithubStarsLink";
import { MaxWidthWrapper } from "@/components/site/MaxWidthWrapper";
import { SiteMobileNavbar } from "@/components/site/SiteMobileNavbar";
import { NAV_LINKS } from "@/components/site/nav-links";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteNavbar({
  githubStars = null,
  discordMembers = null,
  bannerOffset = false,
}: {
  githubStars?: number | null;
  discordMembers?: number | null;
  bannerOffset?: boolean;
}) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const [scroll, setScroll] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setScroll((prev) => {
          if (!prev && y > 40) return true;
          if (prev && y < 12) return false;
          return prev;
        });
        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 z-[99999] w-full select-none transition-[top,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        bannerOffset && !scroll ? "top-14" : "top-0",
        scroll ? "pointer-events-none px-3 pt-3 sm:px-4" : "h-14",
      )}
    >
      <AnimationContainer reverse delay={0.1} className="size-full">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex h-14 w-full items-center border backdrop-blur-xl transition-[max-width,border-radius,background-color,border-color,box-shadow,padding,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            scroll
              ? "max-w-5xl translate-y-0 scale-100 rounded-full border-white/50 bg-white/55 px-4 shadow-[0_8px_32px_rgba(15,23,42,0.08)] supports-[backdrop-filter]:bg-white/40 sm:px-5"
              : "max-w-full scale-100 rounded-none border-transparent bg-transparent px-4 shadow-none md:max-w-screen-xl md:px-12 lg:px-20",
          )}
        >
          <MaxWidthWrapper
            className={cn(
              "flex items-center justify-between !px-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              scroll && "max-w-none",
            )}
          >
            <div className="flex items-center space-x-6 lg:space-x-8">
              <Link href="/#home" className="flex items-center">
                <BrandLogo
                  className={cn(
                    "h-12 w-12 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    scroll && "h-10 w-10",
                  )}
                />
                <span className="sr-only">Archive Cloud</span>
              </Link>

              <NavigationMenu className="hidden lg:flex">
                <NavigationMenuList>
                  {NAV_LINKS.map((link) => (
                    <NavigationMenuItem key={link.title}>
                      <NavigationMenuLink
                        asChild
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          scroll &&
                            "bg-transparent text-foreground/75 hover:bg-black/5 hover:text-foreground focus:bg-black/5 focus:text-foreground",
                        )}
                      >
                        <Link href={link.href}>{link.title}</Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <GithubStarsLink stars={githubStars} scrolled={scroll} />
              <DiscordLink members={discordMembers} scrolled={scroll} />
              {user ? (
                <Link
                  href="/home"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    scroll && "rounded-full shadow-sm",
                  )}
                >
                  Dashboard
                </Link>
              ) : (
                <InteractiveHoverButton
                  href="/auth/sign-up"
                  className={cn(
                    "h-9 px-4 text-sm",
                    "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    scroll && "rounded-full",
                  )}
                >
                  Try for free
                </InteractiveHoverButton>
              )}
            </div>

            <SiteMobileNavbar
              scrolled={scroll}
              githubStars={githubStars}
              discordMembers={discordMembers}
            />
          </MaxWidthWrapper>
        </div>
      </AnimationContainer>
    </header>
  );
}
