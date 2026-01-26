import { useState, useEffect } from "react";
import { Bell, Menu, User, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getMyWalletPersonas } from "@/services/walletApi";

interface TopHeaderProps {
  onMobileMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

export function TopHeader({ onMobileMenuClick, isMobileMenuOpen }: TopHeaderProps) {
  const [personaHandle, setPersonaHandle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPersona = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPersonaHandle(null);
          setIsLoading(false);
          return;
        }

        const { personas } = await getMyWalletPersonas();
        const activeId =
          localStorage.getItem('currentPersonaId') ||
          sessionStorage.getItem('currentPersonaId') ||
          localStorage.getItem('activePersonaId') ||
          undefined;
        const active = activeId ? personas.find((p) => p.id === activeId) : personas[0];
        setPersonaHandle(active?.fioHandle || null);
      } catch (e) {
        console.error('[TopHeader] Error fetching persona:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersona();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPersona();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPersonaHandle(null);
    window.location.href = '/';
  };

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
        
        {/* Persona Selector with Sign In/Out */}
        {isLoading ? (
          <Button variant="ghost" size="sm" disabled className="gap-2 text-gray-400">
            <User className="h-4 w-4" />
            <span className="text-sm">...</span>
          </Button>
        ) : personaHandle ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-gray-300 hover:text-cyan-400 hover:bg-cyan-500/10 hover:backdrop-blur-sm transition-all">
                <User className="h-4 w-4" />
                <span className="text-sm">{personaHandle}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0a1628]/95 backdrop-blur-md border-[#1a2942]">
              <DropdownMenuItem className="text-gray-300 cursor-default">
                <User className="h-4 w-4 mr-2" />
                {personaHandle}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1a2942]" />
              <DropdownMenuItem 
                className="text-red-400 hover:text-red-300 cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 hover:backdrop-blur-sm transition-all"
            onClick={() => window.location.href = '/auth'}
          >
            <User className="h-4 w-4" />
            <span className="text-sm">Sign In</span>
          </Button>
        )}
        
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
