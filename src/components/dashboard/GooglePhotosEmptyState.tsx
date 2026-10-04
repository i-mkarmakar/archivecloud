"use client";

import { ArrowUpFromLine, CircleCheck } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";

const POINTS = [
  "Copy selected photos and videos into another cloud",
  "Preview and search items you have already copied",
  "Keep originals safe in Google Photos",
] as const;

export function GooglePhotosEmptyState({ onCopy }: { onCopy: () => void }) {
  return (
    <div className="mt-6 flex min-h-[280px] w-full items-center justify-center px-2 py-4 sm:min-h-[340px]">
      <div className="flex w-full max-w-xl flex-col items-center rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center sm:px-10 sm:py-12">
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/5" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-sm">
            <ArrowUpFromLine className="h-6 w-6" />
          </div>
          <div className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white shadow-sm">
            <ProviderBrandIcon name="google_photos" className="h-4 w-4" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-foreground">No files yet</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          Use Copy to pick photos or videos from Google Photos, then choose
          where they should go.
        </p>

        <ul className="mt-6 flex w-full max-w-sm flex-col gap-3 text-left">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm leading-relaxed text-foreground">
                {point}
              </span>
            </li>
          ))}
        </ul>

        <Button className="mt-8 gap-2" variant="primary" onPress={onCopy}>
          <ProviderBrandIcon name="google_photos" className="h-4 w-4" />
          Copy from Google Photos
        </Button>
      </div>
    </div>
  );
}
