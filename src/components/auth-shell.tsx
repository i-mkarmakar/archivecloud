import Link from "next/link";
import { BrandLogo } from "@/components/drive/BrandLogo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shadcn-auth grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/signin" className="flex items-center gap-2 font-medium">
            <BrandLogo className="size-8" />
            ArchiveCloud
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-muted to-background"
          aria-hidden
        />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-3 text-center">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              Your Google Drive gateway
            </p>
            <p className="text-sm text-muted-foreground">
              Upload, organize, and share files across connected Drive accounts
              with unified quota tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
