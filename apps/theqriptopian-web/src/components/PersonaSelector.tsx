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
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('persona')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPersonas(data || []);
      if (data && data.length > 0) {
        // Set first persona as active by default
        const savedPersonaId = localStorage.getItem('activePersonaId');
        const active = savedPersonaId 
          ? data.find(p => p.id === savedPersonaId) || data[0]
          : data[0];
        setActivePersona(active);
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
      toast({
        title: "Error",
        description: "Failed to load personas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaChange = (persona: Persona) => {
    setActivePersona(persona);
    localStorage.setItem('activePersonaId', persona.id);
    toast({
      title: "Persona Changed",
      description: `Switched to ${persona.fio_handle || 'Anonymous'}`,
    });
  };

  const getPersonaDisplayName = (persona: Persona) => {
    return persona.fio_handle || `Persona ${persona.id.slice(0, 8)}`;
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <User className="h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  if (personas.length === 0) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 text-gray-400">
        <User className="h-4 w-4" />
        <span className="text-sm">No Personas</span>
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
            {activePersona ? getPersonaDisplayName(activePersona) : 'Select Persona'}
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
            <span>{getPersonaDisplayName(persona)}</span>
            {activePersona?.id === persona.id && (
              <span className="ml-auto text-xs text-cyan-400">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
