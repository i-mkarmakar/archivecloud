import { redirect } from "next/navigation";

export default function AllFilesRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    }
  }
  const qs = params.toString();
  redirect(qs ? `/home?${qs}` : "/home");
}
