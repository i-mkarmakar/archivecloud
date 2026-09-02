"use client";

import { buttonVariants } from "@/marketing/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/marketing/components/ui/navigation-menu";
import { cn, NAV_LINKS } from "@/marketing/utils";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { authClient } from "@/lib/auth-client";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import MaxWidthWrapper from "../global/max-width-wrapper";
import MobileNavbar from "./mobile-navbar";
import AnimationContainer from "../global/animation-container";

const Navbar = () => {
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
        // Hysteresis avoids flicker near the threshold
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
        "fixed top-0 inset-x-0 z-[99999] w-full select-none transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        scroll ? "pointer-events-none px-3 pt-3 sm:px-4" : "h-14",
      )}
    >
      <AnimationContainer reverse delay={0.1} className="size-full">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex h-14 w-full items-center border backdrop-blur-xl transition-[max-width,border-radius,background-color,border-color,box-shadow,padding,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            scroll
              ? "max-w-4xl translate-y-0 scale-100 rounded-full border-white/50 bg-white/55 px-3 shadow-[0_8px_32px_rgba(15,23,42,0.08)] supports-[backdrop-filter]:bg-white/40 sm:px-5"
              : "max-w-full scale-100 rounded-none border-transparent bg-transparent shadow-none md:max-w-screen-xl md:px-12 lg:px-20",
          )}
        >
          <MaxWidthWrapper
            className={cn(
              "flex items-center justify-between !px-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              scroll && "max-w-none",
            )}
          >
            <div className="flex items-center space-x-8 lg:space-x-10">
              <Link href="/#home" className="flex items-center gap-2">
                <BrandLogo
                  className={cn(
                    "h-9 w-9 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    scroll && "h-8 w-8",
                  )}
                />
                <span className="hidden text-sm font-semibold tracking-tight text-foreground transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:inline">
                  ArchiveCloud
                </span>
              </Link>

              <NavigationMenu className="hidden lg:flex">
                <NavigationMenuList>
                  {NAV_LINKS.map((link) => (
                    <NavigationMenuItem key={link.title}>
                      {link.menu ? (
                        <>
                          <NavigationMenuTrigger
                            className={cn(
                              "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                              scroll &&
                                "bg-transparent text-foreground/75 hover:bg-black/5 hover:text-foreground data-[state=open]:bg-black/5 data-[state=open]:text-foreground",
                            )}
                          >
                            {link.title}
                          </NavigationMenuTrigger>
                          <NavigationMenuContent>
                            <ul
                              className={cn(
                                "grid gap-1 rounded-xl p-4 md:w-[400px] lg:w-[500px]",
                                link.title === "Features"
                                  ? "lg:grid-cols-[.75fr_1fr]"
                                  : "lg:grid-cols-2",
                              )}
                            >
                              {link.title === "Features" && (
                                <li className="relative row-span-4 overflow-hidden rounded-lg pr-2">
                                  <div className="absolute inset-0 !z-10 h-full w-[calc(100%-10px)] bg-[linear-gradient(to_right,rgb(226,232,240,0.9)_1px,transparent_1px),linear-gradient(to_bottom,rgb(226,232,240,0.9)_1px,transparent_1px)] bg-[size:1rem_1rem]" />
                                  <NavigationMenuLink
                                    asChild
                                    className="relative z-20"
                                  >
                                    <Link
                                      href="/#features"
                                      className="flex h-full w-full select-none flex-col justify-end rounded-lg bg-gradient-to-b from-muted/50 to-muted p-4 no-underline outline-none focus:shadow-md"
                                    >
                                      <h6 className="mb-2 mt-4 text-lg font-medium">
                                        All Features
                                      </h6>
                                      <p className="text-sm leading-tight text-muted-foreground">
                                        Upload, organize, share, and track
                                        quota.
                                      </p>
                                    </Link>
                                  </NavigationMenuLink>
                                </li>
                              )}
                              {link.menu.map((menuItem) => (
                                <ListItem
                                  key={menuItem.title}
                                  title={menuItem.title}
                                  href={menuItem.href}
                                  icon={menuItem.icon}
                                >
                                  {menuItem.tagline}
                                </ListItem>
                              ))}
                            </ul>
                          </NavigationMenuContent>
                        </>
                      ) : (
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
                      )}
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            <div className="hidden items-center lg:flex">
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
                <div className="flex items-center gap-x-2">
                  <Link
                    href="/signin"
                    className={cn(
                      buttonVariants({ size: "sm", variant: "ghost" }),
                      "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      scroll && "hover:bg-black/5",
                    )}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      scroll && "rounded-full shadow-sm",
                    )}
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>

            <MobileNavbar scrolled={scroll} />
          </MaxWidthWrapper>
        </div>
      </AnimationContainer>
    </header>
  );
};

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { title: string; icon: LucideIcon }
>(({ className, title, href, icon: Icon, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href!}
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-lg p-3 leading-none no-underline outline-none transition-all duration-100 ease-out hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className,
          )}
          {...props}
        >
          <div className="flex items-center space-x-2 text-foreground">
            <Icon className="h-4 w-4" />
            <h6 className="text-sm font-medium !leading-none">{title}</h6>
          </div>
          <p
            title={children! as string}
            className="line-clamp-1 text-sm leading-snug text-muted-foreground"
          >
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export default Navbar;
