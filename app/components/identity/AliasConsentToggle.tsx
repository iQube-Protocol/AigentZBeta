"use client";
import React from 'react';

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
    <div className={`flex items-start gap-3 p-3 rounded-md bg-white/5 ring-1 ring-white/10 ${className || ''}`}>
      <input
        id="alias-consent-toggle"
        type="checkbox"
        className="mt-1 h-4 w-4 accent-slate-300"
        checked={consented}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <div className="flex-1">
        <label htmlFor="alias-consent-toggle" className="font-medium cursor-pointer text-slate-200">
          {label}
        </label>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  );
};

export default AliasConsentToggle;
