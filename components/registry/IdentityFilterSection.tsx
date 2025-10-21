"use client";
import React, { useState, useEffect } from "react";
import { Shield, User, TrendingUp } from "lucide-react";

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
}

interface IdentityFilterProps {
  selectedPersona: string;
  onPersonaChange: (personaId: string) => void;
  minReputationBucket: number;
  onReputationChange: (bucket: number) => void;
  className?: string;
}

export function IdentityFilterSection({ 
  selectedPersona, 
  onPersonaChange, 
  minReputationBucket, 
  onReputationChange,
  className 
}: IdentityFilterProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/identity/persona')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setPersonas(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const label = "text-[12px] text-slate-400 mb-2";
  const select = "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/50";

  return (
    <div className={`rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-4 ${className || ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left mb-3"
      >
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">DiDQube Identity Filters</span>
          <span className="text-xs text-slate-500">(Optional)</span>
        </div>
        <span className="text-slate-400">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="grid gap-3 md:grid-cols-2 mt-3">
          <div>
            <div className={label}>
              <User size={12} className="inline mr-1" />
              Active Persona
            </div>
            <select
              value={selectedPersona}
              onChange={(e) => onPersonaChange(e.target.value)}
              className={select}
              disabled={loading}
              aria-label="Persona"
            >
              <option value="">No persona filter</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.fio_handle || p.id.slice(0, 8)} — {p.default_identity_state.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {loading && <p className="text-xs text-slate-500 mt-1">Loading personas...</p>}
          </div>

          <div>
            <div className={label}>
              <TrendingUp size={12} className="inline mr-1" />
              Min Reputation Bucket
            </div>
            <select
              value={minReputationBucket}
              onChange={(e) => onReputationChange(Number(e.target.value))}
              className={select}
              aria-label="Min Reputation"
            >
              <option value="0">No reputation filter</option>
              <option value="1">Bucket 1+ (Moderate)</option>
              <option value="2">Bucket 2+ (Good)</option>
              <option value="3">Bucket 3+ (Excellent)</option>
              <option value="4">Bucket 4+ (Outstanding)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Filter templates by minimum reputation requirement
            </p>
          </div>
        </div>
      )}

      {!expanded && selectedPersona && (
        <div className="text-xs text-slate-400 mt-2">
          Active: {personas.find(p => p.id === selectedPersona)?.fio_handle || selectedPersona.slice(0, 8)}
        </div>
      )}
    </div>
  );
}
