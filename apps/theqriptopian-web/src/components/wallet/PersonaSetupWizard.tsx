/**
 * PersonaSetupWizard - Full 5-step persona creation wizard
 */
import React, { useState, useCallback } from 'react';
import { User, Key, CheckCircle, ArrowRight, ArrowLeft, Loader2, AlertCircle, Eye, EyeOff, Copy, Check } from 'lucide-react';

type FioDomain = 'qripto' | 'knyt';
type WizardStep = 'domain' | 'handle' | 'referrer' | 'keys' | 'password' | 'confirm';

interface Props {
  tenantId?: string;
  onComplete: (personaId: string) => void;
  onCancel?: () => void;
}

interface WizardState {
  domain: FioDomain | null;
  username: string;
  displayName: string;
  referrerIdentifier: string;
  referrerValid: boolean | null;
  referrerId: string | null;
  keySource: 'generated' | 'imported';
  importedKey: string;
  password: string;
  confirmPassword: string;
  evmAddress: string;
  btcAddress: string;
  solAddress: string;
}

const DOMAINS: FioDomain[] = ['qripto', 'knyt'];
const isValidKey = (k: string) => /^(0x)?[a-fA-F0-9]{64}$/.test(k.startsWith('0x') ? k.slice(2) : k);
const validatePwd = (p: string) => ({ valid: p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) });

