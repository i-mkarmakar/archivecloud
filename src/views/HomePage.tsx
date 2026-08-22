import { HeroSection } from "@/components/home/HeroSection";
import { CloudProviderGrid } from "@/components/home/CloudProviderGrid";
import { FeatureSection } from "@/components/home/FeatureSection";
import { OpenSourceSection } from "@/components/home/OpenSourceSection";
import { OpenSourceTextLoop } from "@/components/home/OpenSourceTextLoop";
import { UseCases } from "@/components/home/UseCases";
import { PricingSection } from "@/components/home/PricingSection";
import { FAQSection } from "@/components/home/FAQSection";
import { FinalCTA } from "@/components/home/FinalCTA";

export function HomePage() {
  return (
    <>
      <HeroSection />
      <OpenSourceTextLoop />
      <CloudProviderGrid />
      <FeatureSection />
      <OpenSourceSection />
      <UseCases />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
    </>
  );
}
