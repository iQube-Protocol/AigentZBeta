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
      <input
        id="alias-consent-toggle"
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-slate-300"
        checked={consented}
        onChange={(e) => onChange?.(e.target.checked)}
      />
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
