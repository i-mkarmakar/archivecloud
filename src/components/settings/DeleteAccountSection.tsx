"use client";

import { TrashBin, TriangleExclamation } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { clearUserPlanCache } from "@/lib/user-plan-cache";
import { resetUserPlanStore } from "@/hooks/useUserPlan";
import { cn } from "@/lib/utils";

const DELETE_REMOVALS = [
  "Your profile and personal information",
  "All connected cloud storage accounts",
  "Files metadata and virtual folders",
  "Subscription and billing information",
  "Schedules and tasks",
  "All preferences and settings",
] as const;

type DeleteAccountSectionProps = {
  email: string;
  className?: string;
};

export function DeleteAccountSection({
  email,
  className,
}: DeleteAccountSectionProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expanded]);

  function collapse() {
    if (deleting) return;
    setExpanded(false);
    setReason("");
    setConfirmation("");
  }

  const canDelete =
    reason.trim().length > 0 && confirmation === "DELETE" && !deleting;

  async function confirmDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await apiFetch("/account/delete", {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          confirmation,
        }),
      });
      try {
        await authClient.signOut();
      } catch {
        // Session row may already be gone after account delete.
      }
      clearUserPlanCache();
      resetUserPlanStore();
      window.location.assign("/auth/sign-in");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to delete account. Please try again.",
      );
      setDeleting(false);
    }
  }

  return (
    <section id="settings-delete" className={cn("scroll-mt-24", className)}>
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
        Delete account
      </h2>

      <div className="mt-4 rounded-2xl border border-red-200 bg-[#FFF5F5] p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <TriangleExclamation className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground">
              Delete Account
            </h3>
            <p className="mt-1 text-sm text-muted">
              Permanently delete{" "}
              {email.trim() ? (
                <span className="font-semibold text-foreground">
                  {email.trim()}
                </span>
              ) : (
                "your account"
              )}
              . This cannot be undone and all your data will be removed.
            </p>
          </div>
        </div>

        <div
          id={panelId}
          ref={panelRef}
          aria-hidden={!expanded}
          inert={!expanded ? true : undefined}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            expanded ? "mt-5 grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-red-100 pt-5">
              <p className="text-sm font-bold text-foreground">
                Deleting your account will permanently remove:
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {DELETE_REMOVALS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="delete-account-reason"
                    className="text-sm font-semibold text-foreground"
                  >
                    Reason for leaving <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="delete-account-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Share why you're deleting your account..."
                    rows={3}
                    disabled={deleting}
                    className="w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    htmlFor="delete-account-confirm"
                    className="text-sm font-semibold text-foreground"
                  >
                    Type &quot;DELETE&quot; to confirm
                  </label>
                  <input
                    id="delete-account-confirm"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                    disabled={deleting}
                    className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                  <p className="text-xs text-muted">
                    Please type{" "}
                    <span className="font-bold text-foreground">DELETE</span> in
                    capital letters to confirm account deletion
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!expanded ? (
            <Button
              variant="danger"
              aria-expanded={false}
              aria-controls={panelId}
              onPress={() => setExpanded(true)}
            >
              <TrashBin className="h-4 w-4" />
              Delete account
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                isDisabled={deleting}
                onPress={collapse}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isDisabled={!canDelete}
                onPress={() => confirmDelete().catch(() => undefined)}
              >
                <TrashBin className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete My Account"}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
