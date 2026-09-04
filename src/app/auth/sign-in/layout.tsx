import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Sign in");

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
