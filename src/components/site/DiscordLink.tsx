import { DiscordLogo } from "@/components/drive/DiscordLogo";
import { DISCORD_INVITE_URL } from "@/components/site/nav-links";
import { formatDiscordMembers } from "@/lib/discord-members";
import { cn } from "@/lib/utils";

type DiscordLinkProps = {
  members?: number | null;
  className?: string;
  scrolled?: boolean;
};

export function DiscordLink({
  members = null,
  className,
  scrolled = false,
}: DiscordLinkProps) {
  const label =
    members != null
      ? `Archive Cloud on Discord, ${members} members`
      : "Join Archive Cloud on Discord";

  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "group inline-flex h-9 items-center gap-5 rounded-full border border-transparent px-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-black/5 hover:text-foreground",
        scrolled && "hover:bg-black/5",
        className,
      )}
    >
      <DiscordLogo className="size-5 shrink-0" />
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex size-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
        </span>
        {members != null ? (
          <span className="tabular-nums">{formatDiscordMembers(members)}</span>
        ) : null}
      </span>
    </a>
  );
}
