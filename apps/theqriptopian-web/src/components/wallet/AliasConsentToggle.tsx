/**
 * AliasConsentToggle - Identity consent management
 */
import React from 'react';
import { Shield, ShieldCheck } from 'lucide-react';

interface Props {
  consented: boolean;
  onChange: (consented: boolean) => void;
}

export function AliasConsentToggle({ consented, onChange }: Props) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-center gap-2">
        {consented ? (
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        ) : (
          <Shield className="w-4 h-4 text-slate-400" />
        )}
        <div>
          <div className="text-sm text-white">Alias Consent</div>
          <div className="text-xs text-white/50">Allow x402 to use your alias for payments</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!consented)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          consented ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20' : 'bg-white/10 ring-1 ring-white/20'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
            consented ? 'left-6 bg-emerald-400' : 'left-1 bg-white/40'
          }`}
        />
      </button>
    </div>
  );
}

export default AliasConsentToggle;
