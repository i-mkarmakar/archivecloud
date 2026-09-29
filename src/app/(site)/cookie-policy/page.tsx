import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Cookie Policy",
  "How Archive Cloud uses cookies and similar storage for sign-in, OAuth connect, and optional bot protection.",
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

export default function CookiePolicyPage() {
  return (
    <article className="relative z-10 mx-auto max-w-2xl bg-background px-6 pb-24">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Cookie Policy
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        This Cookie Policy explains how Archive Cloud uses cookies and similar
        technologies when you use our website and app. For broader privacy
        details, see our{" "}
        <Link
          href="/privacy-policy"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <Section title="What are cookies?">
        <p>
          Cookies are small text files stored on your device by your browser. We
          also use related browser storage (such as{" "}
          <code className="text-sm text-foreground">localStorage</code>) for
          preferences that are not sent to the server on every request.
        </p>
      </Section>

      <Section title="How we use cookies">
        <p>
          Archive Cloud uses cookies that are needed to run the product. We do
          not use advertising or third-party marketing cookies.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-foreground">
              Essential / authentication:
            </span>{" "}
            Session cookies from Better Auth (prefix{" "}
            <code className="text-sm text-foreground">archivecloud</code>) keep
            you signed in and protect authenticated API calls.
          </li>
          <li>
            <span className="font-medium text-foreground">
              OAuth connect flow:
            </span>{" "}
            Short-lived cookies such as{" "}
            <code className="text-sm text-foreground">
              archivecloud_connect_alias
            </code>{" "}
            and{" "}
            <code className="text-sm text-foreground">
              archivecloud_oauth_return
            </code>{" "}
            help complete cloud-account connect redirects and then are cleared.
          </li>
          <li>
            <span className="font-medium text-foreground">Preferences:</span> We
            may store UI choices in{" "}
            <code className="text-sm text-foreground">localStorage</code> (for
            example sidebar state, file view mode, or language). These stay on
            your device and are not used for advertising.
          </li>
        </ul>
      </Section>

      <Section title="Optional third-party cookies">
        <p>
          If Cloudflare Turnstile bot protection is enabled on this instance,
          Cloudflare may set cookies or similar technology when the Turnstile
          widget loads on auth or abuse-report forms. That is controlled by
          Cloudflare&apos;s services. See{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Cloudflare&apos;s Privacy Policy
          </a>
          .
        </p>
        <p>
          Payments for Thunder are handled by Polar on their checkout pages.
          Polar may use its own cookies there under Polar&apos;s policies.
        </p>
      </Section>

      <Section title="How long cookies last">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Session cookies last for the Better Auth session lifetime (or until
            you sign out).
          </li>
          <li>
            OAuth helper cookies are temporary and removed after the connect
            flow finishes or fails.
          </li>
          <li>
            Preference data in local storage remains until you clear site data
            or we change how preferences are stored.
          </li>
        </ul>
      </Section>

      <Section title="Managing cookies">
        <p>
          On first visit, Archive Cloud shows a cookie banner. You can accept
          all, reject optional preference storage, or open Cookie settings.
          Essential cookies stay on so sign-in and cloud connect keep working.
        </p>
        <p>
          You can also block or delete cookies in your browser settings. If you
          block essential session cookies, you will not be able to stay signed
          in. Clearing site data for archivecloud.in removes session cookies and
          local preferences for this site.
        </p>
        <p>
          Signing out clears your Archive Cloud session. Deleting your account
          removes server-side account data as described in the Privacy Policy;
          you may still need to clear cookies in your browser separately.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this Cookie Policy when our product or legal
          requirements change. The version on this page is the current policy.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about cookies:{" "}
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
