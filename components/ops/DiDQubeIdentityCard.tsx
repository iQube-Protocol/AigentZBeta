"use client";

import React, { useState, useEffect } from 'react';
import { RefreshCw, User, Shield } from 'lucide-react';

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
  world_id_status: string;
  created_at: string;
}

export function DiDQubeIdentityCard() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPersonas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/identity/persona');
      const data = await res.json();
      if (data.ok) {
        setPersonas(data.data || []);
      } else {
        setError(data.error || 'Failed to load personas');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const stateColors: Record<string, string> = {
    anonymous: 'text-gray-400',
    semi_anonymous: 'text-blue-400',
    semi_identifiable: 'text-yellow-400',
    identifiable: 'text-green-400'
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User size={20} className="text-indigo-400" />
          <h2 className="text-xl font-semibold text-slate-100">DiDQube Identity</h2>
        </div>
        <button
          onClick={loadPersonas}
          disabled={loading}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-3 text-sm text-slate-300">
        {loading && <p className="text-slate-400">Loading personas...</p>}
        {error && <p className="text-red-400">Error: {error}</p>}
        
        {!loading && !error && personas.length === 0 && (
          <div className="text-center py-4">
            <p className="text-slate-400 mb-2">No personas found</p>
            <p className="text-xs text-slate-500">Create one via API or QubeBase migration</p>
          </div>
        )}

        {!loading && !error && personas.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Total Personas: {personas.length}</span>
              <a href="/identity" className="text-indigo-400 hover:text-indigo-300">View All →</a>
            </div>
            
            <div className="space-y-2">
              {personas.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-md bg-slate-800/50 border border-slate-700/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        {p.fio_handle || p.id.slice(0, 8)}
                      </span>
                      {p.world_id_status === 'verified_human' && (
                        <Shield size={12} className="text-green-400" aria-label="Verified Human" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${stateColors[p.default_identity_state] || 'text-slate-400'}`}>
                        {p.default_identity_state.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {personas.length > 3 && (
              <p className="text-xs text-slate-500 text-center mt-2">
                +{personas.length - 3} more personas
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
