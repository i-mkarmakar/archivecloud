import { DISCORD_INVITE_URL } from "@/components/site/nav-links";

const REVALIDATE_SECONDS = 3600;

function parseDiscordInviteCode(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "discord.gg" && host !== "discord.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const code =
      host === "discord.com" && parts[0] === "invite" ? parts[1] : parts[0];
    return code?.trim() || null;
  } catch {
    return null;
  }
}

export function formatDiscordMembers(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  if (thousands < 10) {
    return `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${Math.round(thousands)}k`;
}

export async function getDiscordMemberCount(): Promise<number | null> {
  const code = parseDiscordInviteCode(DISCORD_INVITE_URL);
  if (!code) return null;

  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
      {
        headers: { "User-Agent": "archivecloud" },
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );

    if (!response.ok) return null;

    const data: unknown = await response.json();
    const count =
      data &&
      typeof data === "object" &&
      "approximate_member_count" in data &&
      typeof (data as { approximate_member_count: unknown })
        .approximate_member_count === "number"
        ? (data as { approximate_member_count: number })
            .approximate_member_count
        : null;

    return count != null && Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}
