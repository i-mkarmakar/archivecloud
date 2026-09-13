import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MaxWidthWrapper({
  className,
  children,
  id,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "mx-auto h-full w-full max-w-full px-4 md:max-w-screen-xl md:px-12 lg:px-20",
        className,
      )}
    >
      {children}
    </div>
  );
}
