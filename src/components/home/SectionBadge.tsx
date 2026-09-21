import { cn } from "@/lib/utils";

export function SectionBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[#BFDFFF] bg-[#F5FAFF] px-4 py-1.5 text-sm font-semibold text-primary",
        className,
      )}
    >
      <span aria-hidden className="text-base leading-none sm:text-lg">
        ✦
      </span>
      {children}
    </span>
  );
}
