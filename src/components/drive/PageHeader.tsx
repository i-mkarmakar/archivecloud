import { Heading, Paragraph } from "@heroui/react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  titleActions,
  actions,
}: {
  title: ReactNode;
  description?: string;
  titleActions?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 sm:mt-3.5">
      <div className="flex min-w-0 items-center gap-2">
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
        {titleActions ? (
          <div className="flex shrink-0 items-center gap-2">{titleActions}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
