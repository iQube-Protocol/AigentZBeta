"use client";
import React from 'react';
import { Info } from 'lucide-react';

export interface AliasConsentToggleProps {
  consented: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

export const AliasConsentToggle: React.FC<AliasConsentToggleProps> = ({
  consented,
  onChange,
  label = "Allow FIO → DID alias binding",
  description = "Your FIO handle may be privately soft-bound to your DID for better UX. This does not expose your identity publicly. You can revoke any time.",
  className,
}) => {
  return (
    <div className={`flex items-start gap-2 ${className || ''}`}>
      <label htmlFor="alias-consent-toggle" className="relative mt-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center">
        <input
          id="alias-consent-toggle"
          type="checkbox"
          className="peer sr-only"
          checked={consented}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="h-4 w-4 rounded border border-cyan-300/40 bg-cyan-500/10 backdrop-blur-sm transition-all peer-hover:border-cyan-300/70 peer-checked:bg-cyan-400/25 peer-checked:border-cyan-300/80" />
        <span className="pointer-events-none absolute text-[11px] leading-none text-cyan-100 opacity-0 transition-opacity peer-checked:opacity-100">✓</span>
      </label>
      <div className="flex items-center gap-1">
        <label htmlFor="alias-consent-toggle" className="text-xs font-medium cursor-pointer text-slate-200">
          {label}
        </label>
        <span
          className="inline-flex items-center text-slate-400 cursor-help"
          title={description}
        >
          <Info size={12} />
        </span>
      </div>
    </div>
  );
};

export default AliasConsentToggle;
