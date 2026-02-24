import { HeroSection } from "./HeroSection";
import { LatestNewsCarousel } from "./LatestNewsCarousel";
import { SecondHeroSection } from "./SecondHeroSection";

export function MoneyPennyHero() {

  return (
    <div className="h-full w-full flex items-stretch">
      <div className="w-full h-full flex flex-col bg-[#050f1f] border-l border-r-0 border-t-0 border-b-0 border-[#17243a] shadow-[0_0_40px_rgba(0,0,0,0.7)] overflow-y-auto">
        <HeroSection />
        <LatestNewsCarousel />
        <SecondHeroSection />
      </div>
    </div>
  );
}
