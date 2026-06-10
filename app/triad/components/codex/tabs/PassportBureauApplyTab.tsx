'use client';

/**
 * PassportBureauApplyTab — citizen passport application flow (Stage 3 UI).
 *
 * PRD §9 steps 1–9, guided as five panels:
 *   1. Bureau account — localized sign-on (synthetic-email Supabase user)
 *   2. Identity — persona + KybeDID bind (commitment refs displayed only)
 *   3. Private vault (optional) — client-side AES-256-GCM encrypt → upload
 *      (plaintext NEVER leaves the browser; Addendum A)
 *   4. Consents — terms + the four mandatory self-custody acknowledgements
 *   5. Submit — weak personhood proof + submission, then own-status list
 *
 * All API calls ride the Bearer token (spine rule) via authedFetchHeaders.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  FileCheck2,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import {
  getSupabaseBrowserClient,
  authedFetchHeaders,
} from '@/utils/supabaseBrowser';
import {
  encryptVaultPayload,
  buildSelfCustodyRef,
} from '@/services/passport/selfCustodyVault';

type StepId = 'account' | 'identity' | 'vault' | 'consents' | 'submit';

interface OwnApplication {
  applicationId: string;
  passportClass: string;
  applicationStatus: string;
  passportGrade: string | null;
  submittedAt: string | null;
}

const ACK_LABELS: Array<{ key: string; label: string }> = [
  {
    key: 'private_data_not_stored_in_supabase_acknowledged',
    label: 'My private data is never stored on Bureau servers — only an encrypted reference.',
  },
  {
    key: 'bureau_cannot_decrypt_private_payload_acknowledged',
    label: 'The Bureau cannot decrypt my private payload under any circumstances.',
  },
  {
    key: 'sysadmins_cannot_recover_private_payload_acknowledged',
    label: 'System administrators cannot recover my private payload.',
  },
  {
    key: 'loss_of_key_risk_acknowledged',
    label: 'If I lose my vault passphrase, my private payload is permanently unrecoverable.',
  },
];

const CONSENT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'passport_terms_accepted', label: 'I accept the Polity Passport terms.' },
  { key: 'privacy_terms_accepted', label: 'I accept the privacy terms.' },
  { key: 'registry_pending_record_consent', label: 'I consent to a pending registry record being created for my application.' },
  { key: 'blackqube_private_storage_consent', label: 'I consent to self-custody blakQube storage for any private details I provide.' },
];

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function PassportBureauApplyTab() {
  const [step, setStep] = useState<StepId>('account');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Step 1 — account
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [signedIn, setSignedIn] = useState(false);

  // Step 2 — identity
  const [displayName, setDisplayName] = useState('');
  const [bound, setBound] = useState(false);
  const [kybeRef, setKybeRef] = useState<string | null>(null);

  // Step 3 — vault
  const [privateDetails, setPrivateDetails] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [vaultRef, setVaultRef] = useState<{ contentId: string; contentHash: string } | null>(null);

  // Step 4 — consents
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  // Step 5 — submit
  const [captchaToken, setCaptchaToken] = useState('');
  const [applications, setApplications] = useState<OwnApplication[]>([]);

  const loadStatus = useCallback(async () => {
    try {
      const headers = await authedFetchHeaders();
      const res = await fetch('/api/passport/applications/status', { headers, cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setApplications(json.applications ?? []);
    } catch {
      /* status list is best-effort */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (data?.session) {
        setSignedIn(true);
        setStep('identity');
        void loadStatus();
      }
    })();
  }, [loadStatus]);

  const handleAccount = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const syntheticEmail = `${username.trim().toLowerCase()}@passport.metame.internal`;
      if (mode === 'signup') {
        const res = await fetch('/api/passport/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, recoveryEmail: recoveryEmail || undefined }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Signup failed');
        setNotice(json.recoveryPolicy?.warning ?? null);
      }
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });
      if (signInError) throw new Error(signInError.message);
      setSignedIn(true);
      setStep('identity');
      void loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account step failed');
    } finally {
      setBusy(false);
    }
  }, [username, password, recoveryEmail, mode, loadStatus]);

  const handleBind = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/passport/identity/bind', {
        method: 'POST',
        headers,
        body: JSON.stringify({ displayName: displayName || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Identity bind failed');
      setBound(true);
      setKybeRef(json.kybePublicRef ?? null);
      setNotice(
        json.alreadyBound
          ? 'Identity already bound — continuing with your existing KybeDID.'
          : json.existingRootDidMapped
            ? 'Existing platform identity mapped — your KybeDID was reused.'
            : 'New KybeDID minted and bound.',
      );
      setStep('vault');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bind failed');
    } finally {
      setBusy(false);
    }
  }, [displayName]);

  const handleVault = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!privateDetails.trim()) {
        // Vault is optional — anonymous citizen applications can skip it.
        setStep('consents');
        return;
      }
      const { envelope, contentHash } = await encryptVaultPayload(
        { private_details: privateDetails },
        passphrase,
      );
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/octet-stream' });
      const res = await fetch('/api/passport/vault/upload', {
        method: 'POST',
        headers,
        body: envelope.buffer.slice(envelope.byteOffset, envelope.byteOffset + envelope.byteLength) as ArrayBuffer,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Vault upload failed');
      setVaultRef({ contentId: json.contentId, contentHash: json.contentHash });
      setNotice('Private payload encrypted in your browser and stored. Keep your passphrase safe — it is the only key.');
      setStep('consents');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vault step failed');
    } finally {
      setBusy(false);
    }
  }, [privateDetails, passphrase]);

  const allChecked =
    [...ACK_LABELS, ...CONSENT_LABELS].every((item) => checks[item.key] === true);

  const handleSubmit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const consents: Record<string, unknown> = {};
      for (const { key } of CONSENT_LABELS) consents[key] = true;
      consents.self_custody_acknowledgements = Object.fromEntries(
        ACK_LABELS.map(({ key }) => [key, true]),
      );

      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/passport/applications/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          consents,
          captchaToken,
          selfCustodyRef: vaultRef ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Submission failed');
      setNotice(`Application submitted — status: ${json.applicationStatus}`);
      void loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }, [captchaToken, vaultRef, loadStatus]);

  const steps: Array<{ id: StepId; label: string; icon: React.ReactNode }> = [
    { id: 'account', label: 'Account', icon: <UserPlus className="h-4 w-4" /> },
    { id: 'identity', label: 'Identity', icon: <KeyRound className="h-4 w-4" /> },
    { id: 'vault', label: 'Private Vault', icon: <Lock className="h-4 w-4" /> },
    { id: 'consents', label: 'Consents', icon: <FileCheck2 className="h-4 w-4" /> },
    { id: 'submit', label: 'Submit', icon: <Send className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Citizen Passport Application</h2>
          <p className="text-sm text-slate-400">
            Anonymous proof of personhood. Your private data stays in your custody — always.
          </p>
        </div>
      </div>

      {/* Step strip */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={cls(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-300',
              step === s.id
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
            )}
          >
            {s.icon}
            <span>{i + 1}. {s.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {step === 'account' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setMode('signup')}
              className={cls('rounded px-3 py-1.5', mode === 'signup' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400')}
            >
              New account
            </button>
            <button
              onClick={() => setMode('signin')}
              className={cls('rounded px-3 py-1.5', mode === 'signin' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400')}
            >
              Sign in
            </button>
          </div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (lowercase letters, digits, hyphens)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          {mode === 'signup' && (
            <>
              <input
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="Recovery email (optional — account access only)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                No email is required. A recovery email restores account access only — it can never
                recover your encrypted vault.
              </p>
            </>
          )}
          <button
            onClick={handleAccount}
            disabled={busy || !username || !password}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {mode === 'signup' ? 'Create Bureau account' : 'Sign in'}
          </button>
        </div>
      )}

      {step === 'identity' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            Binding creates your Bureau persona and KybeDID — the anonymous anchor proving you are
            one unique person. If you already have a platform identity, it is reused (one KybeDID
            per human).
          </p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional — defaults to 'Polity Citizen')"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          {bound && kybeRef && (
            <p className="font-mono text-xs text-slate-400">KybeDID commitment: {kybeRef}</p>
          )}
          <button
            onClick={handleBind}
            disabled={busy || !signedIn}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {bound ? 'Re-check binding' : 'Bind identity'}
          </button>
        </div>
      )}

      {step === 'vault' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            Optional. Anything you enter here is encrypted <strong>in your browser</strong> before
            upload. The Bureau receives ciphertext only and can never read it.
          </p>
          <textarea
            value={privateDetails}
            onChange={(e) => setPrivateDetails(e.target.value)}
            placeholder="Optional private details (leave empty for a fully anonymous application)"
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          {privateDetails.trim() && (
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Vault passphrase (min 8 chars — THE ONLY KEY; unrecoverable if lost)"
              className="w-full rounded-lg border border-amber-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-amber-600/70"
            />
          )}
          {vaultRef && (
            <p className="font-mono text-xs text-slate-400">
              Stored: {vaultRef.contentId.slice(0, 24)}… (encrypted)
            </p>
          )}
          <button
            onClick={handleVault}
            disabled={busy || (Boolean(privateDetails.trim()) && passphrase.length < 8)}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {privateDetails.trim() ? 'Encrypt + store, then continue' : 'Skip — stay fully anonymous'}
          </button>
        </div>
      )}

      {step === 'consents' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Terms</h3>
          {CONSENT_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={checks[key] === true}
                onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                className="mt-1"
              />
              <span>{label}</span>
            </label>
          ))}
          <h3 className="pt-2 text-sm font-semibold text-amber-300">
            Self-custody acknowledgements (required)
          </h3>
          {ACK_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={checks[key] === true}
                onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                className="mt-1"
              />
              <span>{label}</span>
            </label>
          ))}
          <button
            onClick={() => setStep('submit')}
            disabled={!allChecked}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <FileCheck2 className="h-4 w-4" />
            Continue
          </button>
        </div>
      )}

      {step === 'submit' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            One last check that you are a person, then submit.
          </p>
          <input
            value={captchaToken}
            onChange={(e) => setCaptchaToken(e.target.value)}
            placeholder="Proof token (CAPTCHA — dev tokens start with 'dev-')"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button
            onClick={handleSubmit}
            disabled={busy || !allChecked || !captchaToken}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit application
          </button>
        </div>
      )}

      {applications.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Your applications</h3>
          {applications.map((a) => (
            <div
              key={a.applicationId}
              className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm"
            >
              <span className="text-slate-300">{a.passportClass}</span>
              <span
                className={cls(
                  'rounded-full px-2 py-0.5 text-xs',
                  a.applicationStatus === 'approved' && 'bg-emerald-900 text-emerald-300',
                  a.applicationStatus === 'denied' && 'bg-rose-900 text-rose-300',
                  ['submitted', 'pending_approval', 'needs_more_information'].includes(a.applicationStatus) &&
                    'bg-violet-900 text-violet-300',
                )}
              >
                {a.applicationStatus}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
