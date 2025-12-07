import { useState } from "react";
import { MoneyPennyNav, Domain } from "@/components/navigation/MoneyPennyNav";
import { MobileNav } from "@/components/navigation/MobileNav";
import { TopHeader } from "@/components/navigation/TopHeader";
import { PennyDropsDrawer } from "@/components/navigation/drawers/PennyDropsDrawer";
import { ScrollsDrawer } from "@/components/navigation/drawers/ScrollsDrawer";
import { Kn0wdZDrawer } from "@/components/navigation/drawers/Kn0wdZDrawer";
import { AigentDrawer } from "@/components/navigation/drawers/AigentDrawer";

export function Layout({ children }: { children: React.ReactNode }) {
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleDomainClick = (domain: Domain) => {
    setActiveDomain(activeDomain === domain ? null : domain);
  };

  return (
    <div className="flex h-screen bg-[#020818]">
      <TopHeader 
        onMobileMenuClick={() => setIsMobileNavOpen(true)} 
        isMobileMenuOpen={isMobileNavOpen} 
      />
      
      <div className="flex w-full pt-[88px]">
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      <MoneyPennyNav 
        activeDomain={activeDomain} 
        onDomainClick={handleDomainClick}
        onAIClick={() => setIsAIOpen(true)}
      />

      <MobileNav 
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        activeDomain={activeDomain}
        onDomainClick={handleDomainClick}
        onAIClick={() => setIsAIOpen(true)}
      />

      {/* Active Domain Drawers - Issue #0 v0.1 */}
      <PennyDropsDrawer isOpen={activeDomain === 'pennydrops'} onClose={() => setActiveDomain(null)} />
      <ScrollsDrawer isOpen={activeDomain === 'scrolls'} onClose={() => setActiveDomain(null)} />
      <Kn0wdZDrawer isOpen={activeDomain === 'kn0wdz'} onClose={() => setActiveDomain(null)} />
      
      {/* Aigent Drawer */}
      <AigentDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
}
