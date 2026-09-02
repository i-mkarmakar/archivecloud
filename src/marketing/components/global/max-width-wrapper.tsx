import { cn } from "@/marketing/utils";
import type React from "react";

interface Props {
  className?: string;
  children: React.ReactNode;
  id?: string;
}

const MaxWidthWrapper = ({ className, children, id }: Props) => {
  return (
    <section
      id={id}
      className={cn(
        "h-full mx-auto w-full max-w-full md:max-w-screen-xl px-4 md:px-12 lg:px-20",
        className,
      )}
    >
      {children}
    </section>
  );
};

export default MaxWidthWrapper;
