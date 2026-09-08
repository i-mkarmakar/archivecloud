"use client";

import { TrashBin, TriangleExclamation } from "@gravity-ui/icons";
import { Button, Modal, toast, useOverlayState } from "@heroui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeModal();
    },
  });

  useEffect(() => {
    if (open) state.open();
    else state.close();
  }, [open]);

  function closeModal() {
    if (deleting) return;
    setOpen(false);
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
          confirmation: "DELETE",
        }),
      });
      toast.success("Your account has been deleted.");
      await authClient.signOut();
      router.replace("/signin");
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
    <>
      <section
        id="settings-delete"
        className={cn(
          "scroll-mt-24 rounded-2xl border border-red-200 bg-[#FFF5F5] p-5 shadow-sm sm:p-6",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <TriangleExclamation className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground">
              Delete Account
            </h3>
            <p className="mt-1 text-sm text-muted">
              Once you delete your account, there&apos;s no going back. All your
              data will be permanently removed from our servers.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-red-100 pt-5">
          <div className="rounded-xl bg-red-50/80 p-4">
            <div className="flex items-start gap-2">
              <TriangleExclamation className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-sm font-bold text-foreground">
                Warning: This action cannot be undone
              </p>
            </div>
            <p className="mt-3 text-sm text-foreground">
              Deleting your account will permanently remove:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {DELETE_REMOVALS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <Button
            className="mt-5 bg-red-600 text-white hover:bg-red-700"
            onPress={() => setOpen(true)}
          >
            <TrashBin className="h-4 w-4" />
            Delete My Account
          </Button>
        </div>
      </section>

      {state.isOpen ? (
        <Modal state={state}>
          <Modal.Backdrop isDismissable={!deleting}>
            <Modal.Container placement="center" scroll="inside" size="md">
              <Modal.Dialog className="relative max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border-0 p-0 shadow-xl">
                <Modal.CloseTrigger
                  isDisabled={deleting}
                  className="z-10 text-white hover:bg-white/10"
                />
                <Modal.Header className="border-0 bg-[#1e3a5f] px-5 py-3.5 pr-12 text-white">
                  <Modal.Heading className="text-base font-semibold tracking-tight text-white">
                    Delete Account
                  </Modal.Heading>
                </Modal.Header>

                <Modal.Body className="gap-5 bg-white px-5 py-5">
                  <p className="text-sm text-muted">Account: {email}</p>

                  <div className="grid gap-1.5">
                    <label
                      htmlFor="delete-account-reason"
                      className="text-sm font-semibold text-foreground"
                    >
                      Reason for leaving{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="delete-account-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Share why you're deleting your account..."
                      rows={4}
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
                      Please type DELETE in capital letters to confirm account
                      deletion
                    </p>
                  </div>

                  <div className="grid gap-3 pt-1">
                    <Button
                      className="w-full bg-red-600 text-white hover:bg-red-700"
                      isDisabled={!canDelete}
                      onPress={() => confirmDelete().catch(() => undefined)}
                    >
                      {deleting
                        ? "Deleting..."
                        : "Delete My Account Permanently"}
                    </Button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={closeModal}
                      className="text-center text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : null}
    </>
  );
}
