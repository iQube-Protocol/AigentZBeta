/**
 * TriadCard - Premium card wrapper with Smart Content styling
 */

import React from 'react';

// Inline cn utility
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface TriadCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function TriadCard({ children, className, hover = false, glow = false, onClick }: TriadCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl",
        "transition-all duration-300",
        hover && "hover:scale-[1.02] hover:border-border/60 hover:shadow-lg hover:shadow-cyan-500/10",
        glow && "shadow-lg shadow-purple-500/20",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface TriadCardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TriadCardHeader({ title, subtitle, actions }: TriadCardHeaderProps) {
  return (
    <div className="flex items-start justify-between p-6 pb-4">
      <div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function TriadCardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}
