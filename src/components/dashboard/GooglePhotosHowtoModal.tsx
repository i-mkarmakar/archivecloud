"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";

export function GooglePhotosHowtoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
        <Modal.Container placement="center" scroll="inside" size="lg">
          <Modal.Dialog className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-hidden p-0 sm:max-w-lg">
            <div className="flex items-center justify-between bg-primary px-5 py-3.5 text-white">
              <h2 className="text-base font-bold">How to Use Google Photos</h2>
              <Modal.CloseTrigger className="text-white hover:bg-white/15" />
            </div>

            <Modal.Body className="gap-5 bg-white px-5 py-5">
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                Google Photos requires a different approach than other cloud
                storage services. You need to explicitly select files using
                their picker interface.
              </div>

              <section className="grid gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  1. Click the Import Button
                </h3>
                <p className="text-sm text-muted">
                  Find and click the Import button in your dashboard when a
                  Google Photos account is selected.
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm font-semibold text-foreground">
                  <ProviderBrandIcon name="google_photos" className="h-5 w-5" />
                  Import
                </div>
              </section>

              <section className="grid gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  2. Select Your Photos/Videos
                </h3>
                <p className="text-sm text-muted">
                  The Google Photos picker will open. Browse and select the
                  photos or videos you want to import, then click Done.
                </p>
              </section>

              <section className="grid gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  3. Access Your Imported Files
                </h3>
                <p className="text-sm text-muted">
                  Selected files will appear after import and can be organized
                  into virtual folders.
                </p>
                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-foreground">
                  Note: Your files remain in Google Photos. We create references
                  here so they stay on this page after import.
                </div>
              </section>
            </Modal.Body>

            <div className="border-t border-border bg-white px-5 py-4">
              <Button variant="primary" className="w-full" onPress={onClose}>
                Got it, Thanks!
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
