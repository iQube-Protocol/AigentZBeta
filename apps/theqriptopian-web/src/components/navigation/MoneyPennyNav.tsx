import { Droplets, BookOpen, Code2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Published Issue #0 v0.1 - Active Domains Only
 * 3 domains: PennyDrops, Scrolls, Kn0wdZ
 */
export type Domain = 'pennydrops' | 'scrolls' | 'kn0wdz';

interface MoneyPennyNavProps {
  activeDomain: Domain | null;
  onDomainClick: (domain: Domain) => void;
  onAIClick: () => void;
}

const domains = [
  {
    id: 'pennydrops' as Domain,
    icon: Droplets,
    label: 'Penny Drops'
  },
  {
    id: 'scrolls' as Domain,
    icon: BookOpen,
    label: 'Scrolls'
  },
  {
    id: 'kn0wdz' as Domain,
    icon: Code2,
    label: 'Kn0wdZ'
  }
];

const navItems = [
  ...domains,
];
export function MoneyPennyNav({
  activeDomain,
  onDomainClick,
  onAIClick
}: MoneyPennyNavProps) {
  return <TooltipProvider delayDuration={0}>
      <aside className="fixed right-0 top-1/2 -translate-y-1/2 w-16 flex flex-col items-center py-6 z-50">
        {/* Navigation Icons */}
        <nav className="flex flex-col gap-2 w-full px-2">
          {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeDomain === item.id;
          
          return <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => onDomainClick(item.id as Domain)} 
                    className={cn("w-full h-12 rounded-lg flex items-center justify-center transition-all relative group", isActive ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10")}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r" />}
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-[#071327] text-[#d0f6ff] border-[#1e2b40]">
                  {item.label}
                </TooltipContent>
              </Tooltip>;
        })}
          
          {/* AI Assistant Icon */}
          <div className="mt-4 pt-4 border-t border-[#1e2b40]">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAIClick}
                  className="w-full h-12 rounded-lg flex items-center justify-center transition-all text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10"
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
    </TooltipProvider>;
}