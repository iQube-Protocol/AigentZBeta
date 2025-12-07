import { Droplets, Code2, BookOpen, Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Domain } from "./MoneyPennyNav";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeDomain: Domain | null;
  onDomainClick: (domain: Domain) => void;
  onAIClick: () => void;
}

// Issue #0 v0.1 - Three active domains
const domains = [
  { id: 'pennydrops' as Domain, icon: Droplets, label: 'Penny Drops' },
  { id: 'scrolls' as Domain, icon: BookOpen, label: 'Scrolls' },
  { id: 'kn0wdz' as Domain, icon: Code2, label: 'Kn0wdZ' }
];

export function MobileNav({ isOpen, onClose, activeDomain, onDomainClick, onAIClick }: MobileNavProps) {
  if (!isOpen) return null;

  return (
    <TooltipProvider delayDuration={0}>
      {/* Backdrop - tap anywhere to close */}
      <div 
        className="fixed inset-0 z-[60] md:hidden"
        onClick={onClose}
      />
      
      {/* Mobile: Floating icon menu with subtle shadow - flush with right edge */}
      <aside className="fixed right-1 top-1/2 -translate-y-1/2 z-[70] md:hidden">
        <nav className="flex flex-col gap-1 p-1 bg-black/40 backdrop-blur-sm rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          {domains.map((domain) => {
            const Icon = domain.icon;
            const isActive = activeDomain === domain.id;
            
            return (
              <Tooltip key={domain.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      onDomainClick(domain.id);
                      onClose();
                    }}
                    className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center transition-all relative",
                      isActive 
                        ? "bg-cyan-500/20 text-cyan-400" 
                        : "text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r" />
                    )}
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-[#071327] text-[#d0f6ff] border-[#1e2b40]">
                  {domain.label}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* AI Assistant */}
          <div className="mt-2 pt-2 border-t border-border/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    onAIClick();
                    onClose();
                  }}
                  className="w-12 h-12 rounded-lg flex items-center justify-center transition-all text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20"
                >
                  <Bot className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-[#071327] text-[#d0f6ff] border-[#1e2b40]">
                AI Assistant
              </TooltipContent>
            </Tooltip>
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
