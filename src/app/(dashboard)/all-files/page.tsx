import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AllFilesRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") nextParams.set(key, value);
    else if (Array.isArray(value)) {
      for (const entry of value) nextParams.append(key, entry);
    }
  }
  const qs = nextParams.toString();
  redirect(qs ? `/home?${qs}` : "/home");
}
