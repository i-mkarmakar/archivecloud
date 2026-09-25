"use client";

import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { providerLabel } from "@/lib/providers";

export function AccountProviderIcon({ provider }: { provider: string }) {
  return (
    <ProviderBrandIcon
      name={provider}
      className="h-5 w-5 shrink-0"
      fallback={
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-bold text-primary">
          {providerLabel(provider).charAt(0)}
        </span>
      }
    />
  );
}
