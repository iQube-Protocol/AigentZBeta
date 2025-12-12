import { useState } from "react";
import { Zap, BookOpen, Cog, DollarSign, Wrench, Building2, Mail, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type Domain = 'signals' | 'mythos' | 'logos' | 'markets' | 'builders' | 'city' | 'dispatches' | 'profile' | 'settings';

interface IconBarProps {
  activeDomain: Domain | null;
  onDomainClick: (domain: Domain) => void;
}

const domains = [
  { id: 'signals' as Domain, icon: Zap, label: 'Signals', color: 'text-cyan-500' },
  { id: 'mythos' as Domain, icon: BookOpen, label: 'Mythos', color: 'text-purple-500' },
  { id: 'logos' as Domain, icon: Cog, label: 'Logos', color: 'text-blue-500' },
  { id: 'markets' as Domain, icon: DollarSign, label: 'Markets', color: 'text-green-500' },
  { id: 'builders' as Domain, icon: Wrench, label: 'Builders', color: 'text-orange-500' },
  { id: 'city' as Domain, icon: Building2, label: 'City', color: 'text-yellow-500' },
  { id: 'dispatches' as Domain, icon: Mail, label: 'Dispatches', color: 'text-pink-500' },
];

const systemItems = [
  { id: 'profile' as Domain, icon: User, label: 'Profile' },
  { id: 'settings' as Domain, icon: Settings, label: 'Settings' },
];

export function IconBar({ activeDomain, onDomainClick }: IconBarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed left-0 top-0 bottom-0 w-16 bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 z-50">
        {/* Logo */}
        <div className="mb-8 group cursor-pointer">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary relative overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(94,234,212,0.4)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </div>

        {/* Primary Domains */}
        <div className="flex-1 flex flex-col gap-3">
          {domains.map((domain) => {
            const Icon = domain.icon;
            const isActive = activeDomain === domain.id;
            
            return (
              <Tooltip key={domain.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDomainClick(domain.id)}
                    className={cn(
                      "group relative w-12 h-12 rounded-xl flex items-center justify-center",
                      "transition-all duration-300",
                      "hover:scale-110",
                      isActive 
                        ? "bg-gradient-to-br from-primary/20 to-secondary/20 text-primary shadow-[0_0_20px_rgba(94,234,212,0.3)]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {/* Glow effect on hover */}
                    <div className={cn(
                      "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      "bg-gradient-to-br from-primary/10 to-secondary/10"
                    )} />
                    
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                    )}
                    
                    <Icon className={cn(
                      "h-5 w-5 relative z-10 transition-all duration-300",
                      isActive && "drop-shadow-[0_0_8px_rgba(94,234,212,0.6)]"
                    )} />
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className="bg-card/95 backdrop-blur-sm text-foreground border-white/10 shadow-elevated"
                >
                  <span className="font-medium">{domain.label}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
        
        {/* System Items */}
        <div className="flex flex-col gap-3">
          {systemItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDomainClick(item.id)}
                    className={cn(
                      "group relative w-12 h-12 rounded-xl flex items-center justify-center",
                      "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      "transition-all duration-300 hover:scale-110"
                    )}
                  >
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/5" />
                    <Icon className="h-5 w-5 relative z-10" />
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className="bg-card/95 backdrop-blur-sm text-foreground border-white/10 shadow-elevated"
                >
                  <span className="font-medium">{item.label}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
