"use client";

import React, { useState } from 'react';
import { User, Loader2, CheckCircle } from 'lucide-react';
import { FIOHandleInput } from './FIOHandleInput';
import { FIORegistrationModal } from './FIORegistrationModal';

interface PersonaCreationFormProps {
  onSuccess?: (personaId: string) => void;
  onCancel?: () => void;
}

export function PersonaCreationForm({ onSuccess, onCancel }: PersonaCreationFormProps) {
  const [fioHandle, setFioHandle] = useState('');
  const [fioHandleValid, setFioHandleValid] = useState(false);
  const [identityState, setIdentityState] = useState<'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable'>('semi_anonymous');
  const [worldIdStatus, setWorldIdStatus] = useState<'not_verified' | 'verified_human' | 'agent_declared'>('not_verified');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPersonaId, setCreatedPersonaId] = useState<string | null>(null);
  const [showFIORegistration, setShowFIORegistration] = useState(false);

  const handleCreatePersona = async () => {
    if (!fioHandle || !fioHandleValid) {
      setError('Please enter a valid FIO handle');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/identity/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fioHandle,
          defaultState: identityState,
          worldIdStatus
        })
      });

      const data = await response.json();

      if (data.ok && data.data) {
        setCreatedPersonaId(data.data.id);
        // Optionally open FIO registration modal
        if (fioHandleValid) {
          setShowFIORegistration(true);
        } else {
          onSuccess?.(data.data.id);
        }
      } else {
        setError(data.error || 'Failed to create persona');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleFIORegistrationSuccess = () => {
    setShowFIORegistration(false);
    if (createdPersonaId) {
      onSuccess?.(createdPersonaId);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-slate-200 mb-2 flex items-center gap-2">
            <User size={20} className="text-indigo-400" />
            Create New Persona
          </h3>
          <p className="text-sm text-slate-400">
            Create a new persona with a FIO handle for decentralized identity.
          </p>
        </div>

        {/* FIO Handle Input */}
        <FIOHandleInput
          value={fioHandle}
          onChange={setFioHandle}
          onVerificationChange={setFioHandleValid}
          required
        />

        {/* Identity State */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Default Identity State <span className="text-red-400">*</span>
          </label>
          <select
            value={identityState}
            onChange={(e) => setIdentityState(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="anonymous">Anonymous</option>
            <option value="semi_anonymous">Semi-Anonymous</option>
            <option value="semi_identifiable">Semi-Identifiable</option>
            <option value="identifiable">Identifiable</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Controls how much identity information is revealed
          </p>
        </div>

        {/* World ID Status */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Entity Type <span className="text-red-400">*</span>
          </label>
          <select
            value={worldIdStatus}
            onChange={(e) => setWorldIdStatus(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="not_verified">Not Verified</option>
            <option value="verified_human">Verified Human</option>
            <option value="agent_declared">AI Agent</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Declare if this persona represents a human or AI agent
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-700 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {createdPersonaId && !showFIORegistration && (
          <div className="p-3 bg-green-900/20 border border-green-700 rounded-md flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            <p className="text-sm text-green-400">Persona created successfully!</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={creating}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleCreatePersona}
            disabled={creating || !fioHandle || !fioHandleValid}
            className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Persona'
            )}
          </button>
        </div>

        {/* FIO Registration Note */}
        {fioHandleValid && !createdPersonaId && (
          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-md">
            <p className="text-xs text-blue-400">
              💡 After creating the persona, you'll be prompted to register your FIO handle on the blockchain.
            </p>
          </div>
        )}
      </div>

      {/* FIO Registration Modal */}
      {showFIORegistration && createdPersonaId && (
        <FIORegistrationModal
          isOpen={showFIORegistration}
          onClose={() => {
            setShowFIORegistration(false);
            // Don't call onSuccess here - let the user see the success modal first
          }}
          personaId={createdPersonaId}
          onSuccess={handleFIORegistrationSuccess}
        />
      )}
    </>
  );
}
