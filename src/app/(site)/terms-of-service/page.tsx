import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Terms of Service");

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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

export default function TermsPage() {
  return (
    <article className="relative z-10 mx-auto max-w-2xl bg-background px-6 pb-24">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Terms of Service
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Welcome to Archive Cloud. These Terms and Conditions (&ldquo;Terms&rdquo;)
        govern your access to and use of our platform and services
        (&ldquo;Services&rdquo;). By using Archive Cloud, you agree to be bound by
        these Terms. If you do not agree, please do not use our Services.
      </p>

      <Section title="Overview of Services">
        <p>
          Archive Cloud provides a platform that allows users to connect, manage,
          and operate across multiple cloud storage accounts (including Google
          Drive, Google Photos, Shared Drive, OneDrive, Dropbox, pCloud, and
          iCloud).
        </p>
        <p>
          Our Services enable actions such as uploading, browsing, transferring,
          renaming, moving, deleting files, organizing virtual folders, sharing,
          and tracking storage quota across connected accounts.
        </p>
        <p>
          We do not provide cloud storage ourselves. Instead, we act as a secure
          interface between you and your chosen third-party storage providers.
        </p>
      </Section>

      <Section title="Eligibility">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You must be at least 18 years old or have legal parental/guardian
            consent to use our Services.
          </li>
          <li>
            You must provide accurate and complete registration information.
          </li>
          <li>
            You are responsible for maintaining the confidentiality of your
            account credentials.
          </li>
        </ul>
      </Section>

      <Section title="User Responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the Services only for lawful purposes.</li>
          <li>
            Not use the Services to upload, share, or manage files that violate
            laws, regulations, or the rights of others.
          </li>
          <li>
            Not attempt to interfere with or disrupt our systems, security
            measures, or networks.
          </li>
          <li>
            Not reverse-engineer, decompile, or copy our Services.
          </li>
          <li>
            You are solely responsible for the files you manage through our
            platform.
          </li>
        </ul>
      </Section>

      <Section title="Third-Party Services">
        <p>
          Archive Cloud integrates with third-party services, including Google
          Drive, Google Photos, Shared Drive, OneDrive, Dropbox, pCloud, and
          iCloud.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You must comply with the terms and policies of these providers in
            addition to our Terms.
          </li>
          <li>
            When you connect your account, you authorize Archive Cloud to access
            your account data as permitted by the selected provider&apos;s OAuth
            scopes or credentials.
          </li>
          <li>
            We do not own, control, or manage the terms, policies, or
            availability of these third-party services.
          </li>
          <li>
            You acknowledge that if these providers restrict or suspend their
            APIs, our Services may be impacted.
          </li>
        </ul>
      </Section>

      <Section title="Privacy and Data Use">
        <p>
          Your privacy is important to us. Please review our{" "}
          <Link
            href="/privacy-policy"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          , which explains how we collect, use, and protect your data.
        </p>
        <p>
          By using Archive Cloud, you consent to the processing of your
          information as described in the Privacy Policy.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We take security seriously and implement industry-standard protections
          such as OAuth authentication, encrypted storage of provider tokens,
          and HTTPS encryption.
        </p>
        <p>
          However, no system is completely secure. You are responsible for
          safeguarding your login information and immediately notifying us of
          any unauthorized access.
        </p>
      </Section>

      <Section title="Account Termination">
        <p>We may suspend or terminate your account if:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You violate these Terms.</li>
          <li>
            You misuse the Services in ways that cause harm to us, other users,
            or third parties.
          </li>
          <li>
            We are required to do so by law or due to third-party service
            provider restrictions.
          </li>
        </ul>
        <p>
          You may delete your account at any time. Upon deletion, connected
          provider access will be revoked where applicable, and associated
          account data will be removed in accordance with our Privacy Policy.
        </p>
      </Section>

      <Section title="Service Availability">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            We aim to provide continuous access to our Services, but
            availability is not guaranteed.
          </li>
          <li>
            We may suspend or limit access for maintenance, updates, or
            unforeseen disruptions.
          </li>
          <li>
            We are not responsible for downtime caused by third-party providers
            (including Google, Microsoft, Dropbox, pCloud, and
            Apple/iCloud).
          </li>
        </ul>
      </Section>

      <Section title="Intellectual Property">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Archive Cloud and its logo, design, and software are our intellectual
            property.
          </li>
          <li>
            You may not copy, modify, distribute, or resell any part of our
            Services without written permission.
          </li>
          <li>
            You retain ownership of your files; we claim no rights over your
            content.
          </li>
        </ul>
      </Section>

      <Section title="Disclaimer of Warranties">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Our Services are provided on an &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; basis.
          </li>
          <li>
            We do not warrant that the Services will be error-free,
            uninterrupted, or completely secure.
          </li>
          <li>
            We disclaim all warranties, express or implied, including
            merchantability, fitness for a particular purpose, and
            non-infringement.
          </li>
        </ul>
      </Section>

      <Section title="Limitation of Liability">
        <p>To the maximum extent permitted by law:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Archive Cloud shall not be liable for any indirect, incidental,
            special, or consequential damages arising from your use of the
            Services.
          </li>
          <li>
            Our total liability for any claim shall not exceed the amount you
            paid (if any) for using the Services in the 12 months preceding the
            claim.
          </li>
        </ul>
      </Section>

      <Section title="Indemnification">
        <p>
          You agree to indemnify and hold harmless Archive Cloud, its affiliates,
          employees, and partners from any claims, damages, or liabilities
          arising from your use of the Services, violation of these Terms, or
          infringement of third-party rights.
        </p>
      </Section>

      <Section title="Changes to Terms">
        <ul className="list-disc space-y-2 pl-5">
          <li>We may update these Terms at any time.</li>
          <li>
            Significant changes will be communicated on our homepage or via
            email.
          </li>
          <li>
            Continued use of the Services after changes means you accept the
            updated Terms.
          </li>
        </ul>
      </Section>

      <Section title="Governing Law">
        <p>
          These Terms are governed by and construed under the laws of your
          country of residence, unless otherwise required by law.
        </p>
        <p>
          Any disputes will be subject to the jurisdiction of competent courts.
        </p>
      </Section>

      <Section title="Contact Us">
        <p>
          For questions or concerns regarding these Terms, please contact us at:
        </p>
        <p>
          Email:{" "}
          <a
            href="mailto:contact@archivecloud.com"
            className="text-foreground underline underline-offset-4"
          >
            contact@archivecloud.com
          </a>
        </p>
      </Section>
    </article>
  );
}
