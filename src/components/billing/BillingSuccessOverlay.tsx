"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { applyUserPlan } from "@/hooks/useUserPlan";
import { normalizePlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const CONFETTI_COLORS = [
  "#1e9df1",
  "#60a5fa",
  "#22c55e",
  "#4ade80",
  "#fbbf24",
  "#f472b6",
];

let lastConfettiAt = 0;

function firePaymentConfetti() {
  // Dev Strict Mode remounts effects; skip a second burst within 2s.
  const now = Date.now();
  if (now - lastConfettiAt < 2000) return;
  lastConfettiAt = now;

  const base = { colors: CONFETTI_COLORS, zIndex: 90 };

  void confetti({
    ...base,
    particleCount: 110,
    spread: 75,
    startVelocity: 38,
    gravity: 0.85,
    origin: { x: 0.5, y: 0.3 },
  });

  void confetti({
    ...base,
    particleCount: 55,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.65 },
  });

  void confetti({
    ...base,
    particleCount: 55,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.65 },
  });
}

type BillingStatus = {
  planId: string;
  isAdmin?: boolean;
};

type SuccessPhase = "confirming" | "confirmed" | "timed_out";

const POLL_MS = 1500;
const TIMEOUT_MS = 18_000;

async function fetchPlanUnlocked(): Promise<boolean> {
  try {
    const billing = await apiFetch<BillingStatus>("/billing");
    const planId = normalizePlanId(billing.planId);
    const isAdmin = Boolean(billing.isAdmin);
    const unlocked = isAdmin || planId === "thunder";
    if (unlocked) {
      applyUserPlan({
        planId: isAdmin ? "thunder" : planId,
        isAdmin,
        billingEnabled: true,
      });
    }
    return unlocked;
  } catch {
    return false;
  }
}

export function BillingSuccessOverlay() {
  const router = useRouter();
  const pathname = usePathname() ?? "/home";
  const params = useSearchParams();
  const open = params?.get("billing_success") === "1";
  const checkoutId = params?.get("checkout_id");

  const [phase, setPhase] = useState<SuccessPhase>("confirming");
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startedAt = Date.now();
    setPhase("confirming");

    const tick = async () => {
      const active = await fetchPlanUnlocked();
      if (cancelled) return;
      if (active) {
        setPhase("confirmed");
        if (intervalId) clearInterval(intervalId);
        return;
      }
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setPhase("timed_out");
        if (intervalId) clearInterval(intervalId);
      }
    };

    void tick();
    intervalId = setInterval(() => {
      void tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [open, pollKey]);

  function clearOverlayParams() {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.delete("billing_success");
    next.delete("checkout_id");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-success-title"
    >
      {/* Dimmed dashboard backdrop — keep home visible behind */}
      <button
        type="button"
        aria-label="Close payment overlay"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
        onClick={clearOverlayParams}
      />

      <div className="relative z-10 w-full max-w-md">
        {phase === "confirming" ? <ConfirmingCard /> : null}
        {phase === "confirmed" ? (
          <SuccessCard checkoutId={checkoutId} onGoHome={clearOverlayParams} />
        ) : null}
        {phase === "timed_out" ? (
          <TimedOutCard
            checkoutId={checkoutId}
            onRefresh={() => setPollKey((k) => k + 1)}
            onGoHome={clearOverlayParams}
          />
        ) : null}
      </div>
    </div>
  );
}

function cardClassName() {
  return cn(
    "w-full rounded-2xl border border-border bg-background p-8 text-center shadow-2xl",
  );
}

function ConfirmingCard() {
  return (
    <div className={cardClassName()}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
      </div>
      <h1
        id="billing-success-title"
        className="mt-6 text-xl font-semibold tracking-tight text-foreground"
      >
        Confirming your payment…
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Polar is finishing the purchase. This usually takes a few seconds.
      </p>
    </div>
  );
}

const REDIRECT_SECONDS = 8;
const INVOICE_POLL_ATTEMPTS = 12;
const INVOICE_POLL_MS = 1000;

type InvoiceState = {
  invoiceNumber: string | null;
  downloadUrl: string | null;
};

