"use client";

import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, TrendingUp, FileText, CheckCircle, XCircle, AlertTriangle, Bot, UserCircle, Shield } from 'lucide-react';
import { EvidenceSubmissionForm } from '@/components/identity/EvidenceSubmissionForm';
import { FIOVerificationIcon } from '@/components/identity/FIOVerificationBadge';

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
  world_id_status: string;
  reputation_bucket?: number | null;
  reputation_score?: number | null;
  reputation_partition_id?: string | null;
  reputation_evidence_count?: number | null;
  fio_status?: 'verified' | 'unverified' | 'pending' | 'expired' | 'expiring_soon' | 'no_handle' | 'failed';
  fio_days_until_expiration?: number | null;
}

interface ReputationBucket {
  id: string;
  persona_id: string;
  partition_id: string;
  rqh_bucket_id: string | null;
  skill_category: string;
  bucket_level: number | null;
  score: number | null;
  evidence_count: number;
  last_synced_at: string | null;
}

export default function ReputationAdminPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [reputationDetails, setReputationDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [skillCategory, setSkillCategory] = useState('blockchain_development');
  const [initialScore, setInitialScore] = useState(50);

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

  const loadReputationDetails = async (personaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/identity/persona/${personaId}/reputation`);
      const data = await res.json();
      if (data.ok) {
        setReputationDetails(data.data);
      } else {
        setError(data.error || 'Failed to load reputation');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const createReputationBucket = async () => {
    if (!selectedPersona) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/identity/persona/${selectedPersona.id}/reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillCategory,
          initialScore
        })
      });

      const data = await res.json();
      if (data.ok) {
        setCreateMode(false);
        await loadReputationDetails(selectedPersona.id);
        await loadPersonas();
      } else {
        setError(data.error || 'Failed to create reputation bucket');
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

  useEffect(() => {
    if (selectedPersona) {
      loadReputationDetails(selectedPersona.id);
      setCreateMode(false);
    } else {
      setReputationDetails(null);
    }
  }, [selectedPersona]);

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

  const getBucketLabel = (bucket: number | null | undefined) => {
    if (bucket === null || bucket === undefined) return 'No Reputation';
    if (bucket >= 4) return 'Excellent';
    if (bucket >= 3) return 'Good';
    if (bucket >= 2) return 'Fair';
    if (bucket >= 1) return 'Poor';
    return 'Very Low';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Reputation Management</h1>
          <p className="text-slate-400">Manage persona reputation buckets and evidence</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personas List */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-indigo-400" />
                  <h2 className="text-lg font-semibold">Personas</h2>
                </div>
                <button
                  onClick={loadPersonas}
                  disabled={loading}
                  className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
                  aria-label="Refresh"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-md">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {personas.map(persona => (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona)}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedPersona?.id === persona.id
                        ? 'bg-indigo-900/30 border-indigo-500'
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Person vs Agent Icon */}
                          {isAgent(persona.world_id_status) ? (
                            <Bot size={14} className="text-purple-400" aria-label="Agent" />
                          ) : (
                            <UserCircle size={14} className="text-blue-400" aria-label="Person" />
                          )}
                          
                          {/* Reputation Badge - moved to left */}
                          {persona.reputation_bucket !== null && persona.reputation_bucket !== undefined ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp size={10} className={getBucketColor(persona.reputation_bucket)} />
                              <span className={`text-xs font-medium ${getBucketColor(persona.reputation_bucket)}`}>
                                {persona.reputation_bucket}
                              </span>
                            </div>
                          ) : null}
                          
                          {/* FIO Verification Icon */}
                          {persona.fio_status && persona.fio_status !== 'no_handle' && (
                            <FIOVerificationIcon status={persona.fio_status} size={12} />
                          )}
                          
                          {/* Handle */}
                          <p className="font-mono text-xs text-slate-300 truncate">
                            {persona.fio_handle || persona.id.slice(0, 12)}
                          </p>
                          
                          {/* Verified Badge */}
                          {persona.world_id_status === 'verified_human' && (
                            <Shield size={12} className="text-green-400" aria-label="Verified Human" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-6">
                          {persona.reputation_bucket === null || persona.reputation_bucket === undefined ? (
                            <span className="text-xs text-slate-500">No reputation</span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {persona.default_identity_state?.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reputation Details */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedPersona && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-12 text-center">
                <Users size={48} className="mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400">Select a persona to view reputation details</p>
              </div>
            )}

            {selectedPersona && !reputationDetails?.reputation && !createMode && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-8 text-center">
                <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
                <p className="text-slate-300 mb-4">No reputation bucket found for this persona</p>
                <button
                  onClick={() => setCreateMode(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Reputation Bucket
                </button>
              </div>
            )}

            {selectedPersona && createMode && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
                <h3 className="text-lg font-semibold mb-4">Create Reputation Bucket</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Skill Category
                    </label>
                    <select
                      value={skillCategory}
                      onChange={(e) => setSkillCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
                    >
                      <option value="blockchain_development">Blockchain Development</option>
                      <option value="smart_contracts">Smart Contracts</option>
                      <option value="defi">DeFi</option>
                      <option value="nft">NFT</option>
                      <option value="web3">Web3</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Initial Score: {initialScore}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={initialScore}
                      onChange={(e) => setInitialScore(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={createReputationBucket}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => setCreateMode(false)}
                      className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedPersona && reputationDetails?.reputation && (
              <>
                {/* Reputation Stats */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={20} className="text-emerald-400" />
                    <h3 className="text-lg font-semibold">Reputation Stats</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-md">
                      <p className="text-xs text-slate-400 mb-1">Bucket Level</p>
                      <p className={`text-2xl font-bold ${getBucketColor(reputationDetails.reputation.bucket)}`}>
                        {reputationDetails.reputation.bucket}
                      </p>
                      <p className={`text-xs ${getBucketColor(reputationDetails.reputation.bucket)}`}>
                        {getBucketLabel(reputationDetails.reputation.bucket)}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-md">
                      <p className="text-xs text-slate-400 mb-1">Score</p>
                      <p className="text-2xl font-bold text-slate-200">
                        {reputationDetails.reputation.score?.toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-500">out of 100</p>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-md">
                      <p className="text-xs text-slate-400 mb-1">Evidence</p>
                      <p className="text-2xl font-bold text-slate-200">
                        {reputationDetails.reputation.evidence_count}
                      </p>
                      <p className="text-xs text-slate-500">submissions</p>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-md">
                      <p className="text-xs text-slate-400 mb-1">Category</p>
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {reputationDetails.reputation.skill_category}
                      </p>
                      <p className="text-xs text-slate-500">skill type</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Partition ID:</span>
                      <span className="font-mono text-slate-300">{selectedPersona.id}</span>
                    </div>
                    {reputationDetails.reputation.supabase_synced && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-green-400">
                        <CheckCircle size={12} />
                        <span>Synced with Supabase</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence Submission */}
                <EvidenceSubmissionForm
                  bucketId={reputationDetails.reputation.id}
                  partitionId={selectedPersona.id}
                  onSuccess={() => loadReputationDetails(selectedPersona.id)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
