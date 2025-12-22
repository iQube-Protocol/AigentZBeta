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

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
  created_at: string | null;
}

export function PersonaSelector() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('persona_id, display_name')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[PersonaSelector] Profile:', profile, 'Error:', profileError);

      if (!profile?.persona_id) {
        setPersonas([]);
        setActivePersona(null);
        setIsLoading(false);
        return;
      }

      const { data: persona, error } = await supabase
        .from('persona')
        .select('id, fio_handle, default_identity_state, created_at')
        .eq('id', profile.persona_id)
        .maybeSingle();

      console.log('[PersonaSelector] Persona:', persona, 'Error:', error);

      if (persona) {
        setPersonas([persona]);
        setActivePersona(persona);
        localStorage.setItem('activePersonaId', persona.id);
      } else {
        setPersonas([]);
        setActivePersona(null);
      }
    } catch (error) {
      console.error('[PersonaSelector] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaChange = (persona: Persona) => {
    setActivePersona(persona);
    localStorage.setItem('activePersonaId', persona.id);
  };

  const getDisplayName = (persona: Persona) => {
    return persona.fio_handle || `Persona ${persona.id.slice(0, 8)}`;
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
