import type { Metadata, Viewport } from "next";
import { Geist, Manrope } from "next/font/google";

import { Providers } from "@/app/providers";
import { APP_NAME } from "@/lib/site-metadata";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description:
    "Open-source multi-cloud storage hub. Connect Google Drive, Dropbox, OneDrive, and more. Manage files from one dashboard. Your files stay in your clouds.",
};

export const viewport: Viewport = {
  themeColor: "#1e9df1",
  width: "device-width",
  initialScale: 1,
  // Do not set viewportFit: "cover" — on iPhone Safari it enables large
  // safe-area insets that show up as an intermittent empty band under the
  // status bar when combined with sticky/fixed chrome.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "light h-full",
        manrope.variable,
        "font-sans",
        geist.variable,
      )}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-full font-[family-name:var(--font-manrope),ui-sans-serif,system-ui,sans-serif] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
