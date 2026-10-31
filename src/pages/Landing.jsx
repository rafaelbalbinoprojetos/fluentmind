import "../components/landing/landing.css";
import {
  AudienceSection,
  BenefitsStrip,
  FinalCTA,
  HeroSection,
  HowItWorks,
  LandingFooter,
  LandingHeader,
  ProductShowcase,
} from "../components/landing/LandingParts.jsx";

export default function LandingPage() {
  return (
    <div className="fl-landing">
      <a href="#fl-main" className="fl-skip">Pular para o conteúdo</a>
      <LandingHeader />
      <main id="fl-main">
        <HeroSection />
        <BenefitsStrip />
        <HowItWorks />
        <ProductShowcase />
        <AudienceSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
