import type { ReactNode } from "react";
import { Footer, Navbar } from "@/marketing/components";
import { aeonik, inter } from "@/marketing/utils/constants/fonts";
import { cn } from "@/marketing/utils";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "marketing-site min-h-screen overflow-x-hidden antialiased",
        aeonik.variable,
        inter.variable,
        "font-default",
      )}
    >
      <div
        id="home"
        className="absolute inset-0 h-full bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,var(--background)_70%,transparent_110%)]"
        aria-hidden
      />
      <Navbar />
      <main className="relative z-0 mx-auto mt-32 w-full">{children}</main>
      <Footer />
    </div>
  );
}
