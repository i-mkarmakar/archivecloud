"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import {
  BillingSuccessFallback,
  DashboardSuspense,
} from "@/components/drive/DashboardSuspense";
import { PageHeader } from "@/components/drive/PageHeader";

function SuccessBody() {
  const params = useSearchParams();
  const checkoutId = params?.get("checkout_id");

  return (
    <>
      <PageHeader
        title="Payment received"
        description="Thanks for upgrading Archive Cloud. Your plan unlocks within a few seconds after Polar confirms the subscription."
      />
      <div className="mt-6 max-w-lg rounded-2xl border border-border bg-surface-secondary p-5">
        <p className="text-sm text-muted">
          {checkoutId
            ? `Checkout reference: ${checkoutId}`
            : "If your plan chip still shows Free, refresh in a moment. Webhooks sync the entitlement."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/home">
            <Button>Go to dashboard</Button>
          </Link>
          <Link href="/billing/portal">
            <Button variant="outline">Manage billing</Button>
          </Link>
        </div>
      </div>
    </>
  );
}

export default function BillingSuccessPage() {
  return (
    <DashboardSuspense fallback={<BillingSuccessFallback />}>
      <SuccessBody />
    </DashboardSuspense>
  );
}
