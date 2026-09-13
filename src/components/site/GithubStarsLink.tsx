import { GithubLogo } from "@/components/drive/GithubLogo";
import { GITHUB_REPO_URL } from "@/components/site/nav-links";
import { formatGithubStars } from "@/lib/github-stars";
import { cn } from "@/lib/utils";

type GithubStarsLinkProps = {
  stars: number | null;
  className?: string;
  scrolled?: boolean;
};

export function GithubStarsLink({
  stars,
  className,
  scrolled: _scrolled = false,
}: GithubStarsLinkProps) {
  const label =
    stars != null
      ? `Archive Cloud on GitHub, ${stars} stars`
      : "Archive Cloud on GitHub";

  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-sm font-medium text-foreground/80",
        className,
      )}
    >
      <GithubLogo className="size-5 shrink-0" />
      {stars != null ? (
        <span className="tabular-nums">{formatGithubStars(stars)}</span>
      ) : null}
    </a>
  );
}
