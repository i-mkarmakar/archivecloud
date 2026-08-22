import { cn } from "@/lib/utils";

export function DiscordLogo({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <img
      src="/brand/discord.svg"
      alt=""
      aria-hidden
      className={cn(
        "shrink-0 object-contain brightness-0 transition-[filter] duration-200 group-hover:brightness-100",
        className,
      )}
    />
  );
}
