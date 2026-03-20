import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import PipelineSection from "@/components/landing/PipelineSection";
import ConditionsSection from "@/components/landing/ConditionsSection";
import TechnologySection from "@/components/landing/TechnologySection";
import UseCasesSection from "@/components/landing/UseCasesSection";
import ImpactSection from "@/components/landing/ImpactSection";
import FAQSection from "@/components/landing/FAQSection";
import FooterSection from "@/components/landing/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <PipelineSection />
      <ConditionsSection />
      <TechnologySection />
      <UseCasesSection />
      <ImpactSection />
      <FAQSection />
      <FooterSection />
    </div>
  );
};

export default Index;
