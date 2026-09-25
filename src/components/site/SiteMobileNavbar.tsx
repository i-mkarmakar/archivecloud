"use client";

import { buttonVariants } from "@/components/site/button";
import { DiscordLink } from "@/components/site/DiscordLink";
import { GithubStarsLink } from "@/components/site/GithubStarsLink";
import { NAV_LINKS } from "@/components/site/nav-links";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const navMenuVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const navItemVariants = {
  hidden: { opacity: 0, y: -20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

const buttonVariantsMotion = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
      delay: 0.5,
    },
  },
};

export function SiteMobileNavbar({
  scrolled = false,
  githubStars = null,
  discordMembers = null,
  onOpenChange,
}: {
  scrolled?: boolean;
  githubStars?: number | null;
  discordMembers?: number | null;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div className="flex items-center justify-end gap-2 lg:hidden">
      <GithubStarsLink stars={githubStars} scrolled={scrolled} />
      <DiscordLink members={discordMembers} scrolled={scrolled} />
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        onClick={() => setOpen(true)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          scrolled && "hover:bg-black/5",
        )}
      >
        <Menu size={22} />
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {isOpen ? (
                <>
                  <motion.button
                    type="button"
                    aria-label="Close menu backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100001] cursor-pointer bg-black/40 lg:hidden"
                    onClick={handleClose}
                  />
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ duration: 0.3, type: "tween" }}
                    className="fixed top-0 right-0 z-[100002] flex h-dvh w-[80%] flex-col items-start gap-4 bg-background px-8 font-[family-name:var(--font-manrope),ui-sans-serif,system-ui,sans-serif] lg:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Mobile navigation"
                  >
                    <button
                      type="button"
                      aria-label="Close menu"
                      onClick={handleClose}
                      className="absolute top-4 right-6 flex size-9 cursor-pointer items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X size={22} className="text-foreground" />
                    </button>

                    <motion.nav
                      variants={navMenuVariants}
                      initial="hidden"
                      animate="show"
                      className="mt-16 flex w-full flex-col gap-1"
                    >
                      {NAV_LINKS.map((link) => (
                        <motion.div key={link.href} variants={navItemVariants}>
                          <Link
                            href={link.href}
                            onClick={handleClose}
                            className="block cursor-pointer py-2.5 text-left text-xl font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {link.title}
                          </Link>
                        </motion.div>
                      ))}
                    </motion.nav>

                    <motion.div
                      className="w-full"
                      variants={buttonVariantsMotion}
                      initial="hidden"
                      animate="show"
                    >
                      {sessionPending ? (
                        <span
                          className="mt-3 inline-block h-12 w-full"
                          aria-hidden
                        />
                      ) : isSignedIn ? (
                        <Link
                          href="/home"
                          onClick={handleClose}
                          className={buttonVariants({
                            className:
                              "mt-3 w-full cursor-pointer px-5 py-6 text-sm",
                          })}
                        >
                          Dashboard
                        </Link>
                      ) : (
                        <InteractiveHoverButton
                          href="/auth/sign-up"
                          onClick={handleClose}
                          className="mt-3 h-12 w-full cursor-pointer justify-center px-5 text-sm"
                        >
                          Try for free
                        </InteractiveHoverButton>
                      )}
                    </motion.div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
