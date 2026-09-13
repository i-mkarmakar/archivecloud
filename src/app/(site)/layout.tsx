import type { ReactNode } from "react";
import { SiteLayout } from "@/layouts/SiteLayout";

export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  return <SiteLayout>{children}</SiteLayout>;
}
