"use client";

import { Tooltip } from "@heroui/react";
import type { ReactElement, ReactNode } from "react";

type Props = {
  label: ReactNode;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
  isDisabled?: boolean;
};

/** Shared HeroUI tooltip wrapper for icon/action controls. */
export function ActionTooltip({
  label,
  children,
  placement = "top",
  delay = 300,
  isDisabled = false,
}: Props) {
  if (isDisabled || label == null || label === "") {
    return children;
  }

  return (
    <Tooltip delay={delay} isDisabled={isDisabled}>
      <Tooltip.Trigger className="inline-flex max-w-full">
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content
        showArrow
        placement={placement}
        className="rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs text-foreground shadow-sm"
      >
        <Tooltip.Arrow />
        {typeof label === "string" || typeof label === "number" ? (
          <p>{label}</p>
        ) : (
          label
        )}
      </Tooltip.Content>
    </Tooltip>
  );
}
