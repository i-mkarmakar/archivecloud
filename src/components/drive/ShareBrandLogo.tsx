import { cn } from "@/lib/utils";

const SHARE_LOGOS = {
  whatsapp: "/whatsApp.svg",
  telegram: "/telegram.svg",
  email: "/email.svg",
} as const;

export type ShareLogoName = keyof typeof SHARE_LOGOS;

export function ShareBrandLogo({
  name,
  className,
  alt,
}: {
  name: ShareLogoName;
  className?: string;
  alt?: string;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: static brand SVG from /public
    <img
      src={SHARE_LOGOS[name]}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      className={cn("h-5 w-5 object-contain", className)}
    />
  );
}
