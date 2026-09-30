import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/** Force desktop media queries inside the hero iframe on phones. */
export const viewport: Viewport = {
  width: 1280,
  initialScale: 1,
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Bare chrome for the marketing hero iframe (desktop viewport, no site shell). */
export default function HeroDashboardEmbedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {children}
    </div>
  );
}
