/**
 * PersonaEditModal - Edit existing persona details including wallet addresses
 */
import React, { useState, useEffect } from 'react';
import { X, User, Wallet, Bitcoin, Save, Loader2, CheckCircle, AlertCircle, Camera, Trash2 } from 'lucide-react';

interface PersonaData {
  id: string;
  fioHandle?: string;
  displayName: string;
  avatarUri?: string;
  evmAddress?: string;
  btcAddress?: string;
  solAddress?: string;
  bio?: string;
  reputationScore?: number;
  referrerIdentifier?: string;
  referrerValid?: boolean | null;
  referrerId?: string | null;
  referralLockedAt?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaData;
  onSave: (updated: PersonaData) => void;
}

export function PersonaEditModal({ isOpen, onClose, persona, onSave }: Props) {
  const [form, setForm] = useState<PersonaData>(persona);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Fetch full persona data including wallet addresses when modal opens
  useEffect(() => {
    if (isOpen && persona.id) {
      setForm(persona);
      setError(null);
      setSuccess(false);
      setAvatarPreview(null);
      
      // Fetch wallet addresses from API
      const fetchPersonaData = async () => {
        setIsFetchingData(true);
        try {
          const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
          const response = await fetch(`${apiBase}/api/identity/persona/${persona.id}`);
          if (response.ok) {
            const result = await response.json();
            const data = result.data || result;
            // Merge fetched data with existing persona data
            setForm(prev => ({
              ...prev,
              evmAddress: data.evm_address || prev.evmAddress || '',
              btcAddress: data.btc_address || prev.btcAddress || '',
              solAddress: data.sol_address || prev.solAddress || '',
              bio: data.bio || prev.bio || '',
            }));
          }
        } catch (err) {
          console.warn('Failed to fetch persona wallet addresses:', err);
        } finally {
          setIsFetchingData(false);
        }
      };
      
      fetchPersonaData();
    }
  }, [isOpen, persona]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setForm(f => ({ ...f, avatarUri: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateReferrer = async () => {
    if (!form.referrerIdentifier) {
      setForm(f => ({ ...f, referrerValid: null, referrerId: null }));
      return;
    }
    try {
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      const response = await fetch(`${apiBase}/api/referrals/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.referrerIdentifier })
      });
      const data = await response.json();
      setForm(f => ({ ...f, referrerValid: data.valid, referrerId: data.persona?.id || null }));
    } catch {
      setForm(f => ({ ...f, referrerValid: false, referrerId: null }));
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      // Use the correct API endpoint: PATCH /api/identity/persona/[id]
      const response = await fetch(`${apiBase}/api/identity/persona/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: form.displayName,
          avatar_uri: form.avatarUri,
          evm_address: form.evmAddress,
          btc_address: form.btcAddress,
          sol_address: form.solAddress,
          bio: form.bio,
        }),
      });
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }
      
      const result = await response.json();
      if (result.ok || result.success) {
        setSuccess(true);
        onSave(form);
        setTimeout(() => onClose(), 1500);
      } else {
        setError(result.error || 'Failed to update persona');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEvmAddress = (addr: string) => !addr || /^0x[a-fA-F0-9]{40}$/.test(addr);
  const isValidBtcAddress = (addr: string) => !addr || /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr);
  const isValidSolAddress = (addr: string) => !addr || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-fuchsia-400" />
            Edit Persona
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">Persona updated successfully!</span>
            </div>
          )}

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 ring-2 ring-white/20 flex items-center justify-center overflow-hidden">
                {(avatarPreview || form.avatarUri) ? (
                  <img src={avatarPreview || form.avatarUri} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-white/40" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 p-1.5 bg-fuchsia-500 rounded-full cursor-pointer hover:bg-fuchsia-600 transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-400">FIO Handle</div>
              <div className="text-white font-medium">{form.fioHandle || 'Not set'}</div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Bio</label>
            <textarea
              value={form.bio || ''}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Tell us about yourself..."
              rows={3}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 resize-none"
            />
          </div>

          {/* Referrer */}
          {!form.referralLockedAt && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Referrer (Optional)
              </label>
              <input
                type="text"
                value={form.referrerIdentifier || ''}
                onChange={e => setForm(f => ({ ...f, referrerIdentifier: e.target.value, referrerValid: null }))}
                onBlur={validateReferrer}
                placeholder="@knyt:username, @qripto:username, or email"
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              />
              <div className="mt-2 h-6">
                {form.referrerValid === true && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Valid referrer found!</span>
                  </div>
                )}
                {form.referrerValid === false && (
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Referrer not found</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Once set with a valid referrer, this field will be locked
              </p>
            </div>
          )}
          {form.referralLockedAt && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Referrer (Locked)
              </label>
              <div className="px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-slate-400">
                {form.referrerIdentifier || 'Set'}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Referrer is locked and cannot be changed
              </p>
            </div>
          )}

          {/* Wallet Addresses Section */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-4 h-4 text-fuchsia-400" />
              <span className="text-sm font-medium text-slate-300">Linked Wallet Addresses</span>
              {isFetchingData && (
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
              )}
            </div>

            {/* EVM Address */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">EVM Address (Ethereum, Base, Polygon, etc.)</label>
              <input
                type="text"
                value={form.evmAddress || ''}
                onChange={e => setForm(f => ({ ...f, evmAddress: e.target.value }))}
                placeholder="0x..."
                className={`w-full px-3 py-2 bg-black/30 border rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 ${
                  form.evmAddress && !isValidEvmAddress(form.evmAddress) ? 'border-red-500/50' : 'border-white/10'
                }`}
              />
              {form.evmAddress && !isValidEvmAddress(form.evmAddress) && (
                <p className="mt-1 text-xs text-red-400">Invalid EVM address format</p>
              )}
            </div>

            {/* BTC Address */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Bitcoin className="w-3 h-3 text-orange-400" />
                Bitcoin Address
              </label>
              <input
                type="text"
                value={form.btcAddress || ''}
                onChange={e => setForm(f => ({ ...f, btcAddress: e.target.value }))}
                placeholder="bc1... or 3..."
                className={`w-full px-3 py-2 bg-black/30 border rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 ${
                  form.btcAddress && !isValidBtcAddress(form.btcAddress) ? 'border-red-500/50' : 'border-white/10'
                }`}
              />
              {form.btcAddress && !isValidBtcAddress(form.btcAddress) && (
                <p className="mt-1 text-xs text-red-400">Invalid Bitcoin address format</p>
              )}
            </div>

            {/* Solana Address */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Solana Address</label>
              <input
                type="text"
                value={form.solAddress || ''}
                onChange={e => setForm(f => ({ ...f, solAddress: e.target.value }))}
                placeholder="..."
                className={`w-full px-3 py-2 bg-black/30 border rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 ${
                  form.solAddress && !isValidSolAddress(form.solAddress) ? 'border-red-500/50' : 'border-white/10'
                }`}
              />
              {form.solAddress && !isValidSolAddress(form.solAddress) && (
                <p className="mt-1 text-xs text-red-400">Invalid Solana address format</p>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 Linking external wallet addresses allows you to receive payments and verify ownership across multiple chains.
            </p>
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
            onClick={handleSave}
            disabled={isLoading || !form.displayName}
            className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PersonaEditModal;