export function PersonaSetupWizard({ tenantId = 'default', onComplete, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>('domain');
  const [state, setState] = useState<WizardState>({
    domain: null, username: '', displayName: '', referrerIdentifier: '', referrerValid: null, referrerId: null,
    keySource: 'generated', importedKey: '', password: '', confirmPassword: '', evmAddress: '', btcAddress: '', solAddress: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [createdPersona, setCreatedPersona] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const steps: WizardStep[] = ['domain', 'handle', 'referrer', 'keys', 'password', 'confirm'];
  const idx = steps.indexOf(step);

  const canNext = useCallback(() => {
    if (step === 'domain') return !!state.domain;
    if (step === 'handle') return state.username.length >= 3 && handleAvailable !== false && state.displayName.length > 0;
    if (step === 'referrer') return true; // Referrer is optional
    if (step === 'keys') return state.keySource === 'generated' || isValidKey(state.importedKey);
    if (step === 'password') return validatePwd(state.password).valid && state.password === state.confirmPassword;
    return true;
  }, [step, state, handleAvailable]);

  const checkHandle = async () => {
    if (!state.username || !state.domain) return;
    setCheckingHandle(true); setHandleAvailable(null);
    try {
      const fioHandle = `${state.username}@${state.domain}`;
      const r = await fetch(`${import.meta.env.VITE_AIGENT_API_URL || ''}/api/identity/persona?fio_handle=${encodeURIComponent(fioHandle)}`);
      const contentType = r.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        setHandleAvailable(true); return;
      }
      const d = await r.json();
      // If no persona found with this handle, it's available
      setHandleAvailable(!(d.ok && d.data?.length > 0));
    } catch { setHandleAvailable(true); }
    finally { setCheckingHandle(false); }
  };

  const validateReferrer = async () => {
    if (!state.referrerIdentifier) {
      setState(s => ({ ...s, referrerValid: null, referrerId: null }));
      return;
    }
    try {
      const r = await fetch(`${import.meta.env.VITE_AIGENT_API_URL || ''}/api/referrals/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: state.referrerIdentifier })
      });
      const d = await r.json();
      setState(s => ({ ...s, referrerValid: d.valid, referrerId: d.persona?.id || null }));
    } catch {
      setState(s => ({ ...s, referrerValid: false, referrerId: null }));
    }
  };

  const handleCreate = async () => {
    if (!state.domain) return;
    setIsLoading(true); setError(null);
    try {
      const r = await fetch(`${import.meta.env.VITE_AIGENT_API_URL || ''}/api/persona/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, tenantId, importedPrivateKey: state.keySource === 'imported' ? state.importedKey : undefined })
      });
      const d = await r.json();
      if (d.success && d.persona) { setCreatedPersona(d.persona); setStep('confirm'); }
      else setError(d.error || 'Failed');
    } catch (e) { setError((e as Error).message); }
    finally { setIsLoading(false); }
  };

  const copyAddr = async () => {
    if (createdPersona?.evmKey?.address) {
      await navigator.clipboard.writeText(createdPersona.evmKey.address);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="h-1 bg-white/10"><div className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400"><AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span></div>}
          
          {step === 'domain' && (
            <div className="space-y-6">
              <div className="text-center mb-8"><h2 className="text-2xl font-bold text-white mb-2">Choose Persona Type</h2><p className="text-slate-400">Select your ecosystem</p></div>
              <div className="grid grid-cols-2 gap-4">
                {DOMAINS.map(d => (
                  <button key={d} onClick={() => setState(s => ({ ...s, domain: d }))} className={`p-6 rounded-xl border-2 transition-all ${state.domain === d ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <div className="text-4xl mb-3">{d === 'qripto' ? '��' : '🗡️'}</div>
                    <div className="text-lg font-semibold text-white">{d === 'qripto' ? 'Qripto' : 'KNYT'}</div>
                    <div className="text-sm text-slate-400">@{d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'handle' && (
            <div className="space-y-6">
              <div className="text-center mb-8"><h2 className="text-2xl font-bold text-white mb-2">Create Your Handle</h2></div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">FIO Handle</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={state.username} onChange={e => { setState(s => ({ ...s, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })); setHandleAvailable(null); }} onBlur={checkHandle} placeholder="username" className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50" />
                  <span className="text-slate-400">@{state.domain}</span>
                </div>
                <div className="mt-2 h-6">
                  {checkingHandle && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Checking...</span></div>}
                  {handleAvailable === true && <div className="flex items-center gap-2 text-green-400"><CheckCircle className="w-4 h-4" /><span className="text-sm">Available!</span></div>}
                  {handleAvailable === false && <div className="flex items-center gap-2 text-red-400"><AlertCircle className="w-4 h-4" /><span className="text-sm">Not available</span></div>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                <input type="text" value={state.displayName} onChange={e => setState(s => ({ ...s, displayName: e.target.value }))} placeholder="Your name" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50" />
              </div>
            </div>
          )}

          {step === 'referrer' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Who Referred You?</h2>
                <p className="text-slate-400">Optional - Enter referrer details to earn rewards</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Referrer (Optional)</label>
                <input 
                  type="text" 
                  value={state.referrerIdentifier} 
                  onChange={e => setState(s => ({ ...s, referrerIdentifier: e.target.value, referrerValid: null }))}
                  onBlur={validateReferrer}
                  placeholder="@knyt:username, @qripto:username, or email" 
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50" 
                />
                <div className="mt-2 h-6">
                  {state.referrerValid === true && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Valid referrer found!</span>
                    </div>
                  )}
                  {state.referrerValid === false && (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Referrer not found - you can add later</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  You can skip this and add a referrer later in your profile settings
                </p>
              </div>
            </div>
          )}

          {step === 'keys' && (
            <div className="space-y-6">
              <div className="text-center mb-8"><h2 className="text-2xl font-bold text-white mb-2">Wallet Keys</h2></div>
              <div className="space-y-3">
                <button onClick={() => setState(s => ({ ...s, keySource: 'generated', importedKey: '' }))} className={`w-full p-4 rounded-xl border-2 text-left ${state.keySource === 'generated' ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center gap-3"><Key className="w-5 h-5 text-fuchsia-400" /><div><div className="font-medium text-white">Generate New Key</div><div className="text-sm text-slate-400">Create fresh EVM key</div></div></div>
                </button>
                <button onClick={() => setState(s => ({ ...s, keySource: 'imported' }))} className={`w-full p-4 rounded-xl border-2 text-left ${state.keySource === 'imported' ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center gap-3"><User className="w-5 h-5 text-cyan-400" /><div><div className="font-medium text-white">Import Existing Key</div><div className="text-sm text-slate-400">Use your private key</div></div></div>
                </button>
              </div>
              {state.keySource === 'imported' && (
                <div className="relative">
                  <input type={showKey ? 'text' : 'password'} value={state.importedKey} onChange={e => setState(s => ({ ...s, importedKey: e.target.value }))} placeholder="0x..." className="w-full px-4 py-3 pr-12 bg-black/30 border border-white/10 rounded-lg text-white font-mono text-sm" />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                </div>
              )}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="text-sm text-slate-300 mb-2">Optional: Link External Wallets</div>
                <input type="text" value={state.evmAddress} onChange={e => setState(s => ({ ...s, evmAddress: e.target.value }))} placeholder="EVM Address (0x...)" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white font-mono text-sm" />
                <input type="text" value={state.btcAddress} onChange={e => setState(s => ({ ...s, btcAddress: e.target.value }))} placeholder="BTC Address" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white font-mono text-sm" />
                <input type="text" value={state.solAddress} onChange={e => setState(s => ({ ...s, solAddress: e.target.value }))} placeholder="Solana Address" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white font-mono text-sm" />
              </div>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-6">
              <div className="text-center mb-8"><h2 className="text-2xl font-bold text-white mb-2">Secure Your Wallet</h2></div>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={state.password} onChange={e => setState(s => ({ ...s, password: e.target.value }))} placeholder="Password" className="w-full px-4 py-3 pr-12 bg-black/30 border border-white/10 rounded-lg text-white" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
              <div className="space-y-1">{['8+ chars', 'Uppercase', 'Lowercase', 'Number'].map((r, i) => {
                const c = [state.password.length >= 8, /[A-Z]/.test(state.password), /[a-z]/.test(state.password), /[0-9]/.test(state.password)];
                return <div key={i} className={`flex items-center gap-2 text-sm ${c[i] ? 'text-green-400' : 'text-slate-500'}`}>{c[i] ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border" />}{r}</div>;
              })}</div>
              <input type="password" value={state.confirmPassword} onChange={e => setState(s => ({ ...s, confirmPassword: e.target.value }))} placeholder="Confirm password" className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white" />
              {state.confirmPassword && state.password !== state.confirmPassword && <p className="text-sm text-red-400">Passwords don't match</p>}
            </div>
          )}

          {step === 'confirm' && createdPersona && (
            <div className="space-y-6">
              <div className="text-center mb-8"><div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircle className="w-8 h-8 text-green-400" /></div><h2 className="text-2xl font-bold text-white mb-2">Persona Created!</h2></div>
              <div className="p-4 bg-white/5 rounded-lg"><div className="text-sm text-slate-400 mb-1">Handle</div><div className="text-lg font-medium text-white">{createdPersona.fioHandle}</div></div>
              <div className="p-4 bg-white/5 rounded-lg"><div className="text-sm text-slate-400 mb-1">Address</div><div className="flex items-center gap-2"><span className="text-sm font-mono text-white break-all flex-1">{createdPersona.evmKey?.address}</span><button onClick={copyAddr} className="p-2 hover:bg-white/10 rounded-lg">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}</button></div></div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-between">
          <button onClick={idx === 0 ? onCancel : () => setStep(steps[idx - 1])} className="px-4 py-2 text-slate-400 hover:text-white" disabled={isLoading}>{idx === 0 ? 'Cancel' : <span className="flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Back</span>}</button>
          {step === 'confirm' ? <button onClick={() => onComplete(createdPersona?.id)} className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg">Enter Wallet</button>
           : step === 'password' ? <button onClick={handleCreate} disabled={!canNext() || isLoading} className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-2">{isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create Persona'}</button>
           : <button onClick={() => setStep(steps[idx + 1])} disabled={!canNext()} className="px-6 py-2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-1">Next<ArrowRight className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
}

export default PersonaSetupWizard;
