'use client';

import { useState } from 'react';
import { PersonaSelector } from '@/components/identity/PersonaSelector';
import { IdentityStateToggle } from '@/components/identity/IdentityStateToggle';
import { ReputationBadge } from '@/components/identity/ReputationBadge';

export default function IdentityPage() {
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [identityState, setIdentityState] = useState<'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable'>('semi_anonymous');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">DiDQube Identity System</h1>
        <p className="text-muted-foreground">Manage personas, identity states, and reputation</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Persona Selection</h3>
            <p className="text-sm text-gray-400">Choose your active persona</p>
          </div>
          <div>
            <PersonaSelector value={selectedPersona} onSelect={setSelectedPersona} />
            {selectedPersona && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">Selected Persona ID:</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedPersona}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Identity State</h3>
            <p className="text-sm text-gray-400">Select your privacy level for this interaction</p>
          </div>
          <div>
            <IdentityStateToggle value={identityState} onChange={setIdentityState} />
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Current State:</p>
              <p className="text-xs text-muted-foreground">{identityState.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Reputation</h3>
            <p className="text-sm text-gray-400">Your current reputation bucket</p>
          </div>
          <div>
            {selectedPersona ? (
              <ReputationBadge partitionId={selectedPersona} />
            ) : (
              <p className="text-sm text-muted-foreground">Select a persona to view reputation</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Quick Actions</h3>
            <p className="text-sm text-gray-400">Identity management actions</p>
          </div>
          <div className="space-y-2">
            <button 
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              onClick={() => window.location.href = '/api/identity/persona'}
            >
              View All Personas (API)
            </button>
            <button 
              className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
              disabled={!selectedPersona}
            >
              Register Alias (Coming Soon)
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">API Endpoints</h3>
          <p className="text-sm text-gray-400">Available DiDQube API routes</p>
        </div>
        <div>
          <ul className="space-y-2 text-sm">
            <li><code className="bg-muted px-2 py-1 rounded">GET /api/identity/persona</code> — List personas</li>
            <li><code className="bg-muted px-2 py-1 rounded">POST /api/identity/persona</code> — Create persona</li>
            <li><code className="bg-muted px-2 py-1 rounded">GET /api/identity/reputation/bucket?partitionId=...</code> — Get reputation bucket</li>
            <li><code className="bg-muted px-2 py-1 rounded">POST /api/identity/cohort/register-alias</code> — Register cohort alias</li>
            <li><code className="bg-muted px-2 py-1 rounded">POST /api/identity/disputes</code> — Submit dispute</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
