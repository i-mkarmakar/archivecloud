"use client";

import { ArrowUpRightFromSquare, FileText } from "@gravity-ui/icons";
import { Button, Card, Skeleton, toast } from "@heroui/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { apiFetch, formatDate } from "@/lib/api";

type BillingOrder = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  paid: boolean;
  totalAmount: number;
  currency: string;
  createdAt: string;
  checkoutId: string | null;
};

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BillingHistoryPage() {
  const params = useSearchParams();
  const [orders, setOrders] = useState<BillingOrder[] | null>(null);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (params?.get("portal_error") === "1") {
      toast.info(
        "Polar customer portal needs a token with customer_sessions:write. Showing history here instead.",
      );
    }
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ items: BillingOrder[] }>(
          "/billing/orders",
        );
        if (!cancelled) setOrders(data.items);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load billing history",
          );
          setOrders([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function downloadInvoice(order: BillingOrder) {
    setDownloadingId(order.id);
    try {
      const data = await apiFetch<{
        invoiceNumber: string | null;
        downloadUrl: string | null;
      }>(`/billing/invoice?order_id=${encodeURIComponent(order.id)}`);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }
      toast.info("Invoice PDF is still preparing. Try again in a moment.");
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Could not download invoice",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing history"
        description="Your Thunder payments and invoices."
        actions={
          <Link href="/settings">
            <Button size="sm" variant="outline">
              Back to settings
            </Button>
          </Link>
        }
      />

      {orders === null ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : null}

      {error ? (
        <Card className="border border-border bg-background p-5 text-sm text-muted">
          {error}
        </Card>
      ) : null}

      {orders && orders.length === 0 && !error ? (
        <Card className="border border-border bg-background p-6 text-center">
          <FileText className="mx-auto size-8 text-muted" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No payments yet
          </p>
          <p className="mt-1 text-xs text-muted">
            After you buy Thunder, invoices will show up here.
          </p>
        </Card>
      ) : null}

      {orders && orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="border border-border bg-background p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {order.invoiceNumber
                      ? `Invoice ${order.invoiceNumber}`
                      : "Payment"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDate(order.createdAt)} ·{" "}
                    {formatMoney(order.totalAmount, order.currency)} ·{" "}
                    {order.paid ? "Paid" : order.status}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  isDisabled={downloadingId === order.id || !order.invoiceNumber}
                  onPress={() => void downloadInvoice(order)}
                >
                  <ArrowUpRightFromSquare className="size-4" />
                  {downloadingId === order.id
                    ? "Opening…"
                    : "Download invoice"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
