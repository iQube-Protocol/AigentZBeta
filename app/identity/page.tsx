'use client';

import { useState } from 'react';
import { PersonaSelector } from '@/components/identity/PersonaSelector';
import { IdentityStateToggle } from '@/components/identity/IdentityStateToggle';
import { ReputationBadge } from '@/components/identity/ReputationBadge';
import { PersonaCreationForm } from '@/components/identity/PersonaCreationForm';
import { FIOVerificationBadge } from '@/components/identity/FIOVerificationBadge';
import { FIOInfoCard } from '@/components/identity/FIOInfoCard';
import { Plus, Key } from 'lucide-react';

export default function IdentityPage() {
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [identityState, setIdentityState] = useState<'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable'>('semi_anonymous');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">DiDQube Identity System</h1>
        <p className="text-sm text-slate-300 mt-1">Manage personas, identity states, and reputation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-slate-100">Persona Selection</h3>
            <p className="text-sm text-slate-400">Choose your active persona</p>
          </div>
          <div>
            <PersonaSelector value={selectedPersona} onSelect={setSelectedPersona} />
            {selectedPersona && (
              <div className="mt-4 p-3 bg-slate-800/50 rounded-md border border-slate-700/50">
                <p className="text-sm font-medium text-slate-300">Selected Persona ID:</p>
                <p className="text-xs text-slate-400 font-mono mt-1">{selectedPersona}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-slate-100">Identity State</h3>
            <p className="text-sm text-slate-400">Select your privacy level for this interaction</p>
          </div>
          <div>
            <IdentityStateToggle value={identityState} onChange={setIdentityState} />
            <div className="mt-4 p-3 bg-slate-800/50 rounded-md border border-slate-700/50">
              <p className="text-sm font-medium text-slate-300">Current State:</p>
              <p className="text-xs text-slate-400 mt-1">{identityState.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-slate-100">Reputation</h3>
            <p className="text-sm text-slate-400">Your current reputation bucket</p>
          </div>
          <div>
            {selectedPersona ? (
              <ReputationBadge partitionId={selectedPersona} />
            ) : (
              <p className="text-sm text-slate-500">Select a persona to view reputation</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-slate-100">FIO Handle Management</h3>
            <p className="text-sm text-slate-400">Blockchain-verified identity handles</p>
          </div>
          <div className="space-y-2">
            <button 
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <Plus size={16} />
              {showCreateForm ? 'Cancel' : 'Create New Persona'}
            </button>
            <button 
              className="w-full px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              onClick={() => window.open('https://fio.bloks.io/', '_blank')}
            >
              <Key size={16} />
              View on FIO Explorer
            </button>
          </div>
        </div>
      </div>

      {/* FIO Info Card - Shows when persona is selected */}
      {selectedPersona && (
        <div className="mb-8">
          <FIOInfoCard key={refreshKey} personaId={selectedPersona} />
        </div>
      )}

      {/* Persona Creation Form */}
      {showCreateForm && (
        <div className="mb-8 rounded-lg border border-indigo-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <PersonaCreationForm
            onSuccess={(id) => {
              setShowCreateForm(false);
              setSelectedPersona(id);
              setRefreshKey(prev => prev + 1);
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-slate-100">API Endpoints</h3>
          <p className="text-sm text-slate-400">Available DiDQube API routes</p>
        </div>
        <div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">GET /api/identity/persona</code> <span className="text-slate-500">— List personas</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">POST /api/identity/persona</code> <span className="text-slate-500">— Create persona</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-indigo-400">POST /api/identity/fio/check-availability</code> <span className="text-slate-500">— Check FIO handle availability</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-indigo-400">POST /api/identity/fio/register</code> <span className="text-slate-500">— Register FIO handle</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-indigo-400">POST /api/identity/fio/verify</code> <span className="text-slate-500">— Verify FIO ownership</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-indigo-400">GET /api/identity/fio/lookup?handle=...</code> <span className="text-slate-500">— Lookup FIO handle</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">GET /api/identity/reputation/bucket?partitionId=...</code> <span className="text-slate-500">— Get reputation bucket</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">POST /api/identity/cohort/register-alias</code> <span className="text-slate-500">— Register cohort alias</span></li>
            <li><code className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">POST /api/identity/disputes</code> <span className="text-slate-500">— Submit dispute</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
