import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { getProfileImageUrl } from "@/lib/gravatar";

/**
 * Ensure the saved profile image is present and high-resolution.
 * Persists upgraded Google thumbs (`=s96-c` → `=s512-c`) when needed.
 */
export async function syncGoogleProfileImageIfNeeded(
  currentImage?: string | null,
): Promise<string | null> {
  const fallback = currentImage?.trim()
    ? getProfileImageUrl({ image: currentImage, size: 512 })
    : null;

  try {
    const result = await apiFetch<{ image: string | null; synced: boolean }>(
      "/account/sync-google-avatar",
      { method: "POST" },
    );
    const image = result.image?.trim() || null;
    if (image && result.synced) {
      await authClient.getSession();
    }
    return image ? getProfileImageUrl({ image, size: 512 }) : fallback;
  } catch {
    return fallback;
  }
}
