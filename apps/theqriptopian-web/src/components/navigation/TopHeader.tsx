import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonaSelector } from "@/components/PersonaSelector";
import { WalletButton } from "@agentiq/smartwallet";

interface TopHeaderProps {
  onMobileMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

export function TopHeader({ onMobileMenuClick, isMobileMenuOpen }: TopHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] bg-[#0a1628] border-b border-[#1a2942] z-40 px-4 md:px-8 flex items-start pt-6">
      <div className="flex-1">
        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          The Qriptopian
        </h1>
        <p className="hidden md:block text-sm text-gray-400 mt-1">
          Stories from the Quantum-Ready Internet
        </p>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400">
          <Bell className="h-5 w-5" />
        </Button>
        
        <PersonaSelector />
        
        <WalletButton
          className="hidden md:flex px-4 py-2 text-sm bg-white/5 backdrop-blur-md border border-white/10 text-gray-300 hover:bg-white/10 hover:border-cyan-500/20 hover:text-cyan-300 transition-all rounded-md"
          connectedClassName="hidden md:flex px-4 py-2 text-sm bg-cyan-500/10 backdrop-blur-md border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all rounded-md gap-2"
          connectingClassName="hidden md:flex px-4 py-2 text-sm bg-white/5 backdrop-blur-md border border-white/10 text-gray-400 transition-all rounded-md cursor-wait"
          connectText="Connect Wallet"
          connectingText="Connecting..."
          showBalance={false}
          showAddress={true}
          addressFormat="short"
        />
        
        {/* Mobile Menu Button */}
        {onMobileMenuClick && (
          <button 
            className={`md:hidden p-2 transition-colors ${isMobileMenuOpen ? 'text-cyan-400' : 'text-gray-400 hover:text-cyan-400'}`}
            onClick={onMobileMenuClick}
            aria-label="Toggle mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}