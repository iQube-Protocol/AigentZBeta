"use client";

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { PersonaQube } from '@/types/persona';
import { unlockWallet } from '@/services/wallet/sessionService';

// =============================================================================
// TYPES
// =============================================================================

interface UnlockModalProps {
  /** Full persona object - if provided, used for unlock */
  persona?: PersonaQube;
  /** Alternative: just the persona ID */
  personaId?: string;
  /** Alternative: persona display name for UI */
  personaName?: string;
  /** Whether modal is open */
  isOpen?: boolean;
  /** Callback on successful unlock */
  onUnlock?: () => void;
  /** Callback on successful unlock (alternative name) */
  onUnlockSuccess?: () => void;
  /** Callback to close/cancel */
  onCancel?: () => void;
  /** Callback to close (alternative name) */
  onClose?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function UnlockModal({ 
  persona, 
  personaId,
  personaName,
  isOpen = true,
  onUnlock, 
  onUnlockSuccess,
  onCancel,
  onClose,
}: UnlockModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the actual persona ID and name
  const actualPersonaId = persona?.id || personaId;
  const actualPersonaName = persona?.displayName || persona?.fioHandle || personaName || 'Wallet';
  
  // Resolve callbacks
  const handleSuccess = onUnlock || onUnlockSuccess;
  const handleClose = onCancel || onClose;

  // Don't render if not open
  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Please enter your password');
      return;
    }
    
    if (!actualPersonaId) {
      setError('No persona selected');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // If we have the full persona with encrypted key, use it
      if (persona?.evmKey?.encryptedPrivateKey) {
        const result = await unlockWallet(
          persona.id,
          persona.evmKey.encryptedPrivateKey,
          password
        );
        
        if (result.success) {
          handleSuccess?.();
        } else {
          setError(result.error || 'Failed to unlock wallet');
        }
      } else {
        // Otherwise, we need to fetch the persona first
        // For now, show an error - in production, fetch from API
        setError('Persona data not available. Please try again.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center border-b border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-fuchsia-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Unlock Wallet</h2>
          <p className="text-sm text-slate-400">
            Enter your password to unlock <span className="text-fuchsia-400">{actualPersonaName}</span>
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleUnlock} className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {/* Password input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoFocus
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
          </div>
          
          {/* Session info */}
          <p className="text-xs text-slate-500 text-center">
            Your wallet will stay unlocked for this session (30 minutes of inactivity will lock it)
          </p>
          
          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-white/10 rounded-lg text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Unlocking...
                </>
              ) : (
                'Unlock'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UnlockModal;
