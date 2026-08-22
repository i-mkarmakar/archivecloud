"use client";

import { CircleCheckFill } from "@gravity-ui/icons";
import { Button, Modal, toast, useOverlayState } from "@heroui/react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  type PlanDefinition,
  type PlanId,
  PLANS,
  isPlanRecommended,
  planBillingHint,
  planPriceLabel,
  planTagline,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

type UpgradePlanModalProps = {
  open: boolean;
  onClose: () => void;
  currentPlanId?: PlanId;
};

function PlanCard({
  plan,
  currentPlanId,
  busy,
  onSelect,
}: {
  plan: PlanDefinition;
  currentPlanId: PlanId;
  busy: boolean;
  onSelect: (plan: PlanDefinition) => void;
}) {
  const isCurrent = plan.id === currentPlanId;
  const recommended = isPlanRecommended(plan);
  const billingHint = planBillingHint(plan);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm",
        recommended
          ? "border-[#1877f2] shadow-[0_8px_24px_rgba(24,119,242,0.12)] ring-1 ring-[#1877f2]/30"
          : "border-border",
      )}
    >
      {recommended ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-[#1877f2] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Recommended
        </span>
      ) : null}

      <h3 className="text-xl font-extrabold text-foreground">{plan.name}</h3>
      <p className="mt-3 text-[28px] font-extrabold leading-none tracking-tight text-foreground">
        {planPriceLabel(plan)}
        {billingHint ? (
          <span className="ml-1 text-sm font-semibold text-muted">
            ({billingHint})
          </span>
        ) : (
          <span className="ml-1 text-sm font-semibold text-muted">/ forever</span>
        )}
      </p>
      <p className="mt-2 text-sm text-muted">{planTagline(plan)}</p>

      <Button
        className="mt-5 w-full rounded-full"
        variant={isCurrent ? "outline" : recommended ? "primary" : "outline"}
        isDisabled={isCurrent || busy || plan.id === "free"}
        onPress={() => onSelect(plan)}
      >
        {isCurrent ? "Current Plan" : busy ? "Redirecting…" : plan.cta}
      </Button>

      <ul className="mt-6 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2.5 text-sm">
            <CircleCheckFill className="mt-0.5 h-4 w-4 shrink-0 text-[#5b9dff]" />
            <span
              className={cn(
                "text-foreground",
                feature.highlight && "font-semibold",
              )}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UpgradePlanModal({
  open,
  onClose,
  currentPlanId = "free",
}: UpgradePlanModalProps) {
  const [busyPlanId, setBusyPlanId] = useState<PlanId | null>(null);
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  useEffect(() => {
    if (open) state.open();
    else state.close();
  }, [open]);

  async function handleSelect(plan: PlanDefinition) {
    if (plan.id === "free") return;
    setBusyPlanId(plan.id);
    try {
      const res = await apiFetch<{ url: string }>("/billing", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      window.location.href = res.url;
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Could not start Polar checkout",
      );
      setBusyPlanId(null);
    }
  }

  if (!state.isOpen) return null;

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable>
        <Modal.Container placement="center" scroll="inside" size="lg">
          <Modal.Dialog className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
            <div className="flex items-center justify-between bg-primary px-5 py-3.5 text-white">
              <h2 className="text-base font-bold">Upgrade Plan</h2>
              <Modal.CloseTrigger className="text-white hover:bg-white/15" />
            </div>

            <Modal.Body className="bg-white px-5 py-6 sm:px-8">
              <div className="text-center">
                <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
                  Choose Your Plan
                </h3>
                <p className="mt-2 text-sm text-muted">
                  One simple upgrade: $9 once, lifetime access.
                </p>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    currentPlanId={currentPlanId}
                    busy={busyPlanId === plan.id}
                    onSelect={(p) => {
                      void handleSelect(p);
                    }}
                  />
                ))}
              </div>

              {currentPlanId !== "free" ? (
                <p className="mt-6 text-center text-sm text-muted">
                  Need a receipt or refund help?{" "}
                  <a
                    href="/billing/portal"
                    className="font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    Open Polar billing portal
                  </a>
                </p>
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
