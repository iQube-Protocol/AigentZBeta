'use client';

/**
 * PassportBureauApplyTab — passport application wizard (Stage 3 UI).
 *
 * PRD §9: applicants choose a passport class up front —
 *   • Citizen — anonymous personhood (the original five-panel flow):
 *     account → identity → private vault → consents → submit
 *   • Participant — an agent bound to the applicant (PRD: apply for
 *     passports for agents too). The vault panel is replaced by an Agent
 *     panel that captures the agent's identity AND binds the agent to the
 *     applicant via the AgentiQ OS bounded-delegation grant (same
 *     /api/codex/chat/agentiq-os/delegation surface BoundedDelegationTab
 *     uses), then submits through /api/polity-passport/submit.
 *
 * All Bureau API calls ride the Bearer token (spine rule) via
 * authedFetchHeaders.
 */

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SubHeaderSlotContext } from '../SubHeaderSlot';
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
  Bot,
  User,
  Link2,
} from 'lucide-react';
import {
  getSupabaseBrowserClient,
  authedFetchHeaders,
} from '@/utils/supabaseBrowser';
import {
  encryptVaultPayload,
  buildSelfCustodyRef,
} from '@/services/passport/selfCustodyVault';
import { useSupabaseSessionPersonas } from '@/app/hooks/useSupabaseSessionPersonas';

type StepId = 'class' | 'account' | 'identity' | 'vault' | 'agent' | 'consents' | 'submit';
type PassportClass = 'citizen' | 'participant';

// Mirrors BoundedDelegationTab's grant vocabulary (AgentiQ OS cartridge).
const DELEGATION_TRUST_BANDS = [
  'L1_EXPERIMENTAL',
  'L2_VERIFIED_COMMUNITY',
  'L3_PRODUCTION_CANDIDATE',
  'L4_PRODUCTION_APPROVED',
];
const DELEGATION_BAND_ACTIONS: Record<string, string[]> = {
  L1_EXPERIMENTAL: ['knowledge_retrieval'],
  L2_VERIFIED_COMMUNITY: ['knowledge_retrieval', 'draft_document'],
  L3_PRODUCTION_CANDIDATE: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal'],
  L4_PRODUCTION_APPROVED: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal', 'registry_publish'],
};

// Cloudflare Turnstile — rendered in the citizen submit step when the
// site key is configured; otherwise the manual dev-token input remains.
// The secret-side verification lives in services/passport/personhoodProof.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
}

function getTurnstile(): TurnstileApi | null {
  const t = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  return t ?? null;
}

