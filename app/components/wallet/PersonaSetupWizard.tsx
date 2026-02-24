"use client";

import React, { useState, useCallback } from 'react';
import { 
  User, 
  Key, 
  Lock, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { FioDomain, CreatePersonaInput } from '@/types/persona';
import { createPersona } from '@/services/wallet/personaService';
import { isValidUsername, SUPPORTED_DOMAINS } from '@/services/wallet/personaFioService';
import { getPersonaFioService } from '@/services/wallet/personaFioService';
import { validatePassword, isValidPrivateKey } from '@/services/wallet/keyService';

// =============================================================================
// TYPES
// =============================================================================

interface PersonaSetupWizardProps {
  tenantId?: string;
  onComplete: (personaId: string) => void;
  onCancel?: () => void;
}

type WizardStep = 'domain' | 'handle' | 'keys' | 'password' | 'confirm';

interface WizardState {
  domain: FioDomain | null;
  username: string;
  displayName: string;
  keySource: 'generated' | 'imported';
  importedKey: string;
  password: string;
  confirmPassword: string;
}

// =============================================================================
// WIZARD COMPONENT
// =============================================================================

export function PersonaSetupWizard({ 
  tenantId = 'default', 
  onComplete, 
  onCancel 
}: PersonaSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('domain');
  const [state, setState] = useState<WizardState>({
    domain: null,
    username: '',
    displayName: '',
    keySource: 'generated',
    importedKey: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showImportedKey, setShowImportedKey] = useState(false);
  const [createdPersona, setCreatedPersona] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Step navigation
  const steps: WizardStep[] = ['domain', 'handle', 'keys', 'password', 'confirm'];
  const currentIndex = steps.indexOf(step);
  
  const canGoNext = useCallback(() => {
    switch (step) {
      case 'domain':
        return state.domain !== null;
      case 'handle':
        return state.username.length > 0 && handleAvailable === true && state.displayName.length > 0;
      case 'keys':
        if (state.keySource === 'imported') {
          return isValidPrivateKey(state.importedKey);
        }
        return true;
      case 'password':
        const validation = validatePassword(state.password);
        return validation.valid && state.password === state.confirmPassword;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [step, state, handleAvailable]);

  const goNext = () => {
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
      setError(null);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
      setError(null);
    }
  };

  // Check handle availability
  const checkHandle = async () => {
    if (!state.username || !state.domain) return;
    
    setCheckingHandle(true);
    setHandleAvailable(null);
    
    try {
      const fioService = getPersonaFioService();
      const result = await fioService.checkHandleAvailability(state.username, state.domain);
      setHandleAvailable(result.available);
      if (!result.available && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError((err as Error).message);
      setHandleAvailable(false);
    } finally {
      setCheckingHandle(false);
    }
  };

  // Create persona
  const handleCreate = async () => {
    if (!state.domain) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const input: CreatePersonaInput = {
        username: state.username,
        domain: state.domain,
        displayName: state.displayName,
        keySource: state.keySource,
        importedPrivateKey: state.keySource === 'imported' ? state.importedKey : undefined,
        password: state.password,
        tenantId,
      };
      
      const result = await createPersona(input);
      
      if (result.success && result.persona) {
        setCreatedPersona(result.persona);
        setStep('confirm');
      } else {
        setError(result.error || 'Failed to create persona');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy address to clipboard
  const copyAddress = async () => {
    if (createdPersona?.evmKey?.address) {
      await navigator.clipboard.writeText(createdPersona.evmKey.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // =============================================================================
  // STEP RENDERERS
  // =============================================================================

  const renderDomainStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Persona Type</h2>
        <p className="text-slate-400">Select the ecosystem for your new persona</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {SUPPORTED_DOMAINS.map((domain) => {
          const info = domain === 'qripto' 
            ? { icon: '🔮', name: 'Qripto', desc: 'Content & Reputation' }
            : { icon: '🗡️', name: 'KNYT', desc: 'Gaming & Rewards' };
          
          return (
            <button
              key={domain}
              onClick={() => setState(s => ({ ...s, domain }))}
              className={`p-6 rounded-xl border-2 transition-all ${
                state.domain === domain
                  ? 'border-fuchsia-500 bg-fuchsia-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="text-4xl mb-3">{info.icon}</div>
              <div className="text-lg font-semibold text-white">{info.name}</div>
              <div className="text-sm text-slate-400">@{domain}</div>
              <div className="text-xs text-slate-500 mt-2">{info.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderHandleStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Create Your Handle</h2>
        <p className="text-slate-400">Choose a unique identifier for your persona</p>
      </div>
      
      {/* Username input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          FIO Handle
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={state.username}
            onChange={(e) => {
              setState(s => ({ ...s, username: e.target.value.toLowerCase() }));
              setHandleAvailable(null);
            }}
            onBlur={checkHandle}
            placeholder="username"
            className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
          />
          <span className="text-slate-400">@{state.domain}</span>
        </div>
        
        {/* Availability indicator */}
        <div className="mt-2 h-6">
          {checkingHandle && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Checking availability...</span>
            </div>
          )}
          {handleAvailable === true && (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">{state.username}@{state.domain} is available!</span>
            </div>
          )}
          {handleAvailable === false && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Handle not available</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Display name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Display Name
        </label>
        <input
          type="text"
          value={state.displayName}
          onChange={(e) => setState(s => ({ ...s, displayName: e.target.value }))}
          placeholder="Your display name"
          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
        />
      </div>
    </div>
  );

  const renderKeysStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Wallet Keys</h2>
        <p className="text-slate-400">Set up your EVM wallet key</p>
      </div>
      
      {/* Key source selection */}
      <div className="space-y-3">
        <button
          onClick={() => setState(s => ({ ...s, keySource: 'generated', importedKey: '' }))}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            state.keySource === 'generated'
              ? 'border-fuchsia-500 bg-fuchsia-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-fuchsia-400" />
            <div>
              <div className="font-medium text-white">Generate New Key</div>
              <div className="text-sm text-slate-400">Create a fresh EVM key pair</div>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setState(s => ({ ...s, keySource: 'imported' }))}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            state.keySource === 'imported'
              ? 'border-fuchsia-500 bg-fuchsia-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="font-medium text-white">Import Existing Key</div>
              <div className="text-sm text-slate-400">Use your own private key</div>
            </div>
          </div>
        </button>
      </div>
      
      {/* Import key input */}
      {state.keySource === 'imported' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Private Key (hex)
          </label>
          <div className="relative">
            <input
              type={showImportedKey ? 'text' : 'password'}
              value={state.importedKey}
              onChange={(e) => setState(s => ({ ...s, importedKey: e.target.value }))}
              placeholder="0x..."
              className="w-full px-4 py-3 pr-12 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowImportedKey(!showImportedKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showImportedKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {state.importedKey && !isValidPrivateKey(state.importedKey) && (
            <p className="mt-2 text-sm text-red-400">Invalid private key format</p>
          )}
        </div>
      )}
      
      {/* Info box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-300">
          💡 Your EVM key works across Base, Optimism, Polygon, and other EVM chains.
        </p>
      </div>
    </div>
  );

  const renderPasswordStep = () => {
    const validation = validatePassword(state.password);
    const passwordsMatch = state.password === state.confirmPassword;
    
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Secure Your Wallet</h2>
          <p className="text-slate-400">Create a password to encrypt your private key</p>
        </div>
        
        {/* Password input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={state.password}
              onChange={(e) => setState(s => ({ ...s, password: e.target.value }))}
              placeholder="Enter password"
              className="w-full px-4 py-3 pr-12 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Password requirements */}
          <div className="mt-3 space-y-1">
            {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number'].map((req, i) => {
              const checks = [
                state.password.length >= 8,
                /[A-Z]/.test(state.password),
                /[a-z]/.test(state.password),
                /[0-9]/.test(state.password),
              ];
              return (
                <div key={i} className={`flex items-center gap-2 text-sm ${checks[i] ? 'text-green-400' : 'text-slate-500'}`}>
                  {checks[i] ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-current" />}
                  {req}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={state.confirmPassword}
            onChange={(e) => setState(s => ({ ...s, confirmPassword: e.target.value }))}
            placeholder="Confirm password"
            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
          />
          {state.confirmPassword && !passwordsMatch && (
            <p className="mt-2 text-sm text-red-400">Passwords do not match</p>
          )}
        </div>
        
        {/* Warning */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-300">
            ⚠️ This password encrypts your private key. You'll enter it once per session to unlock your wallet.
          </p>
        </div>
      </div>
    );
  };

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Persona Created!</h2>
        <p className="text-slate-400">Your new identity is ready</p>
      </div>
      
      {createdPersona && (
        <div className="space-y-4">
          {/* Handle */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">FIO Handle</div>
            <div className="text-lg font-medium text-white">{createdPersona.fioHandle}</div>
          </div>
          
          {/* DID */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">DID</div>
            <div className="text-sm font-mono text-white break-all">{createdPersona.rootDid}</div>
          </div>
          
          {/* Address */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Wallet Address</div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-mono text-white break-all flex-1">
                {createdPersona.evmKey?.address}
              </div>
              <button
                onClick={copyAddress}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
          
          {/* Chains */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-sm text-slate-400 mb-2">Supported Chains</div>
            <div className="flex flex-wrap gap-2">
              {['Base', 'Optimism', 'Polygon'].map(chain => (
                <span key={chain} className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-300 text-xs rounded">
                  {chain}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div 
            className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {/* Step content */}
          {step === 'domain' && renderDomainStep()}
          {step === 'handle' && renderHandleStep()}
          {step === 'keys' && renderKeysStep()}
          {step === 'password' && renderPasswordStep()}
          {step === 'confirm' && renderConfirmStep()}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
          {/* Back / Cancel */}
          <button
            onClick={currentIndex === 0 ? onCancel : goBack}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            {currentIndex === 0 ? 'Cancel' : (
              <span className="flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </span>
            )}
          </button>
          
          {/* Next / Create / Done */}
          {step === 'confirm' ? (
            <button
              onClick={() => onComplete(createdPersona?.id)}
              className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Enter Wallet
            </button>
          ) : step === 'password' ? (
            <button
              onClick={handleCreate}
              disabled={!canGoNext() || isLoading}
              className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonaSetupWizard;
