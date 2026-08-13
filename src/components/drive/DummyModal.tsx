"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
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
            <Modal.Header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Modal.Heading className="text-xl font-extrabold tracking-tight">
                  {title}
                </Modal.Heading>
                <p className="mt-1 text-sm text-default-500">{description}</p>
              </div>
              <Button
                variant="outline"
                isIconOnly
                size="sm"
                aria-label="Close modal"
                onPress={onClose}
              >
                <Xmark className="h-5 w-5" />
              </Button>
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
