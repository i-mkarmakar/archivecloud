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
    <section id="integrations" className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Integrations</SectionBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            Connect your favourite cloud storage
          </h2>
          <p className="mt-3 text-base text-[#64748B] sm:text-lg">
            Bring all your cloud accounts together. Add or remove anytime.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 lg:gap-4">
          {PROVIDERS.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5EEF7] bg-white px-3 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-[#BFDFFF] hover:shadow-[0_12px_28px_-18px_rgba(22,131,247,0.45)]"
            >
              <ProviderBrandIcon name={name} className="size-10" />
              <p className="text-center text-xs font-medium text-[#0F172A] sm:text-[13px]">
                {name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
