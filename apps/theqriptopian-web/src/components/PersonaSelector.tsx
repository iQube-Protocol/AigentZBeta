import { useState, useEffect } from "react";
import { User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getMyWalletPersonas, type WalletPersona } from "@/services/walletApi";

export function PersonaSelector() {
  const [personas, setPersonas] = useState<WalletPersona[]>([]);
  const [activePersona, setActivePersona] = useState<WalletPersona | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[PersonaSelector] Mounted');
    fetchUserPersonas();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      console.log('[PersonaSelector] Auth state changed:', event);
      fetchUserPersonas();
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserPersonas = async () => {
    console.log('[PersonaSelector] fetchUserPersonas called');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[PersonaSelector] User:', user?.id || 'none');
      
      if (!user) {
        setPersonas([]);
        setActivePersona(null);
        setIsLoading(false);
        return;
      }

      const { personas: walletPersonas } = await getMyWalletPersonas();
      setPersonas(walletPersonas);

      const activeId =
        localStorage.getItem('currentPersonaId') ||
        sessionStorage.getItem('currentPersonaId') ||
        localStorage.getItem('activePersonaId') ||
        undefined;

      const active = activeId ? walletPersonas.find((p) => p.id === activeId) : walletPersonas[0];
      if (active) {
        setActivePersona(active);
        try {
          localStorage.setItem('currentPersonaId', active.id);
          localStorage.setItem('activePersonaId', active.id);
        } catch {}
      } else {
        setActivePersona(null);
      }
    } catch (error) {
      console.error('[PersonaSelector] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaChange = (persona: WalletPersona) => {
    setActivePersona(persona);
    try {
      localStorage.setItem('currentPersonaId', persona.id);
      localStorage.setItem('activePersonaId', persona.id);
      sessionStorage.setItem('currentPersonaId', persona.id);
    } catch {}
  };

  const getDisplayName = (persona: WalletPersona) => {
    return persona.fioHandle || `Persona ${persona.id.slice(0, 8)}`;
  };

  // Always render something visible for debugging
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2 text-gray-400">
        <User className="h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  if (personas.length === 0) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-2 text-gray-400 hover:text-cyan-400"
        onClick={() => window.location.href = '/auth?mode=signup'}
      >
        <User className="h-4 w-4" />
        <span className="text-sm">Sign In</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-gray-300 hover:text-cyan-400 hover:bg-white/5"
        >
          <User className="h-4 w-4" />
          <span className="text-sm">
            {activePersona ? getDisplayName(activePersona) : 'Select Persona'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-[#0a1628]/95 backdrop-blur-md border-[#1a2942]"
      >
        <DropdownMenuLabel className="text-gray-400">Your Personas</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#1a2942]" />
        {personas.map((persona) => (
          <DropdownMenuItem
            key={persona.id}
            onClick={() => handlePersonaChange(persona)}
            className={`cursor-pointer ${
              activePersona?.id === persona.id
                ? 'bg-cyan-500/10 text-cyan-400'
                : 'text-gray-300 hover:text-cyan-400'
            }`}
          >
            <User className="h-4 w-4 mr-2" />
            <span>{getDisplayName(persona)}</span>
            {activePersona?.id === persona.id && (
              <span className="ml-auto text-xs text-cyan-400">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
