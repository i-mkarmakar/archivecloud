import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { SectionBadge } from "@/components/home/SectionBadge";

const PROVIDERS = [
  "Google Drive",
  "Google Shared Drive",
  "Google Photos",
  "Dropbox",
  "pCloud",
  "OneDrive",
  "iCloud",
] as const;

export function CloudProviderGrid() {
  return (
    <section
      id="integrations"
      className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Integrations</SectionBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:mt-4 sm:text-4xl">
            Connect your favourite cloud storage
          </h2>
          <p className="mt-2 text-sm text-[#64748B] sm:mt-3 sm:text-lg">
            Bring all your cloud accounts together. Add or remove anytime.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-10 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-7 lg:gap-4">
          {PROVIDERS.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E5EEF7] bg-white px-2 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-[#BFDFFF] hover:shadow-[0_12px_28px_-18px_rgba(22,131,247,0.45)] sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-6"
            >
              <ProviderBrandIcon name={name} className="size-7 sm:size-10" />
              <p className="text-center text-[11px] font-medium leading-tight text-[#0F172A] sm:text-[13px]">
                {name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
