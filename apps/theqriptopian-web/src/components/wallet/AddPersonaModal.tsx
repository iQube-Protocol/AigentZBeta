/**
 * AddPersonaModal - Modal for creating new personas (human or agent)
 * 
 * Allows users to:
 * - Create a new human persona with FIO handle
 * - Add an existing agent persona (e.g., Aigent Z, Dev Agent)
 */

import { useState } from 'react';
import { X, User, Bot, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonaCreated: () => void;
}

// Pre-defined agent personas - all agents use @aigent domain
const AVAILABLE_AGENTS = [
  {
    id: 'aigent-z',
    name: 'Aigent Z',
    fioHandle: 'aigentz@aigent',
    description: 'Primary operations agent for cross-chain transactions',
  },
  {
    id: 'aigent-moneypenny',
    name: 'Aigent MoneyPenny',
    fioHandle: 'moneypenny@aigent',
    description: 'Treasury and financial operations agent',
  },
  {
    id: 'aigent-kn0w1',
    name: 'Aigent Kn0w1',
    fioHandle: 'kn0w1@aigent',
    description: 'Knowledge and research agent',
  },
  {
    id: 'aigent-nakamoto',
    name: 'Aigent Nakamoto',
    fioHandle: 'nakamoto@aigent',
    description: 'Crypto operations and DeFi agent',
  },
];

// Human domains - agents cannot use these
const HUMAN_DOMAINS = ['qripto', 'knyt'] as const;
type HumanDomain = typeof HUMAN_DOMAINS[number];

type PersonaType = 'human' | 'agent';
type Step = 'select-type' | 'human-form' | 'agent-select';

