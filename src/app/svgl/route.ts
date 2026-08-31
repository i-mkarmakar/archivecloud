import {
  fetchSvglBySearch,
  GOOGLE_DRIVE_LOGO_FALLBACK,
  resolveSvglLogoSrc,
} from "@/lib/svgl";
import { errorJson } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "Google Drive";
  const theme = searchParams.get("theme") === "dark" ? "dark" : "light";

  const svg = await fetchSvglBySearch(search);
  const src =
    resolveSvglLogoSrc(svg, theme) ??
    (search.toLowerCase() === "google drive"
      ? GOOGLE_DRIVE_LOGO_FALLBACK
      : null);

  if (!src) {
    return errorJson("NOT_FOUND", `No SVGL logo found for "${search}".`, 404);
  }

  return new Response(JSON.stringify({ src, title: svg?.title ?? search }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
