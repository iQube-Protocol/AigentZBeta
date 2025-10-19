"use client";

import React, { useState, useEffect } from 'react';
import { RefreshCw, User, Shield, TrendingUp, Bot, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { FIOVerificationIcon } from '@/components/identity/FIOVerificationBadge';

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
  world_id_status: string;
  created_at: string;
  reputation_bucket?: number | null;
  reputation_score?: number | null;
  reputation_category?: string | null;
  fio_status?: 'verified' | 'unverified' | 'pending' | 'expired' | 'expiring_soon' | 'no_handle' | 'failed';
  fio_days_until_expiration?: number | null;
}

interface DiDQubeIdentityCardProps {
  onPersonaClick?: (personaId: string) => void;
}

export function DiDQubeIdentityCard({ onPersonaClick }: DiDQubeIdentityCardProps = {}) {
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

  const getBucketColor = (bucket: number) => {
    if (bucket >= 4) return 'text-emerald-400';
    if (bucket >= 3) return 'text-green-400';
    if (bucket >= 2) return 'text-yellow-400';
    if (bucket >= 1) return 'text-orange-400';
    return 'text-red-400';
  };

  const isAgent = (worldIdStatus: string) => {
    return worldIdStatus === 'agent_declared';
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
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {personas.map(p => (
                <button
                  key={p.id}
                  onClick={() => onPersonaClick?.(p.id)}
                  className="w-full flex items-center justify-between p-3 rounded-md bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-indigo-500/50 transition-colors cursor-pointer text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/* Person vs Agent Icon */}
                      {isAgent(p.world_id_status) ? (
                        <Bot size={14} className="text-purple-400" aria-label="Agent" />
                      ) : (
                        <UserCircle size={14} className="text-blue-400" aria-label="Person" />
                      )}
                      
                      {/* Reputation Score and Badge */}
                      {p.reputation_score !== undefined && p.reputation_score !== null && (
                        <span className={`text-xs font-medium ${getBucketColor(p.reputation_bucket || 0)}`}>
                          {p.reputation_score}
                        </span>
                      )}
                      {p.reputation_bucket !== undefined && p.reputation_bucket !== null && (
                        <div className="flex items-center gap-1">
                          <TrendingUp size={10} className={getBucketColor(p.reputation_bucket)} />
                          <span className={`text-xs font-medium ${getBucketColor(p.reputation_bucket)}`}>
                            {p.reputation_bucket}
                          </span>
                        </div>
                      )}
                      
                      {/* FIO Verification Icon */}
                      {p.fio_status && p.fio_status !== 'no_handle' && (
                        <FIOVerificationIcon status={p.fio_status} size={12} />
                      )}
                      
                      {/* Handle */}
                      <span className="font-mono text-xs text-slate-300">
                        {p.fio_handle || p.id.slice(0, 8)}
                      </span>
                      
                      {/* Verified Badge */}
                      {p.world_id_status === 'verified_human' && (
                        <Shield size={12} className="text-green-400" aria-label="Verified Human" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-6">
                      <span className={`text-xs ${stateColors[p.default_identity_state] || 'text-slate-400'}`}>
                        {p.default_identity_state.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {personas.length > 4 && (
              <p className="text-xs text-slate-500 text-center mt-2">
                Scroll to see all {personas.length} personas
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
