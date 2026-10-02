"use client";

import { Eye, FileArrowDown, FileText } from "@gravity-ui/icons";
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
  planLabel: string;
  billingPeriod: string;
  subscriptionStatus: string | null;
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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "muted";
}) {
  return (
    <span
      className={
        tone === "success"
          ? "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
          : "inline-flex rounded-full bg-muted/15 px-2.5 py-0.5 text-xs font-semibold text-muted"
      }
    >
      {label}
    </span>
  );
}

export function BillingHistoryPage() {
  const params = useSearchParams();
  const [orders, setOrders] = useState<BillingOrder[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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
            err instanceof Error
              ? err.message
              : "Failed to load billing history",
          );
          setOrders([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openInvoice(order: BillingOrder) {
    setBusyId(order.id);
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
        err instanceof Error ? err.message : "Could not open invoice",
      );
    } finally {
      setBusyId(null);
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
        <Card className="overflow-hidden border border-border bg-background p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Charged Amount</th>
                  <th className="px-4 py-3">Invoice Status</th>
                  <th className="px-4 py-3">Subscription Status</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Billing Period</th>
                  <th className="px-4 py-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr
                    key={order.id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {order.invoiceNumber ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-foreground">
                      {order.planLabel}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {formatMoney(order.totalAmount, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={order.paid ? "Paid" : order.status}
                        tone={order.paid ? "success" : "muted"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {order.subscriptionStatus ? (
                        <StatusPill
                          label={order.subscriptionStatus}
                          tone="success"
                        />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {order.billingPeriod}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="View invoice"
                          isDisabled={
                            busyId === order.id || !order.invoiceNumber
                          }
                          onPress={() => void openInvoice(order)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="Download invoice"
                          isDisabled={
                            busyId === order.id || !order.invoiceNumber
                          }
                          onPress={() => void openInvoice(order)}
                        >
                          <FileArrowDown className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
