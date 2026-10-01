"use client";

import { Modal, useOverlayState } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Side-by-side modal actions (equal width on mobile, end-aligned on sm+). */
export const modalActionsClassName =
  "flex flex-row gap-2 sm:justify-end sm:gap-3";

export const modalActionButtonClassName = "min-w-0 flex-1 sm:flex-none";

export function DummyModal({
  open,
  title,
  description,
  children,
  onClose,
  className,
  bodyClassName,
  headerClassName,
  size = "md",
  scroll = "inside",
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "cover" | "full";
  scroll?: "inside" | "outside";
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
        <Modal.Container placement="center" scroll={scroll} size={size}>
          <Modal.Dialog
            className={cn(
              "mx-3 w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-2rem)] sm:mx-0 sm:w-auto",
              className,
            )}
          >
            <Modal.CloseTrigger
              aria-label="Close"
              className="cursor-pointer text-[#4b5563] hover:bg-black/5 hover:text-[#111827]"
            />
            <Modal.Header className={cn("pr-10", headerClassName)}>
              <Modal.Heading className="text-lg font-extrabold tracking-tight">
                {title}
              </Modal.Heading>
              {description ? (
                <p className="mt-1 text-sm text-muted">{description}</p>
              ) : null}
            </Modal.Header>
            <Modal.Body
              className={cn("min-h-0 overflow-hidden", bodyClassName)}
            >
              {children}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
