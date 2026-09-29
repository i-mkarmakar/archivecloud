import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Refund Policy",
  "Refund policy for Archive Cloud Thunder lifetime purchases processed through Polar.",
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function RefundPolicyPage() {
  return (
    <article className="relative z-10 mx-auto max-w-2xl bg-background px-6 pb-24">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Refund Policy
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        This Refund Policy explains when and how refunds work for paid Archive
        Cloud purchases. The Free plan and self-hosted deployments do not
        involve payments to us, so they are not covered here.
      </p>

      <Section title="What you can buy">
        <p>
          On the official hosted service, paid upgrades are sold as{" "}
          <span className="font-medium text-foreground">
            Thunder lifetime access
          </span>{" "}
          for a one-time fee (currently $9 USD). Payments are processed by our
          billing provider, Polar. There is no recurring subscription charge for
          Thunder lifetime.
        </p>
      </Section>

      <Section title="14-day refund window">
        <p>
          You may request a full refund within{" "}
          <span className="font-medium text-foreground">14 days</span> of the
          purchase date if:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You bought Thunder on the official Archive Cloud hosted service.
          </li>
          <li>
            You are not satisfied with the product, or Thunder features did not
            unlock after payment through no fault of yours.
          </li>
        </ul>
        <p>
          Refund requests after 14 days are reviewed case by case (for example,
          duplicate charges or clear billing errors).
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>Email us at:</p>
        <p>
          <a
            href="mailto:team@archivecloud.in"
            className="text-foreground underline underline-offset-4"
          >
            team@archivecloud.in
          </a>
        </p>
        <p>Include:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>The email address on your Archive Cloud account</li>
          <li>Approximate purchase date</li>
          <li>Order or checkout ID if you have it (from Billing History)</li>
          <li>A short reason for the request</li>
        </ul>
        <p>
          You can also open{" "}
          <Link
            href="/billing/history"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Billing History
          </Link>{" "}
          when signed in to find receipts and Polar customer-portal links.
        </p>
      </Section>

      <Section title="After a refund">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Approved refunds are processed through Polar back to your original
            payment method. Timing depends on Polar and your bank or card
            issuer.
          </li>
          <li>
            When a purchase is refunded, Thunder access on that account is
            revoked and the account returns to Free plan limits.
          </li>
        </ul>
      </Section>

      <Section title="What we generally do not refund">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Requests made more than 14 days after purchase, except for billing
            errors or duplicate charges.
          </li>
          <li>
            Self-hosted instances you run yourself (there is no payment to
            Archive Cloud for those).
          </li>
          <li>
            Charges from third-party cloud providers (Google, Microsoft,
            Dropbox, pCloud, Apple, and others). Those follow each
            provider&apos;s own billing policies.
          </li>
          <li>
            Abuse of the refund process (for example, repeated buy-and-refund
            cycles).
          </li>
        </ul>
      </Section>

      <Section title="Chargebacks">
        <p>
          If you have a billing problem, contact us first so we can help. Filing
          a chargeback without contacting us may delay resolution and can result
          in account suspension while the dispute is open.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this Refund Policy from time to time. The version on
          this page is the current policy. Related terms are in our{" "}
          <Link
            href="/terms-of-service"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about refunds:{" "}
          <a
            href="mailto:team@archivecloud.in"
            className="text-foreground underline underline-offset-4"
          >
            team@archivecloud.in
          </a>
        </p>
      </Section>
    </article>
  );
}