export function AddPersonaModal({ isOpen, onClose, onPersonaCreated }: AddPersonaModalProps) {
  const [step, setStep] = useState<Step>('select-type');
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);
  const [fioHandle, setFioHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<HumanDomain>('qripto');

  const resetForm = () => {
    setStep('select-type');
    setPersonaType(null);
    setFioHandle('');
    setDisplayName('');
    setSelectedAgent(null);
    setError(null);
    setHandleAvailable(null);
    setSelectedDomain('qripto');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Check FIO handle availability
  const checkHandleAvailability = async (handle: string, domain: HumanDomain = selectedDomain) => {
    if (!handle || handle.length < 3) {
      setHandleAvailable(null);
      return;
    }

    // Prevent humans from using @aigent domain
    if (domain === 'aigent' as any) {
      setHandleAvailable(false);
      setError('The @aigent domain is reserved for AI agents only');
      return;
    }

    setIsCheckingHandle(true);
    try {
      const fullHandle = `${handle}@${domain}`;
      const { data, error } = await supabase
        .from('persona')
        .select('id')
        .eq('fio_handle', fullHandle)
        .maybeSingle();

      if (error) throw error;
      setHandleAvailable(!data); // Available if no existing persona found
    } catch (e) {
      console.error('Error checking handle:', e);
      setHandleAvailable(null);
    } finally {
      setIsCheckingHandle(false);
    }
  };

  // Create human persona
  const createHumanPersona = async () => {
    if (!fioHandle || !handleAvailable) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fullHandle = `${fioHandle}@${selectedDomain}`;

      // Generate wallet keys
      const { Wallet } = await import('ethers');
      const wallet = Wallet.createRandom();

      // Create persona
      const { data: persona, error: personaError } = await supabase
        .from('persona')
        .insert({
          fio_handle: fullHandle,
          fio_public_key: wallet.publicKey,
          default_identity_state: 'semi_anonymous',
          world_id_status: 'verified_human',
          app_origin: 'theqriptopian',
        })
        .select()
        .single();

      if (personaError) throw personaError;

      // Update profile to use new persona (optional - could keep existing)
      if (persona?.id) {
        await supabase
          .from('profiles')
          .update({
            persona_id: persona.id,
            display_name: displayName || fioHandle,
          })
          .eq('id', user.id);
      }

      onPersonaCreated();
      handleClose();
    } catch (e: any) {
      console.error('Error creating persona:', e);
      setError(e.message || 'Failed to create persona');
    } finally {
      setIsLoading(false);
    }
  };

  // Add agent persona
  const addAgentPersona = async () => {
    if (!selectedAgent) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const agent = AVAILABLE_AGENTS.find(a => a.id === selectedAgent);
      if (!agent) throw new Error('Agent not found');

      // Check if this agent persona already exists
      const { data: existingPersona } = await supabase
        .from('persona')
        .select('id')
        .eq('fio_handle', agent.fioHandle)
        .maybeSingle();

      let personaId: string;

      if (existingPersona) {
        // Use existing agent persona
        personaId = existingPersona.id;
      } else {
        // Create new agent persona
        const { Wallet } = await import('ethers');
        const wallet = Wallet.createRandom();

        const { data: newPersona, error: personaError } = await supabase
          .from('persona')
          .insert({
            fio_handle: agent.fioHandle,
            fio_public_key: wallet.publicKey,
            default_identity_state: 'semi_anonymous',
            world_id_status: 'agent_declared',
            app_origin: 'theqriptopian',
          })
          .select()
          .single();

        if (personaError) throw personaError;
        personaId = newPersona.id;
      }

      // Update profile to use agent persona
      await supabase
        .from('profiles')
        .update({
          persona_id: personaId,
          display_name: agent.name,
        })
        .eq('id', user.id);

      onPersonaCreated();
      handleClose();
    } catch (e: any) {
      console.error('Error adding agent persona:', e);
      setError(e.message || 'Failed to add agent persona');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {step === 'select-type' && 'Add Persona'}
            {step === 'human-form' && 'Create Human Persona'}
            {step === 'agent-select' && 'Add Agent Persona'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step: Select Type */}
          {step === 'select-type' && (
            <div className="space-y-4">
              <p className="text-sm text-white/60 mb-4">
                Choose the type of persona you want to add:
              </p>
              
              <button
                onClick={() => {
                  setPersonaType('human');
                  setStep('human-form');
                }}
                className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white group-hover:text-cyan-300 transition-colors">Human Persona</p>
                  <p className="text-sm text-white/50">Create a new identity with your own FIO handle</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setPersonaType('agent');
                  setStep('agent-select');
                }}
                className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white group-hover:text-purple-300 transition-colors">Agent Persona</p>
                  <p className="text-sm text-white/50">Add an AI agent like Aigent Z or Dev Agent</p>
                </div>
              </button>
            </div>
          )}

          {/* Step: Human Form */}
          {step === 'human-form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  FIO Handle
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fioHandle}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                      setFioHandle(value);
                      checkHandleAvailability(value);
                    }}
                    placeholder="yourhandle"
                    className="w-full px-4 py-3 pr-24 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <select
                    value={selectedDomain}
                    onChange={(e) => {
                      const domain = e.target.value as HumanDomain;
                      setSelectedDomain(domain);
                      if (fioHandle) checkHandleAvailability(fioHandle, domain);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 border border-white/20 rounded px-2 py-1 text-white/70 text-sm focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="qripto" className="bg-slate-800">@qripto</option>
                    <option value="knyt" className="bg-slate-800">@knyt</option>
                  </select>
                </div>
                {isCheckingHandle && (
                  <p className="mt-1 text-xs text-white/50 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking availability...
                  </p>
                )}
                {handleAvailable === true && fioHandle && (
                  <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {fioHandle}@{selectedDomain} is available
                  </p>
                )}
                {handleAvailable === false && fioHandle && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This handle is already taken
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep('select-type')}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={createHumanPersona}
                  disabled={!fioHandle || !handleAvailable || isLoading}
                  className="flex-1 px-4 py-3 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Persona'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Agent Select */}
          {step === 'agent-select' && (
            <div className="space-y-4">
              <p className="text-sm text-white/60 mb-4">
                Select an agent to add to your personas:
              </p>

              <div className="space-y-2">
                {AVAILABLE_AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      selectedAgent === agent.id
                        ? 'bg-purple-500/20 border-purple-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedAgent === agent.id ? 'bg-purple-500/30' : 'bg-purple-500/20'
                    }`}>
                      <Bot className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium text-white">{agent.name}</p>
                      <p className="text-xs text-white/50">{agent.fioHandle}</p>
                    </div>
                    {selectedAgent === agent.id && (
                      <Check className="w-5 h-5 text-purple-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep('select-type')}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={addAgentPersona}
                  disabled={!selectedAgent || isLoading}
                  className="flex-1 px-4 py-3 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Agent'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
