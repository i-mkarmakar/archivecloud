import { Heading, Paragraph } from "@heroui/react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 sm:mt-3.5">
      <div className="min-w-0">
        <Heading
          level={1}
          className="truncate text-lg font-extrabold tracking-tight sm:text-[22px] lg:text-[28px]"
        >
          {title}
        </Heading>
        {description ? (
          <Paragraph className="mt-1 text-sm text-muted">
            {description}
          </Paragraph>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
