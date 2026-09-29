"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect } from "react";
import { Portal } from "@/components/Portal";

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
    <Portal>
      <Modal state={state}>
        <Modal.Backdrop isDismissable className="z-[100]">
          <Modal.Container placement="center" scroll="inside" size="cover">
            <Modal.Dialog className="max-h-[calc(100dvh-2rem)] w-[min(100%,42rem)] overflow-hidden p-0 sm:max-w-2xl">
              <div className="flex items-center justify-between bg-primary px-6 py-3.5 text-white">
                <h2 className="text-base font-bold sm:text-lg">
                  Importing from Google Photos
                </h2>
                <Modal.CloseTrigger className="text-white hover:bg-white/15" />
              </div>

              <Modal.Body className="gap-8 bg-white px-6 py-6">
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  Unlike Drive or Dropbox, Google Photos does not sync a full
                  library here. You choose what to bring in through
                  Google&apos;s picker each time.
                </div>

                <section className="grid gap-3">
                  <h3 className="text-sm font-bold text-foreground">
                    1. Start an import
                  </h3>
                  <p className="text-sm text-muted">
                    With your Google Photos account selected, press Import in
                    the toolbar to open the picker.
                  </p>
                  <img
                    src="/image2.png"
                    alt="Import button highlighted in the Archive Cloud toolbar"
                    className="w-full border border-border"
                  />
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-bold text-foreground">
                    2. Pick what to bring in
                  </h3>
                  <p className="text-sm text-muted">
                    Choose the photos or videos you want, then press Done. Close
                    the picker window when you&apos;re finished so Archive Cloud
                    can finish the import.
                  </p>
                  <img
                    src="/image1.png"
                    alt="Google Photos picker with Done highlighted"
                    className="w-full border border-border"
                  />
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-bold text-foreground">
                    3. Find them in Archive Cloud
                  </h3>
                  <p className="text-sm text-muted">
                    Imported items show up in this view. You can move them into
                    virtual folders like any other file.
                  </p>
                  <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-foreground">
                    Tip: Nothing is copied out of Google Photos. We only keep
                    links so the same media stays available in Archive Cloud.
                  </div>
                </section>
              </Modal.Body>

              <div className="border-t border-border bg-white px-6 py-4">
                <Button variant="primary" className="w-full" onPress={onClose}>
                  Okay, got it
                </Button>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Portal>
  );
}
