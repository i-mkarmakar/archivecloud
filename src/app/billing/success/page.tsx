import { redirect } from "next/navigation";

/**
 * Polar redirects here after checkout. Bounce into the dashboard with
 * query flags so BillingSuccessOverlay can sit on top of /home.
 */
export default async function BillingSuccessRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  next.set("billing_success", "1");

  const checkoutId = params.checkout_id;
  if (typeof checkoutId === "string" && checkoutId.trim()) {
    next.set("checkout_id", checkoutId);
  }

  redirect(`/home?${next.toString()}`);
}
