"use client";

import { Button, buttonVariants } from "@/components/site/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DiscordLink } from "@/components/site/DiscordLink";
import { GithubStarsLink } from "@/components/site/GithubStarsLink";
import { NAV_LINKS } from "@/components/site/nav-links";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function SiteMobileNavbar({
  scrolled = false,
  githubStars = null,
  discordMembers = null,
}: {
  scrolled?: boolean;
  githubStars?: number | null;
  discordMembers?: number | null;
}) {
  const { data: session } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="flex items-center justify-end gap-2 lg:hidden">
      <GithubStarsLink stars={githubStars} scrolled={scrolled} />
      <DiscordLink members={discordMembers} scrolled={scrolled} />
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              scrolled &&
                "text-foreground hover:bg-black/5 hover:text-foreground",
            )}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-screen">
          <SheetClose
            asChild
            className="absolute top-3 right-5 z-20 flex items-center justify-center bg-background"
          >
            <Button size="icon" variant="ghost" className="text-neutral-600">
              <X className="h-5 w-5" />
            </Button>
          </SheetClose>
          <div className="mt-10 flex w-full flex-col items-start py-2">
            <div className="flex w-full items-center justify-evenly space-x-2">
              {isSignedIn ? (
                <Link
                  href="/home"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full",
                  })}
                >
                  Dashboard
                </Link>
              ) : (
                <InteractiveHoverButton
                  href="/auth/sign-up"
                  onClick={handleClose}
                  className="h-10 w-full justify-center px-4 text-sm"
                >
                  Try for free
                </InteractiveHoverButton>
              )}
            </div>
            <ul className="mt-6 flex w-full flex-col items-start border-t border-border pt-2">
              {NAV_LINKS.map((link) => (
                <li key={link.title} className="w-full">
                  <Link
                    href={link.href}
                    onClick={handleClose}
                    className="flex w-full items-center py-4 font-medium text-muted-foreground hover:text-foreground"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
