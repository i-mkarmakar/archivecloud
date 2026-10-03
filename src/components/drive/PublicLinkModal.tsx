"use client";

import {
  ArrowUpRightFromSquare,
  Copy,
  FileText,
  Globe,
  Link,
  QrCode,
  Xmark,
} from "@gravity-ui/icons";
import { Button, Switch, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import { ActionTooltip } from "@/components/drive/ActionTooltip";
import {
  DummyModal,
  modalActionButtonClassName,
  modalActionsClassName,
} from "@/components/drive/DummyModal";
import {
  QrCodeWithLogo,
  qrCodeImageUrl,
} from "@/components/drive/QrCodeWithLogo";
import { ShareBrandLogo } from "@/components/drive/ShareBrandLogo";
import { apiFetch } from "@/lib/api";

type ShareStatus = "none" | "active" | "disabled";

type ShareState = {
  status: ShareStatus;
  url: string | null;
  enabled: boolean;
  showOwnerProfile: boolean;
  needsRegenerate?: boolean;
};

type Props = {
  open: boolean;
  fileId: string | null;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: string | number | null;
  onClose: () => void;
};

export function PublicLinkModal({
  open,
  fileId,
  fileName,
  mimeType,
  sizeBytes,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showOwnerProfile, setShowOwnerProfile] = useState(true);
  const [share, setShare] = useState<ShareState>({
    status: "none",
    url: null,
    enabled: false,
    showOwnerProfile: true,
  });
  const [qrOpen, setQrOpen] = useState(false);

  function sharePath(id: string) {
    const qs = new URLSearchParams();
    if (fileName) qs.set("name", fileName);
    if (mimeType) qs.set("mimeType", mimeType);
    if (sizeBytes != null && sizeBytes !== "") {
      qs.set("sizeBytes", String(sizeBytes));
    }
    const query = qs.toString();
    return `/files/${encodeURIComponent(id)}/share${query ? `?${query}` : ""}`;
  }

  function shareBody(extra: Record<string, unknown> = {}) {
    return JSON.stringify({
      ...extra,
      name: fileName || undefined,
      mimeType: mimeType || undefined,
      sizeBytes: sizeBytes ?? undefined,
    });
  }

  useEffect(() => {
    if (!open || !fileId) {
      setShare({
        status: "none",
        url: null,
        enabled: false,
        showOwnerProfile: true,
      });
      setConfirming(false);
      setConsentChecked(false);
      setShowOwnerProfile(true);
      setQrOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setConfirming(false);
    setConsentChecked(false);
    void (async () => {
      try {
        const data = await apiFetch<{
          status: ShareStatus;
          url: string | null;
          enabled: boolean;
          showOwnerProfile?: boolean;
          needsRegenerate?: boolean;
        }>(sharePath(fileId));
        if (cancelled) return;
        const ownerVisible = data.showOwnerProfile ?? true;
        setShare({
          status: data.status,
          url: data.url,
          enabled: data.enabled,
          showOwnerProfile: ownerVisible,
          needsRegenerate: data.needsRegenerate,
        });
        setShowOwnerProfile(ownerVisible);
      } catch (error) {
        if (!cancelled) {
          toast.danger(
            error instanceof Error
              ? error.message
              : "Failed to load public link",
          );
          setShare({
            status: "none",
            url: null,
            enabled: false,
            showOwnerProfile: true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fileId, fileName, mimeType, sizeBytes]);

  async function generateLink(rotate = false) {
    if (!fileId || !consentChecked) return;
    setGenerating(true);
    try {
      const data = await apiFetch<{
        url: string;
        status: ShareStatus;
        enabled: boolean;
        showOwnerProfile?: boolean;
      }>(sharePath(fileId), {
        method: "POST",
        body: shareBody({
          ...(rotate ? { rotate: true } : {}),
          consent: true,
          showOwnerProfile,
        }),
      });
      setShare({
        status: data.status ?? "active",
        url: data.url,
        enabled: data.enabled ?? true,
        showOwnerProfile: data.showOwnerProfile ?? showOwnerProfile,
        needsRegenerate: false,
      });
      setConfirming(false);
      setConsentChecked(false);
      toast.success("Public link created.");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to generate public link",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!fileId) return;
    setToggling(true);
    try {
      const data = await apiFetch<{
        status: ShareStatus;
        url: string | null;
        enabled: boolean;
        showOwnerProfile?: boolean;
      }>(sharePath(fileId), {
        method: "PATCH",
        body: shareBody({ enabled }),
      });
      setShare({
        status: data.status,
        url: data.url,
        enabled: data.enabled,
        showOwnerProfile: data.showOwnerProfile ?? share.showOwnerProfile,
        needsRegenerate: !data.url,
      });
      if (enabled) toast.success("Public link reactivated!");
      else toast.success("Public link deactivated.");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to update public link",
      );
    } finally {
      setToggling(false);
    }
  }

  async function setOwnerProfileVisible(next: boolean) {
    if (!fileId) return;
    setToggling(true);
    try {
      const data = await apiFetch<{
        status: ShareStatus;
        url: string | null;
        enabled: boolean;
        showOwnerProfile?: boolean;
      }>(sharePath(fileId), {
        method: "PATCH",
        body: shareBody({ showOwnerProfile: next }),
      });
      setShare((prev) => ({
        ...prev,
        status: data.status,
        url: data.url,
        enabled: data.enabled,
        showOwnerProfile: data.showOwnerProfile ?? next,
      }));
      setShowOwnerProfile(data.showOwnerProfile ?? next);
      toast.success(
        next
          ? "Your name and avatar will show on the public page."
          : "Your name and avatar are hidden on the public page.",
      );
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to update profile visibility",
      );
    } finally {
      setToggling(false);
    }
  }

  async function copyLink() {
    if (!share.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.danger("Failed to copy link.");
    }
  }

  function openLink() {
    if (!share.url) return;
    window.open(share.url, "_blank", "noopener,noreferrer");
  }

  function shareWhatsApp() {
    if (!share.url) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(share.url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function shareTelegram() {
    if (!share.url) return;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(fileName)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function shareEmail() {
    if (!share.url) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Shared file: ${fileName}`)}&body=${encodeURIComponent(share.url)}`;
  }

  const showEmpty =
    !loading &&
    !confirming &&
    (share.status === "none" ||
      (share.needsRegenerate && share.status !== "disabled"));
  const showConfirm = !loading && confirming;
  const showActive =
    !loading && !confirming && share.status === "active" && Boolean(share.url);
  const showDisabled = !loading && !confirming && share.status === "disabled";

  const qrImageUrl = share.url ? qrCodeImageUrl(share.url) : "";

  return (
    <>
      <DummyModal open={open} title="Public Link" onClose={onClose} size="md">
        <div className="grid gap-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <p className="min-w-0 truncate text-sm text-foreground">
              Sharing:{" "}
              <span className="font-extrabold">{fileName || "Untitled"}</span>
            </p>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted">
              Loading public link…
            </p>
          ) : null}

          {showEmpty ? (
            <div className="grid justify-items-center gap-4 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Globe className="h-8 w-8" />
              </div>
              <div className="grid gap-1.5">
                <p className="text-base font-extrabold text-foreground">
                  No Public Link Created Yet
                </p>
                <p className="mx-auto max-w-sm text-sm text-muted">
                  Generating a public link allows anyone with the URL to view
                  and download this file directly.
                </p>
              </div>
              <Button
                isDisabled={generating}
                onPress={() => {
                  setConsentChecked(false);
                  setShowOwnerProfile(true);
                  setConfirming(true);
                }}
              >
                <Link className="h-4 w-4" />
                Generate Public Link
              </Button>
            </div>
          ) : null}

          {showConfirm ? (
            <div className="grid gap-4 rounded-2xl border border-border bg-muted/30 px-4 py-5">
              <div className="grid gap-1.5">
                <p className="text-base font-extrabold text-foreground">
                  Make this file public?
                </p>
                <p className="text-sm text-muted">
                  Anyone with the link can preview and download this file. You
                  can deactivate the link later.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                />
                <span>
                  I understand this creates a public link and consent to sharing
                  this file outside my account.
                </span>
              </label>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Show my name and avatar
                  </p>
                  <p className="text-xs text-muted">
                    Optional on the public page
                  </p>
                </div>
                <Switch
                  isSelected={showOwnerProfile}
                  onChange={setShowOwnerProfile}
                  size="md"
                  aria-label="Show my name and avatar on public page"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  isDisabled={generating}
                  onPress={() => {
                    setConfirming(false);
                    setConsentChecked(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  isDisabled={!consentChecked || generating}
                  onPress={() =>
                    void generateLink(
                      share.status !== "none" || Boolean(share.needsRegenerate),
                    )
                  }
                >
                  <Link className="h-4 w-4" />
                  {generating ? "Creating…" : "Create public link"}
                </Button>
              </div>
            </div>
          ) : null}

          {showDisabled ? (
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-foreground">
                    Link Status
                  </p>
                  <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-danger">
                    DEACTIVATED
                  </span>
                </div>
                <Switch
                  isSelected={false}
                  isDisabled={toggling}
                  onChange={(value) => void setEnabled(value)}
                  size="md"
                  aria-label="Toggle public link"
                  className="text-danger"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                This public link is currently deactivated. Visitors with the
                link will see a &apos;file unavailable&apos; message. Click the
                toggle button to reactivate it.
              </div>
              {share.needsRegenerate || !share.url ? (
                <Button
                  variant="outline"
                  isDisabled={generating}
                  onPress={() => {
                    setConsentChecked(false);
                    setShowOwnerProfile(share.showOwnerProfile);
                    setConfirming(true);
                  }}
                >
                  <Link className="h-4 w-4" />
                  Regenerate Public Link
                </Button>
              ) : null}
            </div>
          ) : null}

          {showActive ? (
            <div className="grid gap-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-foreground">
                    Link Status
                  </p>
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-success">
                    ACTIVE
                  </span>
                </div>
                <Switch
                  isSelected
                  isDisabled={toggling}
                  onChange={(value) => void setEnabled(value)}
                  size="md"
                  aria-label="Toggle public link"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Show my name and avatar
                  </p>
                  <p className="text-xs text-muted">
                    Visitors see who shared this file
                  </p>
                </div>
                <Switch
                  isSelected={share.showOwnerProfile}
                  isDisabled={toggling}
                  onChange={(value) => void setOwnerProfileVisible(value)}
                  size="md"
                  aria-label="Show my name and avatar on public page"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>

              <div className="grid gap-2">
                <p className="text-[11px] font-bold tracking-wide text-muted uppercase">
                  Public Link URL
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-white px-3">
                    <Link className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      readOnly
                      value={share.url ?? ""}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                  </div>
                  <ActionTooltip label="Copy link">
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-white text-primary hover:bg-primary/5"
                      aria-label="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                  <ActionTooltip label="Open in new tab">
                    <button
                      type="button"
                      onClick={openLink}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-white text-foreground hover:bg-black/5"
                      aria-label="Open link"
                    >
                      <ArrowUpRightFromSquare className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                  <ActionTooltip label="Show QR code">
                    <button
                      type="button"
                      onClick={() => setQrOpen(true)}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-white text-foreground hover:bg-black/5"
                      aria-label="QR code"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                </div>
              </div>

              <div className="relative rounded-2xl border border-border px-4 pt-5 pb-4">
                <p className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[11px] font-bold tracking-wide text-muted uppercase">
                  Share with friends
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={shareWhatsApp}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <ShareBrandLogo name="whatsapp" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={shareTelegram}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <ShareBrandLogo name="telegram" className="h-4 w-4" />
                    Telegram
                  </button>
                  <button
                    type="button"
                    onClick={shareEmail}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <ShareBrandLogo name="email" className="h-4 w-4" />
                    Email
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={modalActionsClassName}>
            <Button
              variant="outline"
              className={modalActionButtonClassName}
              onPress={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DummyModal>

      <DummyModal
        open={qrOpen}
        title="QR Code - Share File"
        onClose={() => setQrOpen(false)}
        size="sm"
        headerClassName="px-4 pb-2 pt-4"
        bodyClassName="px-4 pb-4 pt-0"
      >
        <div className="grid w-full justify-items-stretch gap-2 text-center">
          {qrImageUrl ? (
            <div className="justify-self-center">
              <QrCodeWithLogo
                src={qrImageUrl}
                alt={`QR code for ${fileName}`}
                sizeClassName="h-48 w-48"
              />
            </div>
          ) : null}
          <p className="text-xs text-muted sm:text-sm">
            Scan with mobile camera to access{" "}
            <span className="font-extrabold text-foreground">
              {fileName || "this file"}
            </span>
          </p>
          <Button
            size="sm"
            className="w-full shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
            onPress={() => setQrOpen(false)}
          >
            <Xmark className="h-4 w-4" />
            Close
          </Button>
        </div>
      </DummyModal>
    </>
  );
}
