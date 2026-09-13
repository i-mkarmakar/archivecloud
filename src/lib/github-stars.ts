import { GITHUB_REPO_URL } from "@/components/site/nav-links";

const REVALIDATE_SECONDS = 3600;

function parseGithubRepo(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("github.com")) return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

export function formatGithubStars(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  if (thousands < 10) {
    return `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${Math.round(thousands)}k`;
}

export async function getGithubStars(): Promise<number | null> {
  const repo = parseGithubRepo(GITHUB_REPO_URL);
  if (!repo) return null;

  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "archivecloud",
    };
    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    const count =
      data &&
      typeof data === "object" &&
      "stargazers_count" in data &&
      typeof (data as { stargazers_count: unknown }).stargazers_count === "number"
        ? (data as { stargazers_count: number }).stargazers_count
        : null;

    return count != null && Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}
