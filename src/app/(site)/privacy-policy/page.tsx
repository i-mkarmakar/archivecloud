import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata("Privacy Policy");

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

function SubSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <div className="mt-2 space-y-3 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <article className="relative z-10 mx-auto max-w-2xl bg-background px-6 pb-24">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        At Archive Cloud, we respect your privacy and are committed to
        protecting your personal information. This Privacy Policy explains what
        information we collect, how we use it, and your rights when using our
        platform.
      </p>

      <Section title="Information We Collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-foreground">
              Account Information:
            </span>{" "}
            Your name and email address when you sign up or log in (including
            via Google or other providers).
          </li>
          <li>
            <span className="font-medium text-foreground">
              Authentication Data:
            </span>{" "}
            Secure OAuth tokens and encrypted credentials used to connect
            third-party services such as Google Drive, Google Photos, Shared
            Drive, OneDrive, Dropbox, pCloud, and iCloud.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Usage Information:
            </span>{" "}
            Metadata about your connected accounts (e.g., file/folder names,
            modification timestamps, sizes, and storage provider type) needed to
            show your dashboard, search, quota, and transfer status.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Profile Information:
            </span>{" "}
            Details you choose to update in your user profile.
          </li>
        </ul>
        <p>
          We do not keep a long-term copy of your file contents on Archive Cloud
          servers. Uploads and transfers stream through our backend to your
          connected providers&apos; APIs.
        </p>
      </Section>

      <Section title="How We Use Your Information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Authenticate and log you into Archive Cloud.</li>
          <li>
            Allow you to connect, manage, browse, transfer, sync, and disconnect
            cloud accounts.
          </li>
          <li>
            Enable file operations such as upload, create folder, rename, move,
            delete, preview, download, and share.
          </li>
          <li>Maintain and improve our services.</li>
          <li>Provide customer support and communicate important updates.</li>
        </ul>
        <p>
          We do not sell, rent, or share your information with third parties for
          advertising or marketing.
        </p>
      </Section>

      <Section title="Third-Party Services">
        <SubSection title="Google Services">
          <p>
            When you connect Google Drive or Shared Drive, Archive Cloud
            requests the following OAuth scopes:
          </p>
          <ul className="list-disc space-y-2 pl-5 break-all">
            <li>
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/userinfo.profile
              </code>{" "}
              : Access your basic profile information (name).
            </li>
            <li>
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/userinfo.email
              </code>{" "}
              : Access your email address to identify your account.
            </li>
            <li>
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/drive
              </code>{" "}
              : Allow file management actions (create, view, rename, move, and
              delete files/folders in your Google Drive or Shared Drive).
            </li>
          </ul>
          <p>When you connect Google Photos, Archive Cloud requests:</p>
          <ul className="list-disc space-y-2 pl-5 break-all">
            <li>
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/photoslibrary
              </code>{" "}
              : Access and manage media in your Google Photos library as needed
              for browse, upload, and related features.
            </li>
            <li>
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/photoslibrary.sharing
              </code>{" "}
              : Manage sharing for Google Photos content as needed by the
              product.
            </li>
            <li>
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/userinfo.email
              </code>{" "}
              and{" "}
              <code className="text-sm text-foreground">
                https://www.googleapis.com/auth/userinfo.profile
              </code>{" "}
              : Identify your Google account.
            </li>
          </ul>
          <p>
            We use these permissions only to provide the described
            functionality. We do not use your Google data for any other purpose.
            If you disconnect your Google account or delete your Archive Cloud
            account, related Google access tokens are permanently revoked.
          </p>
          <p>
            You can review Google&apos;s privacy policy at{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-4 hover:underline"
            >
              https://policies.google.com/privacy
            </a>
            .
          </p>
        </SubSection>

        <SubSection title="Dropbox Services">
          <p>
            When you connect Dropbox, Archive Cloud requests OAuth permissions
            limited to managing your Dropbox files and folders, including
            account info, file metadata, and file content read/write access
            needed for browse, upload, transfer, and related operations.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Authenticate your Dropbox account securely using OAuth 2.0.</li>
            <li>
              Perform file operations such as upload, create folders, rename,
              move, and delete within your Dropbox storage.
            </li>
            <li>
              Access file metadata (e.g., file names, folder names, and
              timestamps) to display your storage contents in the dashboard.
            </li>
          </ul>
          <p>
            We do not store your Dropbox files on our servers long-term. All
            operations are executed with Dropbox&apos;s official API. If you
            disconnect Dropbox or delete your Archive Cloud account, Dropbox
            OAuth tokens are revoked.
          </p>
          <p>
            Dropbox Privacy Policy:{" "}
            <a
              href="https://www.dropbox.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-4 hover:underline"
            >
              https://www.dropbox.com/privacy
            </a>
          </p>
        </SubSection>

        <SubSection title="Microsoft OneDrive Services">
          <p>
            When you connect OneDrive, Archive Cloud requests OAuth permissions
            limited to working with your OneDrive account (including{" "}
            <code className="text-sm text-foreground">User.Read</code>,{" "}
            <code className="text-sm text-foreground">Files.ReadWrite.All</code>
            , and{" "}
            <code className="text-sm text-foreground">offline_access</code>).
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Authenticate your Microsoft account securely using OAuth 2.0.
            </li>
            <li>
              Allow file management actions such as upload, folder creation,
              renaming, moving, and deleting files within OneDrive.
            </li>
            <li>
              Read file metadata (names, sizes, modification dates) so that your
              dashboard view stays in sync with your OneDrive storage.
            </li>
            <li>
              Optionally create and manage shareable links so you can
              collaborate on files stored in OneDrive from Archive Cloud.
            </li>
          </ul>
          <p>
            We never keep a long-term copy of your OneDrive files. Tokens are
            revoked when you disconnect OneDrive or delete your Archive Cloud
            account.
          </p>
          <p>
            Microsoft Privacy Statement:{" "}
            <a
              href="https://privacy.microsoft.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-4 hover:underline"
            >
              https://privacy.microsoft.com/
            </a>
          </p>
        </SubSection>

        <SubSection title="Other connected providers">
          <p>
            Archive Cloud may also let you connect pCloud and iCloud. For those
            providers we store only the credentials or tokens needed to operate
            the integration (encrypted at rest where applicable) and metadata
            required to show your files in the product. Disconnecting a provider
            or deleting your Archive Cloud account removes that linked access
            data.
          </p>
        </SubSection>
      </Section>

      <Section title="Security">
        <ul className="list-disc space-y-2 pl-5">
          <li>Secure authentication via OAuth 2.0 where supported.</li>
          <li>Encrypted transmission of data using HTTPS.</li>
          <li>
            Provider tokens encrypted at rest, with strict access controls so
            secrets are not exposed in logs.
          </li>
        </ul>
        <p>
          Although no system is 100% secure, we continually monitor and update
          our security practices. See also our{" "}
          <Link
            href="/security"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Security
          </Link>{" "}
          page.
        </p>
      </Section>

      <Section title="Data Retention and Deletion">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            We retain your account information only while your account remains
            active.
          </li>
          <li>
            You may delete your account at any time, which will permanently
            remove your profile and revoke linked OAuth tokens where applicable.
          </li>
          <li>
            We do not retain your file contents after stream-through operations
            are completed.
          </li>
        </ul>
        <p>
          If you want to delete your data without logging into your account, you
          can send a request email to{" "}
          <a
            href="mailto:contact@archivecloud.com"
            className="text-foreground underline underline-offset-4"
          >
            contact@archivecloud.com
          </a>{" "}
          from the email you used to create your Archive Cloud account.
        </p>
      </Section>

      <Section title="Your Rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>Access and review the information we hold about you.</li>
          <li>Revoke permissions for connected accounts at any time.</li>
          <li>
            Request deletion of your Archive Cloud account and all related data.
          </li>
          <li>Contact us with questions or concerns regarding your data.</li>
        </ul>
      </Section>

      <Section title="Changes to This Policy">
        <p>
          We may update this Privacy Policy periodically. Any significant
          updates will be posted on our homepage.
        </p>
        <p>
          By continuing to use Archive Cloud after changes, you agree to the
          updated policy. Related product rules are also described in our{" "}
          <Link
            href="/terms-of-service"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </Section>

      <Section title="Contact Us">
        <p>
          If you have any questions, requests, or concerns about this Privacy
          Policy, please contact us at:
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
