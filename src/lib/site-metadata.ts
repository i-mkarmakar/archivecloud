import type { Metadata } from "next";

export const APP_NAME = "Archive Cloud";

export function createPageMetadata(
  title: string,
  description?: string,
): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
  };
}
