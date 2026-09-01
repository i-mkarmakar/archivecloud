import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Sign up");

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
