"use client";

import {
  Archive,
  ArrowDownToLine,
  ArrowRotateLeft,
  ArrowUpRightFromSquare,
  FileText,
  Flag,
  LayoutColumns,
  Link as LinkIcon,
  Lock,
  Picture,
  Play,
  QrCode,
  Thunderbolt,
} from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { DummyModal } from "@/components/drive/DummyModal";
import {
  QrCodeWithLogo,
  qrCodeImageUrl,
} from "@/components/drive/QrCodeWithLogo";
import { ReportAbuseModal } from "@/components/drive/ReportAbuseModal";
import { ShareBrandLogo } from "@/components/drive/ShareBrandLogo";
import { API_URL, apiFetch, formatBytes } from "@/lib/api";
import { getBrandLogoSrc } from "@/lib/brand-icons";
import { setDocumentTitle } from "@/lib/document-title";
import { createPlyr, ensurePlyr } from "@/lib/plyr";
import {
  getPreviewKind,
  isSpreadsheetMimeType,
  officeViewerUrl,
} from "@/lib/preview";
import { providerLabel } from "@/lib/providers";

type PublicFile = {
  name: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
  provider?: string;
  sharedBy?: {
    name: string;
    image: string | null;
  };
};

function typeBadgeLabel(
  kind: ReturnType<typeof getPreviewKind>,
  mimeType: string,
) {
  if (kind === "image") return "IMAGE";
  if (kind === "video") return "VIDEO";
  if (mimeType === "application/pdf" || kind === "document") return "PDF";
  if (kind === "office" || isSpreadsheetMimeType(mimeType)) return "DOCUMENT";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

function fileGlyph(
  kind: ReturnType<typeof getPreviewKind>,
  mimeType: string,
  className = "h-10 w-10",
) {
  if (kind === "image") return <Picture className={className} />;
  if (kind === "video") return <Play className={className} />;
  if (isSpreadsheetMimeType(mimeType))
    return <LayoutColumns className={className} />;
  if (kind === "document" || kind === "office")
    return <FileText className={className} />;
  return <Archive className={className} />;
}

function UnsupportedPreview({
  file,
  downloadUrl,
}: {
  file: PublicFile;
  downloadUrl: string;
}) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 text-center text-muted">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-foreground shadow-2xl shadow-black/30">
        <Archive className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-xl font-bold text-accent-foreground">
        Preview not available
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        {file.name} cannot be previewed in browser. Download file to open it
        locally.
      </p>
      <a href={downloadUrl} download className="mt-6">
        <Button>
          <ArrowDownToLine className="h-4 w-4" />
          Download
        </Button>
      </a>
    </div>
  );
}

function StatusScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6 text-foreground">
      <div className="max-w-md rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
        <Archive className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export function PublicFilePage({
  token,
  embed = false,
}: {
  token: string;
  embed?: boolean;
}) {
  const [file, setFile] = useState<PublicFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState(`${API_URL}/public/files/${token}`);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrl = `${API_URL}/public/files/${token}/preview`;
  const downloadUrl = `${API_URL}/public/files/${token}/download`;
  const kind = getPreviewKind(file?.mimeType, file?.name);

  const qrImageUrl = useMemo(
    () => qrCodeImageUrl(shareUrl),
    [shareUrl],
  );

  useEffect(() => {
    setShareUrl(
      `${window.location.origin}/public/files/${token}`,
    );
  }, [token]);

  useEffect(() => {
    setFailed(false);
    setUnavailable(false);
    apiFetch<{ file: PublicFile }>(`/api/public/files/${token}`, {
      skipAuth: true,
    })
      .then((data) => setFile(data.file))
      .catch((error) => {
        setFile(null);
        const message =
          error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("unavailable") || message.includes("disabled")) {
          setUnavailable(true);
        } else {
          setFailed(true);
        }
      });
  }, [token]);

  useEffect(() => {
    setDocumentTitle(embed ? "Embed" : file ? file.name : "Shared file");
  }, [embed, file]);

  useEffect(() => {
    if (kind !== "video" || !videoRef.current || (!embed && !viewing)) {
      return undefined;
    }
    let disposed = false;
    let player: { destroy: () => void } | null = null;

    ensurePlyr()
      .then(() => {
        if (disposed || !videoRef.current) return;
        player = createPlyr(videoRef.current);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      player?.destroy();
    };
  }, [kind, previewUrl, embed, viewing]);

  if (unavailable) {
    return (
      <StatusScreen
        title="File unavailable"
        message="This public link is currently deactivated by the owner."
      />
    );
  }

  if (failed) {
    return (
      <StatusScreen
        title="Shared file not found"
        message="Link may be expired, disabled, or deleted."
      />
    );
  }

  if (!file) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
        Loading shared file...
      </main>
    );
  }

  const preview = (
    <div className="flex h-full w-full items-center justify-center">
      {kind === "image" ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-full max-w-full object-contain shadow-2xl shadow-black/30"
        />
      ) : null}
      {kind === "video" ? (
        <div className="shared-video-shell">
          <video ref={videoRef} controls playsInline preload="metadata">
            <track kind="captions" />
            <source src={previewUrl} type={file.mimeType} />
          </video>
        </div>
      ) : null}
      {kind === "document" ? (
        <iframe
          src={previewUrl}
          title={file.name}
          className="h-full w-full border-0 bg-white"
        />
      ) : null}
      {kind === "office" ? (
        <iframe
          src={officeViewerUrl(previewUrl)}
          title={file.name}
          className="h-full w-full border-0 bg-white"
        />
      ) : null}
      {!kind ? (
        <UnsupportedPreview file={file} downloadUrl={downloadUrl} />
      ) : null}
    </div>
  );

  if (embed) {
    return (
      <main className="h-screen overflow-hidden bg-black text-accent-foreground">
        {preview}
      </main>
    );
  }

  if (viewing) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#101218] text-accent-foreground">
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#17191f]/95 px-4 shadow-lg shadow-black/20 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setViewing(false)}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-accent-foreground hover:bg-white/15"
            >
              Back
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-foreground">
              {fileGlyph(kind, file.mimeType, "h-5 w-5")}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-accent-foreground sm:text-base">
                {file.name}
              </h1>
              <p className="truncate text-xs text-muted">
                {formatBytes(file.sizeBytes)}
              </p>
            </div>
          </div>
          <a href={downloadUrl} download>
            <Button
              variant="outline"
              className="border-white/10 bg-white/10 text-accent-foreground hover:bg-white/15"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download
            </Button>
          </a>
        </header>
        <section className="flex h-screen items-center justify-center px-3 pb-6 pt-20 sm:px-6">
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12] shadow-2xl shadow-black/40">
            {preview}
          </div>
        </section>
      </main>
    );
  }

  const sharedByName = file.sharedBy?.name || "Archive Cloud user";
  const sharedByInitial = sharedByName.charAt(0).toUpperCase() || "A";
  const providerName = providerLabel(file.provider).toUpperCase();
  const providerLogo = getBrandLogoSrc(file.provider ?? "");
  const typeLabel = typeBadgeLabel(kind, file.mimeType);

  return (
    <main className="min-h-screen bg-muted text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-4 sm:px-5">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-7 w-7" />
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              Archive Cloud
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-destructive hover:opacity-80"
          >
            <Flag className="h-3.5 w-3.5" />
            Report Abuse
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-6 sm:px-5 sm:py-8">
        <div className="mx-auto grid w-full max-w-4xl gap-4 lg:grid-cols-2 lg:gap-4">
          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {fileGlyph(kind, file.mimeType, "h-6 w-6")}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary">
              {typeLabel}
            </span>
            {file.provider ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground">
                {providerLogo ? (
                  <img
                    src={providerLogo}
                    alt=""
                    className="h-3 w-3 object-contain"
                  />
                ) : null}
                {providerName}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 break-all text-base font-bold tracking-tight text-foreground sm:text-lg">
            {file.name}
          </h1>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {formatBytes(file.sizeBytes)}
          </p>

          <div className="my-3.5 border-t border-border" />

          <div className="flex items-center gap-2.5">
            {file.sharedBy?.image ? (
              <img
                src={file.sharedBy.image}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {sharedByInitial}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Shared by{" "}
              <span className="font-bold text-foreground">{sharedByName}</span>
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/15"
            >
              <ArrowUpRightFromSquare className="h-3.5 w-3.5" />
              Open File
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/15"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR Code
            </button>
          </div>

          <p className="mt-5 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Share with friends
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(shareUrl)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border bg-background text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              <ShareBrandLogo name="whatsapp" className="h-5 w-5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(file.name)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border bg-background text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              <ShareBrandLogo name="telegram" className="h-4 w-4" />
              Telegram
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = `mailto:?subject=${encodeURIComponent(`Shared file: ${file.name}`)}&body=${encodeURIComponent(shareUrl)}`;
              }}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border bg-background text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              <ShareBrandLogo name="email" className="h-4 w-4" />
              Email
            </button>
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-7 w-7" />
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              Archive Cloud
            </span>
          </div>

          <h2 className="mt-4 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
            All your clouds. One hub.
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            Connect Drive, Dropbox, OneDrive, and more in one place.
          </p>

          <ul className="mt-4 grid gap-2.5">
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ArrowRotateLeft className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground sm:text-[13px]">
                  Unified management
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Search and organize files across every cloud.
                </p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Thunderbolt className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground sm:text-[13px]">
                  Fast streaming
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Preview files without using download quota.
                </p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LinkIcon className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground sm:text-[13px]">
                  Cross-cloud moves
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Transfer between providers with no local bandwidth.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-5 grid gap-2">
            <Link
              href="/auth/sign-up"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 sm:text-sm"
            >
              Create Free Account
            </Link>
            <Link
              href="/auth/sign-in"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-primary/30 bg-background px-3 text-xs font-semibold text-primary transition hover:bg-primary/5 sm:text-sm"
            >
              Log In
            </Link>
          </div>

          <div className="mt-auto pt-5">
            <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              This file is securely shared via Archive Cloud.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-muted-foreground">
              <Link href="/privacy-policy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <span aria-hidden>·</span>
              <Link href="/terms-of-service" className="hover:text-foreground">
                Terms of Service
              </Link>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="cursor-pointer text-destructive underline underline-offset-2 hover:opacity-80"
              >
                Report Abuse
              </button>
            </div>
          </div>
        </section>
        </div>
      </div>

      <DummyModal
        open={qrOpen}
        title="QR Code - Share File"
        onClose={() => setQrOpen(false)}
        size="sm"
        headerClassName="px-4 pb-2 pt-4"
        bodyClassName="px-4 pb-4 pt-0"
      >
        <div className="grid w-full justify-items-stretch gap-2 text-center">
          <div className="justify-self-center">
            <QrCodeWithLogo
              src={qrImageUrl}
              alt={`QR code for ${file.name}`}
              sizeClassName="h-48 w-48"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Scan with mobile camera to access{" "}
            <span className="font-extrabold text-foreground">{file.name}</span>
          </p>
          <Button
            size="sm"
            className="w-full shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
            onPress={() => setQrOpen(false)}
          >
            Close
          </Button>
        </div>
      </DummyModal>

      <ReportAbuseModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        shareUrl={shareUrl}
        fileName={file.name}
      />
    </main>
  );
}
