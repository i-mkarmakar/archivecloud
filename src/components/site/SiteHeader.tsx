"use client";

import { useEffect, useState } from "react";
import { SiteNavbar } from "@/components/SiteNavbar";
import { SiteStickyBanner } from "@/components/site/SiteStickyBanner";

export function SiteHeader({
  githubStars = null,
  discordMembers = null,
}: {
  githubStars?: number | null;
  discordMembers?: number | null;
}) {
  const [bannerOpen, setBannerOpen] = useState(true);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--site-banner-offset",
      bannerOpen ? "3.5rem" : "0px",
    );
    return () => {
      document.documentElement.style.removeProperty("--site-banner-offset");
    };
  }, [bannerOpen]);

  return (
    <>
      <SiteStickyBanner onOpenChange={setBannerOpen} />
      <SiteNavbar
        githubStars={githubStars}
        discordMembers={discordMembers}
        bannerOffset={bannerOpen}
      />
    </>
  );
}
