"use client";

import { CircleExclamation } from "@gravity-ui/icons";
import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect } from "react";

export function AutoSyncRestrictedModal({
  open,
  onClose,
  onUpgrade,
  canUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  canUpgrade: boolean;
}) {
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

  if (!state.isOpen) return null;

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable>
        <Modal.Container placement="center" scroll="inside" size="md">
          <Modal.Dialog className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-hidden rounded-xl border border-border bg-white p-0 shadow-xl">
            <Modal.CloseTrigger className="absolute right-3 top-3" />

            <Modal.Header className="flex flex-row items-center gap-3 border-0 px-5 pb-0 pt-5 pr-12">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
                <CircleExclamation className="h-4 w-4" />
              </span>
              <Modal.Heading className="text-base font-bold tracking-tight text-foreground">
                Auto-Sync Restricted
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="gap-5 px-5 pb-5 pt-3">
              <p className="text-sm leading-relaxed text-[#4b5563]">
                Creating new auto-sync pairs is restricted. Auto-Sync requires
                an active subscription or Thunder plan.
              </p>

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-[11px]"
                  onPress={onClose}
                >
                  Close
                </Button>
                {canUpgrade ? (
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-8 px-3 text-[11px]"
                    onPress={onUpgrade}
                  >
                    Upgrade to Enable
                  </Button>
                ) : null}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
