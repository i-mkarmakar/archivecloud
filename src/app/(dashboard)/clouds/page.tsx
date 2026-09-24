import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CloudsRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const accountId =
    typeof sp.accountId === "string"
      ? sp.accountId
      : Array.isArray(sp.accountId)
        ? sp.accountId[0]
        : undefined;
  if (accountId) {
    redirect(`/home?accountId=${encodeURIComponent(accountId)}`);
  }
  redirect("/home");
}
