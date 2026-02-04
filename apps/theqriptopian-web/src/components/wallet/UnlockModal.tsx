/**
 * UnlockModal - Password-based wallet unlock flow
 */
import React, { useState } from 'react';
import { X, Lock, Unlock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  personaId: string;
  personaName: string;
  onUnlockSuccess: () => void;
}

export function UnlockModal({ isOpen, onClose, personaId, personaName, onUnlockSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const handleUnlock = async () => {
    if (!password) return;
    setIsLoading(true);
    setError(null);

    try {
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      const response = await fetch(`${apiBase}/api/wallet/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, password }),
      });

      const result = await response.json();

      if (result.success) {
        // Store session token
        if (result.sessionToken) {
          sessionStorage.setItem(`wallet_session_${personaId}`, result.sessionToken);
        }
        setPassword('');
        onUnlockSuccess();
      } else {
        setAttempts(a => a + 1);
        setError(result.error || 'Invalid password');
      }
    } catch (err) {
      setError('Failed to unlock wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password && !isLoading) {
      handleUnlock();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            Unlock Wallet
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Persona info */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 ring-2 ring-white/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white/60" />
            </div>
            <div className="text-white font-medium">{personaName}</div>
            <div className="text-sm text-slate-400">Enter your password to unlock</div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="text-sm">{error}</span>
                {attempts >= 3 && (
                  <p className="text-xs mt-1 text-red-300">Too many attempts. Please try again later.</p>
                )}
              </div>
            </div>
          )}

          {/* Password input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your password"
                autoFocus
                disabled={attempts >= 5}
                className="w-full px-4 py-3 pr-12 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 disabled:opacity-50"
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

          {/* Forgot password hint */}
          <div className="text-center">
            <button className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
              Forgot password? Contact support
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={isLoading || !password || attempts >= 5}
            className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                Unlock
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnlockModal;