const PARTICIPANT_CONSENT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'participant_terms_accepted', label: 'I accept the Participant Passport terms on behalf of this agent.' },
  { key: 'registry_pending_record_consent', label: 'I consent to a public pending-registry record for this application.' },
  { key: 'constraints_and_obligations_accepted', label: 'I accept the participant constraints and obligations.' },
  { key: 'review_process_accepted', label: 'I accept the steward review process.' },
];

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
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);
  const [step, setStep] = useState<StepId>('class');
  const [passportClass, setPassportClass] = useState<PassportClass>('citizen');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Participant — agent identity + bounded-delegation binding
  const { sessionPersonas } = useSupabaseSessionPersonas();
  const operatorPersonaId = sessionPersonas[0]?.id ?? '';
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState('general');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentCardUrl, setAgentCardUrl] = useState('');
  const [agentCapabilities, setAgentCapabilities] = useState('');
  const [delegationBand, setDelegationBand] = useState('L1_EXPERIMENTAL');
  const [delegationTtl, setDelegationTtl] = useState(4);
  const [delegationBound, setDelegationBound] = useState(false);

  // Agent Card source: 'genesis' (we create it) or 'url' (user pastes existing).
  // Sprint 3 adds the genesis path — the non-technical user can sponsor a new
  // agent without hosting their own card.
  const [agentCardSource, setAgentCardSource] = useState<'genesis' | 'url'>('genesis');
  const [genesisSlug, setGenesisSlug] = useState('');
  const [genesisSponsorPassportId, setGenesisSponsorPassportId] = useState('');
  const [genesisBusy, setGenesisBusy] = useState(false);
  const [genesisCompleted, setGenesisCompleted] = useState(false);

  const handleGenesisAgent = useCallback(async () => {
    if (!agentName.trim() || !agentDescription.trim() || !genesisSlug.trim() || !genesisSponsorPassportId.trim()) {
      setError('Provide agent name, description, slug, and sponsor passport id');
      return;
    }
    setGenesisBusy(true);
    setError(null);
    try {
      const res = await authedFetchHeaders();
      const r = await fetch('/api/agents/genesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...res },
        body: JSON.stringify({
          slug: genesisSlug.trim(),
          displayName: agentName.trim(),
          description: agentDescription.trim(),
          sponsorPassportId: genesisSponsorPassportId.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error ?? 'Agent genesis failed');
        return;
      }
      setAgentCardUrl(data.agent.agentCardUrl);
      setGenesisCompleted(true);
      setNotice(`Agent Card live at ${data.agent.agentCardUrl} — submit below to issue Aletheon a Participant Passport.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenesisBusy(false);
    }
  }, [agentName, agentDescription, genesisSlug, genesisSponsorPassportId]);

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
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  // Render the Turnstile challenge when the citizen submit panel mounts
  // and a site key is configured. Loads the script once; cleans up the
  // widget on unmount so re-entering the step re-renders a fresh one.
  useEffect(() => {
    if (step !== 'submit' || passportClass !== 'citizen' || !TURNSTILE_SITE_KEY) return;
    let widgetId: string | null = null;
    let disposed = false;
    const renderWidget = () => {
      const turnstile = getTurnstile();
      if (disposed || !turnstile || !turnstileRef.current) return;
      turnstileRef.current.innerHTML = '';
      widgetId = turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token: string) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };
    if (getTurnstile()) {
      renderWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
    }
    return () => {
      disposed = true;
      const turnstile = getTurnstile();
      if (turnstile && widgetId) turnstile.remove(widgetId);
    };
  }, [step, passportClass]);

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
        void loadStatus();
      }
    })();
  }, [loadStatus]);

  const handleClassChoice = useCallback(
    (chosen: PassportClass) => {
      setPassportClass(chosen);
      setChecks({});
      setStep(signedIn ? 'identity' : 'account');
    },
    [signedIn],
  );

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
      setStep(passportClass === 'participant' ? 'agent' : 'vault');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bind failed');
    } finally {
      setBusy(false);
    }
  }, [displayName, passportClass]);

  // Participant — bind the agent to the applicant with an AgentiQ OS
  // bounded-delegation grant (same surface as BoundedDelegationTab).
  const handleDelegationBind = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!operatorPersonaId) throw new Error('No session persona available to bind against — sign in first.');
      const res = await fetch('/api/codex/chat/agentiq-os/delegation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: operatorPersonaId,
          trust_band: delegationBand,
          selected_actions: DELEGATION_BAND_ACTIONS[delegationBand] ?? ['knowledge_retrieval'],
          ttl_hours: delegationTtl,
          reputation_score: sessionPersonas[0]?.reputationScore ?? 0,
          allowed_surfaces: ['agentiq-codex'],
          disclosure_class: 'tenant',
          max_actions: 20,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delegation grant failed');
      setDelegationBound(true);
      setNotice(`Agent bound to you via bounded delegation (${delegationBand}, ${delegationTtl}h TTL).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delegation bind failed');
    } finally {
      setBusy(false);
    }
  }, [operatorPersonaId, delegationBand, delegationTtl, sessionPersonas]);

  const handleSubmitParticipant = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const consents: Record<string, unknown> = {
        consent_actor: displayName || 'applicant',
        consented_at: new Date().toISOString(),
      };
      for (const { key } of PARTICIPANT_CONSENT_LABELS) consents[key] = true;
      const declared = agentCapabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const res = await fetch('/api/polity-passport/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_version: '0.1.0',
          application_type: 'agent_participant_passport',
          participant: {
            participant_kind: 'agent',
            agent_type: agentType || 'general',
            display_name: agentName.trim(),
            description: agentDescription.trim() || undefined,
            operator_name: displayName || undefined,
          },
          agent_identity: {
            agent_card: { agent_card_url: agentCardUrl.trim() },
          },
          capabilities: { declared, target_users: [] },
          policy_profile: { clean_revenue_review: 'screened' },
          risk_profile: {},
          passport_request: {
            requested_passport_type: 'agent_participant',
            requested_scope: [agentType || 'general'],
            requested_status: 'provisional_ok',
          },
          consents,
          references: {
            bound_via_delegation: delegationBound
              ? { trust_band: delegationBand, ttl_hours: delegationTtl }
              : undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const issues = Array.isArray(json.issues)
          ? `: ${json.issues.map((i: { path: string; message: string }) => `${i.path} — ${i.message}`).join('; ')}`
          : '';
        throw new Error((json.error || 'Submission failed') + issues);
      }
      setNotice(`Participant application submitted — status: ${json.applicationStatus ?? 'submitted'}`);
      void loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }, [agentName, agentType, agentDescription, agentCardUrl, agentCapabilities, displayName, delegationBound, delegationBand, delegationTtl, loadStatus]);

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
    passportClass === 'participant'
      ? PARTICIPANT_CONSENT_LABELS.every((item) => checks[item.key] === true)
      : [...ACK_LABELS, ...CONSENT_LABELS].every((item) => checks[item.key] === true);

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
    { id: 'class', label: 'Class', icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'account', label: 'Account', icon: <UserPlus className="h-4 w-4" /> },
    { id: 'identity', label: 'Identity', icon: <KeyRound className="h-4 w-4" /> },
    ...(passportClass === 'participant'
      ? [{ id: 'agent' as StepId, label: 'Agent', icon: <Bot className="h-4 w-4" /> }]
      : [{ id: 'vault' as StepId, label: 'Private Vault', icon: <Lock className="h-4 w-4" /> }]),
    { id: 'consents', label: 'Consents', icon: <FileCheck2 className="h-4 w-4" /> },
    { id: 'submit', label: 'Submit', icon: <Send className="h-4 w-4" /> },
  ];

  // Tier-3 right-justified context badge — shows which passport class the
  // applicant has chosen. Portaled into SubHeaderSlot so it sits on the same
  // row as the Apply/Registry tabs, right-aligned via ml-auto.
  const tierBadge = step !== 'class' ? (
    <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
      <ShieldCheck className="h-3 w-3" />
      {passportClass === 'participant' ? 'Participant Application' : 'Citizen Application'}
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {subHeaderSlotEl && tierBadge ? createPortal(tierBadge, subHeaderSlotEl) : null}
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {passportClass === 'participant' ? 'Participant Passport Application' : 'Citizen Passport Application'}
          </h2>
          <p className="text-sm text-slate-400">
            {passportClass === 'participant'
              ? 'Apply for a passport for an agent and bind it to yourself with a bounded delegation.'
              : 'Anonymous proof of personhood. Your private data stays in your custody — always.'}
          </p>
        </div>
      </div>

      {/* Step strip — rounded-rectangle boxes, equal-width, one row.
          Replaces the prior pill design which wrapped to two lines on
          'Private Vault'. Per operator note 2026-06-13: 'use a better
          kind of more polished looking boxes... still rounded corners'. */}
      <div className="grid grid-cols-6 gap-2">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={cls(
              'group relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-300 whitespace-nowrap overflow-hidden',
              step === s.id
                ? 'bg-violet-600/90 text-white ring-1 ring-violet-400/60 shadow-md shadow-violet-900/30'
                : 'bg-slate-800/60 text-slate-400 ring-1 ring-slate-700/40 hover:bg-slate-700/70 hover:text-slate-200 hover:ring-slate-600/60',
            )}
          >
            <span className="shrink-0 opacity-80 group-hover:opacity-100">{s.icon}</span>
            <span className="truncate">
              <span className="opacity-60">{i + 1}.</span> {s.label}
            </span>
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

      {step === 'class' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">Who is this passport for?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleClassChoice('citizen')}
              className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-violet-500/60 hover:bg-slate-800"
            >
              <User className="h-6 w-6 text-violet-400" />
              <span className="text-sm font-semibold text-slate-100">Citizen Passport</span>
              <span className="text-xs text-slate-400">
                For you — anonymous proof of personhood with self-custody privacy.
              </span>
            </button>
            <button
              onClick={() => handleClassChoice('participant')}
              className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-violet-500/60 hover:bg-slate-800"
            >
              <Bot className="h-6 w-6 text-violet-400" />
              <span className="text-sm font-semibold text-slate-100">Participant Passport</span>
              <span className="text-xs text-slate-400">
                For an agent you operate — bound to you via an AgentiQ OS bounded delegation.
              </span>
            </button>
          </div>
        </div>
      )}

      {step === 'agent' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            Describe the agent this passport is for, then bind it to yourself. The Bureau anchors
            participant identity on the agent card URL.
          </p>

          {/* Agent Card source toggle (Sprint 3) */}
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => { setAgentCardSource('genesis'); setGenesisCompleted(false); }}
              className={cls(
                'rounded px-3 py-1.5',
                agentCardSource === 'genesis' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400',
              )}
            >
              Genesis a new agent (recommended)
            </button>
            <button
              type="button"
              onClick={() => { setAgentCardSource('url'); setGenesisCompleted(false); }}
              className={cls(
                'rounded px-3 py-1.5',
                agentCardSource === 'url' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400',
              )}
            >
              Paste existing Agent Card URL
            </button>
          </div>

          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Agent display name (e.g. Aletheon)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />

          {agentCardSource === 'genesis' ? (
            <div className="space-y-2 rounded-lg border border-violet-700/40 bg-violet-900/10 p-3">
              <p className="text-[11px] text-violet-300">
                Genesis path — we provision a stable Agent Card URL at /api/agents/&lt;slug&gt;/agent-card.json bound to your Citizen Passport.
              </p>
              <input
                value={genesisSlug}
                onChange={(e) => setGenesisSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="Agent slug (lowercase, 3–41 chars, e.g. aletheon)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <input
                value={genesisSponsorPassportId}
                onChange={(e) => setGenesisSponsorPassportId(e.target.value.trim())}
                placeholder="Your Citizen Passport ID (find it in the wallet PassportQube section)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={handleGenesisAgent}
                disabled={genesisBusy || genesisCompleted}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {genesisBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                {genesisCompleted ? 'Agent Card live' : 'Sponsor agent & generate card'}
              </button>
              {genesisCompleted && (
                <code className="block text-[10px] text-emerald-300 font-mono break-all">{agentCardUrl}</code>
              )}
            </div>
          ) : (
            <input
              value={agentCardUrl}
              onChange={(e) => setAgentCardUrl(e.target.value)}
              placeholder="Agent card URL (A2A agent-card.json — the identity anchor)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          )}
          <input
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            placeholder="Agent type (e.g. general, research, outreach)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <textarea
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
            placeholder="What does this agent do? (optional)"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <input
            value={agentCapabilities}
            onChange={(e) => setAgentCapabilities(e.target.value)}
            placeholder="Declared capabilities, comma-separated (optional)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="space-y-2 rounded-lg border border-slate-700/70 bg-slate-800/40 p-3">
            <p className="text-xs font-semibold text-slate-300">
              Bind agent to you — bounded delegation (AgentiQ OS)
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={delegationBand}
                onChange={(e) => setDelegationBand(e.target.value)}
                title="Trust band — caps what the bound agent may do under your delegation"
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              >
                {DELEGATION_TRUST_BANDS.map((band) => (
                  <option key={band} value={band}>{band.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select
                value={delegationTtl}
                onChange={(e) => setDelegationTtl(Number(e.target.value))}
                title="How long the delegation grant lives before it expires"
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
              </select>
              <button
                onClick={handleDelegationBind}
                disabled={busy || delegationBound}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                {delegationBound ? 'Agent bound to you' : 'Bind agent to me'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Grants the agent a bounded, time-limited delegation under your persona — the same
              grant surface as the AgentiQ OS Bounded Delegation tab.
            </p>
          </div>
          <button
            onClick={() => setStep('consents')}
            disabled={!agentName.trim() || !agentCardUrl.trim()}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <FileCheck2 className="h-4 w-4" />
            Continue to consents
          </button>
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
          {passportClass === 'participant' ? (
            <>
              <h3 className="text-sm font-semibold text-slate-200">
                Participant consents (all four required)
              </h3>
              {PARTICIPANT_CONSENT_LABELS.map(({ key, label }) => (
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
            </>
          ) : (
            <>
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
            </>
          )}
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

      {step === 'submit' && passportClass === 'participant' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            Submit the participant application for <strong>{agentName || 'your agent'}</strong>.
            A steward reviews it in the Bureau queue; you can watch status below.
          </p>
          {!delegationBound && (
            <p className="text-xs text-amber-300">
              Note: the agent is not yet bound to you via bounded delegation — you can still submit,
              but binding is recommended before activation.
            </p>
          )}
          <button
            onClick={handleSubmitParticipant}
            disabled={busy || !allChecked || !agentName.trim() || !agentCardUrl.trim()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit participant application
          </button>
        </div>
      )}

      {step === 'submit' && passportClass === 'citizen' && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            One last check that you are a person, then submit.
          </p>
          {TURNSTILE_SITE_KEY ? (
            <>
              <div ref={turnstileRef} />
              {captchaToken && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Personhood check passed
                </p>
              )}
            </>
          ) : (
            <input
              value={captchaToken}
              onChange={(e) => setCaptchaToken(e.target.value)}
              placeholder="Proof token (CAPTCHA — dev tokens start with 'dev-')"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          )}
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
