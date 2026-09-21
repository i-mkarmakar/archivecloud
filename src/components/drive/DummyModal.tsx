"use client";

import { Modal, useOverlayState } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function DummyModal({
  open,
  title,
  description,
  children,
  onClose,
  className,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
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
          <Modal.Dialog className={cn("max-h-[calc(100dvh-2rem)]", className)}>
            <Modal.CloseTrigger className="text-[#4b5563] hover:bg-black/5 hover:text-[#111827]" />
            <Modal.Header className="pr-10">
              <Modal.Heading className="text-xl font-extrabold tracking-tight">
                {title}
              </Modal.Heading>
              <p className="mt-1 text-sm text-muted">{description}</p>
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