function SuccessCard({
  checkoutId,
  onGoHome,
}: {
  checkoutId: string | null;
  onGoHome: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceState | null>(
    checkoutId ? null : { invoiceNumber: null, downloadUrl: null },
  );
  const [invoiceFailed, setInvoiceFailed] = useState(false);

  const ready = invoice !== null || invoiceFailed;

  useEffect(() => {
    if (!checkoutId) {
      setInvoice({ invoiceNumber: null, downloadUrl: null });
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const loadInvoice = async () => {
      attempts += 1;
      try {
        const data = await apiFetch<{
          invoiceNumber: string | null;
          downloadUrl: string | null;
          pending?: boolean;
        }>(`/billing/invoice?checkout_id=${encodeURIComponent(checkoutId)}`);
        if (cancelled) return;
        // Invoice number is enough to show success — PDF/portal link may follow.
        if (data.invoiceNumber) {
          setInvoice({
            invoiceNumber: data.invoiceNumber,
            downloadUrl: data.downloadUrl ?? "/billing/history",
          });
          return;
        }
      } catch {
        // Order may not be queryable yet right after checkout.
      }
      if (cancelled) return;
      if (attempts < INVOICE_POLL_ATTEMPTS) {
        retryTimer = setTimeout(() => {
          void loadInvoice();
        }, INVOICE_POLL_MS);
        return;
      }
      setInvoiceFailed(true);
    };

    void loadInvoice();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [checkoutId]);

  if (!ready) {
    return <PreparingInvoiceCard />;
  }

  return (
    <SuccessReadyCard
      invoiceNumber={invoice?.invoiceNumber ?? null}
      downloadUrl={invoice?.downloadUrl ?? "/billing/history"}
      onGoHome={onGoHome}
    />
  );
}

function PreparingInvoiceCard() {
  return (
    <div className={cardClassName()}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
      </div>
      <h1
        id="billing-success-title"
        className="mt-6 text-xl font-semibold tracking-tight text-foreground"
      >
        Preparing your invoice…
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Payment is confirmed. Hang tight while we generate your invoice.
      </p>
    </div>
  );
}

function SuccessReadyCard({
  invoiceNumber,
  downloadUrl,
  onGoHome,
}: {
  invoiceNumber: string | null;
  downloadUrl: string | null;
  onGoHome: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [autoRedirect, setAutoRedirect] = useState(true);
  const onGoHomeRef = useRef(onGoHome);
  onGoHomeRef.current = onGoHome;

  useEffect(() => {
    firePaymentConfetti();
  }, []);

  useEffect(() => {
    if (!autoRedirect) return;
    if (secondsLeft <= 0) {
      onGoHomeRef.current();
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoRedirect, secondsLeft]);

  function stopAndGoHome() {
    setAutoRedirect(false);
    onGoHome();
  }

  function handleClose() {
    setAutoRedirect(false);
    onGoHome();
  }

  return (
    <div className={cardClassName()}>
      <div className="flex flex-col items-center">
        <div className="flex size-20 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- animated gif */}
          <img
            src="/tick-mark-animation.gif"
            alt=""
            width={80}
            height={80}
            className="size-20 object-contain"
            aria-hidden
          />
        </div>

        <h1
          id="billing-success-title"
          className="mt-6 text-2xl font-semibold tracking-tight text-foreground"
        >
          Payment succeeded!
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your transaction was completed successfully. Thank you for your
          purchase!
        </p>

        {invoiceNumber ? (
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-foreground">
            <span className="break-all">Invoice No: {invoiceNumber}</span>
            <a
              href={downloadUrl ?? "/billing/history"}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 whitespace-nowrap text-primary underline underline-offset-2"
              onClick={() => setAutoRedirect(false)}
            >
              Download Invoice
            </a>
          </p>
        ) : null}

        <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={stopAndGoHome}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-95"
          >
            Go to dashboard
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Close
          </button>
        </div>

        {autoRedirect ? (
          <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
            Redirecting to dashboard in {secondsLeft}s…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TimedOutCard({
  checkoutId,
  onRefresh,
  onGoHome,
}: {
  checkoutId: string | null;
  onRefresh: () => void;
  onGoHome: () => void;
}) {
  return (
    <div className={cardClassName()}>
      <h1
        id="billing-success-title"
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        Still processing
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This can take a moment. You can refresh, or check your dashboard shortly
        — Thunder unlocks as soon as Polar confirms the payment.
      </p>
      {checkoutId ? (
        <p className="mt-3 text-xs text-muted-foreground/80">
          Checkout reference: {checkoutId}
        </p>
      ) : null}

      <div className="mt-7 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <RefreshCw className="size-4" aria-hidden />
          Refresh
        </button>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/home"
            onClick={onGoHome}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-95"
          >
            Go to dashboard
          </Link>
          <Link
            href="/billing/history"
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Manage billing
          </Link>
        </div>
      </div>
    </div>
  );
}
