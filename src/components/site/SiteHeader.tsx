import { SiteNavbar } from "@/components/SiteNavbar";

export function SiteHeader({
  githubStars = null,
  discordMembers = null,
}: {
  githubStars?: number | null;
  discordMembers?: number | null;
}) {
  return (
    <SiteNavbar githubStars={githubStars} discordMembers={discordMembers} />
  );
}
