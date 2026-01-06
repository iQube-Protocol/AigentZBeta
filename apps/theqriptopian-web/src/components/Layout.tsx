import { useState } from "react";
import { MoneyPennyNav, Domain } from "@/components/navigation/MoneyPennyNav";
import { MobileNav } from "@/components/navigation/MobileNav";
import { TopHeader } from "@/components/navigation/TopHeader";
import { PennyDropsDrawer } from "@/components/navigation/drawers/PennyDropsDrawer";
import { ScrollsDrawer } from "@/components/navigation/drawers/ScrollsDrawer";
import { Kn0wdZDrawer } from "@/components/navigation/drawers/Kn0wdZDrawer";
import { WalletDrawer } from "@/components/navigation/drawers/WalletDrawer";
import { AigentDrawer } from "@/components/navigation/drawers/AigentDrawer";
import { CodexDrawer } from "@/components/navigation/drawers/CodexDrawer";
import { MetaAvatarProvider, useMetaAvatar } from "@/contexts/MetaAvatarContext";
import { MetaAvatar } from "@/components/metaVatar";

/**
 * CSS positioning classes for each MetaAvatar container type
 * These are generic and can be reused across the estate
 */
const METAAVATAR_POSITION_CLASSES = {
  // Immersive: Full drawer size (AigentDrawer, full-screen experiences)
  immersive: `
    block right-4 top-[96px] left-4 h-[calc(100vh-104px)]
    md:right-[80px] md:top-[172px] md:left-auto
    md:w-[calc(100vw-80px)] md:h-[calc(100vh-172px)]
    opacity-100 z-[100]
  `,
  // Sidebar: Compact sidebar placement (1/3 width, ~400px height)
  sidebar: `
    block inset-x-0 top-[88px] h-[calc(50vh-88px)]
    md:right-[92px] md:top-[206px] md:left-auto md:inset-x-auto
    md:w-[calc((100vw-92px)/3-40px)] md:h-[400px]
    opacity-100 z-[100] md:rounded-lg overflow-hidden
  `,
  // Copilot: Wallet copilot modal size - below mode toggle, above wallet cards
  copilot: `
    block right-4 top-[163px]
    w-[calc(28rem-2rem)] h-[280px]
    opacity-100 z-[100] rounded-xl overflow-hidden
  `,
  // Codex Copilot: Positioned inside the codex copilot drawer chat area
  // Drawer is fixed bottom-2.5 right-2.5, max-height 600px, width 320px (w-80)
  // Avatar area: drawer height minus input bar (~60px) and tab bar (~48px) = ~108px from bottom
  // Position from right: 10px drawer offset + some padding
  // Size: 460px width, 466px height
  codexCopilot: `
    block bottom-[134px] right-[19px]
    w-[460px] h-[466px]
    opacity-100 z-[110] rounded-lg overflow-hidden
  `,
  // Mini: Small floating pip
  mini: `
    block right-4 bottom-4
    w-[120px] h-[120px]
    opacity-100 z-[100] rounded-full overflow-hidden
  `,
  // Hidden: Invisible but iframe stays loaded
  hidden: `
    opacity-0 pointer-events-none -z-10
  `,
} as const;

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { avatarInitialized, activeContainer, avatarRefreshKey } = useMetaAvatar();

  const handleDomainClick = (domain: Domain) => {
    setActiveDomain(activeDomain === domain ? null : domain);
  };

  // Get position classes based on active container
  const getAvatarPositionClasses = () => {
    if (!activeContainer) return METAAVATAR_POSITION_CLASSES.hidden;
    const key = activeContainer as keyof typeof METAAVATAR_POSITION_CLASSES;
    return METAAVATAR_POSITION_CLASSES[key] || METAAVATAR_POSITION_CLASSES.hidden;
  };

  return (
    <div className="flex min-h-[100svh] md:min-h-screen bg-[#020818]">
      <TopHeader 
        onMobileMenuClick={() => setIsMobileNavOpen(true)} 
        isMobileMenuOpen={isMobileNavOpen}
      />
      
      <div className="flex w-full pt-[88px] min-h-[calc(100svh-88px)] md:min-h-[calc(100vh-88px)] overflow-hidden">
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
      
      {/* Codex Drawer */}
      <CodexDrawer isOpen={activeDomain === 'codex'} onClose={() => setActiveDomain(null)} />
      
      {/* Smart Wallet Drawer */}
      <WalletDrawer isOpen={activeDomain === 'wallet'} onClose={() => setActiveDomain(null)} />
      
      {/* Aigent Drawer */}
      <AigentDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />

      {/* GLOBAL PERSISTENT METAAVATAR
          This is rendered ONCE and NEVER unmounts.
          CSS positioning moves it between containers.
          The D-ID iframe stays connected across navigation. */}
      {avatarInitialized && (
        <div 
          className={`fixed transition-all duration-300 ease-in-out ${getAvatarPositionClasses()}`}
        >
          <MetaAvatar key={avatarRefreshKey} />
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MetaAvatarProvider defaultAgent="moneypenny">
      <LayoutContent>{children}</LayoutContent>
    </MetaAvatarProvider>
  );
}
