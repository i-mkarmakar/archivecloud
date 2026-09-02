import type { Metadata } from "next";

export const generateMetadata = ({
  title = "ArchiveCloud - Google Drive storage gateway",
  description = "Connect multiple Google Drive accounts, upload through one gateway, and manage files with unified quota tracking, virtual folders, and secure sharing.",
  image = "/logo.png",
  icons = [
    {
      rel: "apple-touch-icon",
      sizes: "32x32",
      url: "/logo.png",
    },
    {
      rel: "icon",
      sizes: "32x32",
      url: "/logo.png",
    },
  ],
  noIndex = false,
}: {
  title?: string;
  description?: string;
  image?: string | null;
  icons?: Metadata["icons"];
  noIndex?: boolean;
} = {}): Metadata => ({
  title,
  description,
  icons,
  openGraph: {
    title,
    description,
    ...(image && { images: [{ url: image }] }),
  },
  twitter: {
    title,
    description,
    ...(image && { card: "summary_large_image", images: [image] }),
  },
  ...(noIndex && { robots: { index: false, follow: false } }),
});
