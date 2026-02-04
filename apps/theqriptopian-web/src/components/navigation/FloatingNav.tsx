import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, BookOpen, TrendingUp, Building2, Radio, Newspaper, Sparkles } from "lucide-react";

export type Domain = 'signals' | 'mythos' | 'logos' | 'markets' | 'builders' | 'city' | 'dispatches';

interface FloatingNavProps {
  activeDomain: Domain | null;
  onDomainClick: (domain: Domain) => void;
}

const domains = [
  { id: 'signals' as Domain, icon: Activity, label: 'Signals', color: 'text-cyan-400' },
  { id: 'mythos' as Domain, icon: BookOpen, label: 'Mythos', color: 'text-purple-400' },
  { id: 'logos' as Domain, icon: Sparkles, label: 'Logos', color: 'text-emerald-400' },
  { id: 'markets' as Domain, icon: TrendingUp, label: 'Markets', color: 'text-teal-400' },
  { id: 'builders' as Domain, icon: Building2, label: 'Builders', color: 'text-orange-400' },
  { id: 'city' as Domain, icon: Radio, label: 'City', color: 'text-pink-400' },
  { id: 'dispatches' as Domain, icon: Newspaper, label: 'Dispatches', color: 'text-blue-400' },
];

export function FloatingNav({ activeDomain, onDomainClick }: FloatingNavProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed right-8 bottom-6 z-50 flex flex-col gap-3">
        {domains.map((domain) => {
          const Icon = domain.icon;
          const isActive = activeDomain === domain.id;
          
          return (
            <Tooltip key={domain.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDomainClick(domain.id)}
                  className={`
                    w-12 h-12 rounded-full border-2 
                    flex items-center justify-center
                    transition-all duration-200
                    ${isActive 
                      ? `${domain.color} bg-current/10 border-current shadow-lg scale-110` 
                      : 'text-gray-400 border-gray-600/50 bg-[#0a1628]/80 backdrop-blur-sm hover:border-gray-400 hover:text-gray-200'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-[#1a2942] border-[#2a3952] text-gray-200">
                {domain.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
