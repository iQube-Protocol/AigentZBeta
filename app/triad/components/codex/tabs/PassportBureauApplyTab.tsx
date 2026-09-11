'use client';

/**
 * PassportBureauApplyTab — passport application wizard (Stage 3 UI).
 *
 * PRD §9: applicants choose a passport class up front —
 *   • Citizen — anonymous personhood (the original five-panel flow):
 *     account → identity → private vault → consents → submit
 *   • Participant — sponsors a Polity Agent Passport for an agent bound to
 *     the applicant. The vault panel is replaced by an Agent panel that
 *     captures the agent's identity and establishes sponsor eligibility from
 *     the applicant's claimed Citizen Passport, then submits through
 *     /api/polity-passport/submit.
 *
 * DELEGATION IS NOT PART OF THIS CEREMONY (semantic repair, 2026-08-25).
 * Passport issuance/sponsorship and bounded-delegation grant issuance are
 * constitutionally distinct acts with distinct receipts (`passport_issued`
 * vs `agent_delegated`) — this component MUST NOT create a delegation grant.
 * Granting operational authority to an agent happens ONLY afterward, at the
 * Journey's own dedicated delegation stage (`delegate` /
 * `delegation-establish`), through the canonical `BoundedDelegationTab`
 * (the same `/api/codex/chat/agentiq-os/delegation` surface). Earlier
 * revisions of this component called that same endpoint directly from
 * inside the Agent step — that coupling has been removed; do not reintroduce
 * it here.
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
  Zap,
  Star,
  GitBranch,
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
import {
  resolveCitizenStepAfterClassChoice,
  resolveCitizenStepAfterAccountCreation,
  resolveDelegateStepAfterClassChoice,
  wizardSteps,
  hasApprovedCitizenApplication,
  type StepId,
  type PassportClass,
} from '@/services/passport/passportWizardSteps';
import { personaFetch } from '@/utils/personaSpine';

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
  { key: 'participant_terms_accepted', label: 'I accept the Polity Agent Passport terms on behalf of this agent.' },
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

interface PassportBureauApplyTabProps {
  /** The operator's own persona, when known (e.g. the Guided Journey
   * Runtime's PilotJourneyTab already resolves this) — passed to
   * personaFetch as personaIdHint so this component's Citizen-Passport
   * check resolves the SAME persona the caller is scoped to, instead of an
   * independently-resolved (and possibly disagreeing) fallback persona.
   * See CLAUDE.md's Identity & Access Spine rule: "a component that reads
   * X via one transport and Y via another will show a self-contradictory
   * state" — this was exactly that gap. */
  personaId?: string;
  /** Journey-context prefill (Guided Journey Runtime): when the operator
   * arrives at this stage having already registered/selected a specific
   * agent (e.g. Nakamoto in the Register stage), her real Agent Card is
   * already known — defaults the "Paste existing Agent Card URL" tab active
   * and auto-runs the existing fetch-and-autofill against it, rather than
   * leaving the operator to notice, copy, and re-paste a URL the platform
   * already has. */
  prefillAgentCardUrl?: string;
  prefillAgentDisplayName?: string;
  /**
   * THE DECISION, MADE BY THE OBSERVER — not re-asked here.
   *
   * ── Why this exists (operator, 2026-08-03) ─────────────────────────────
   *
   *   > "In the passport step the decision should be: is passport present?
   *   >  Yes = move to agent delegation path. No = move to citizen passport
   *   >  path."
   *
   * The wizard opens on a class picker ("Who is this Passport for?"). Inside
   * the Guided Journey that question is already answered: the journey's
   * observer has read the operator's canonical Citizen Passport and reports
   * it as `operatorPolityCitizenPassportValid`. Asking again put a decision
   * to the operator that the system had already made, and offered "apply for
   * a Citizen Passport" to someone holding one.
   *
   * `'delegate'`  — a Citizen Passport is present; go straight to the agent
   *                 delegation path.
   * `'citizen'`   — none present; go to the Citizen Passport path.
   * `undefined`   — no observer answer (standalone use of this tab, or the
   *                 state read has not resolved). The class picker renders,
   *                 which is the honest behaviour when nothing is known —
   *                 never a guess in either direction.
   */
  routeTo?: 'citizen' | 'delegate';
  /**
   * CFS-055 coherence pass (2026-08-12, second invocation wired 2026-08-13)
   * — the SMALLEST outward signal this component gives when it has just
   * witnessed a consequential Passport state change. TWO real call sites,
   * both positive confirmations, never a proxy for one:
   *
   *   1. Account-step sign-in (Bureau OR wallet auth) — `/api/passport/
   *      usable-status` positively confirms an EXISTING usable Citizen
   *      Passport for the now-authenticated caller.
   *   2. In-flow issuance — `applications` (populated by the existing
   *      `loadStatus()`) shows a citizen application that has moved to
   *      `applicationStatus === 'approved'` (`hasApprovedCitizenApplication`,
   *      services/passport/passportWizardSteps.ts) — the exact moment
   *      services/passport/issuanceService.ts issues the citizen record
   *      with `citizen_status: 'active'`. Mere SUBMISSION
   *      (`applicationStatus === 'submitted'`) never fires this — that is
   *      not issuance, and firing on it would be exactly the premature
   *      signal this callback exists to avoid.
   *
   * This callback carries NO payload and asserts NOTHING — it never passes
   * `true` upward as constitutional truth. The caller's own job is to turn
   * it into a request that the enclosing Journey observer reread
   * authoritative state (e.g. `JourneyRunSurface`'s `requestStateRefresh()`,
   * threaded down through `resolveSurfaceProps`) — this component has no
   * opinion on HOW that happens, and never mutates any stage's completion
   * itself. Optional: every caller that doesn't pass it (standalone Bureau
   * access, Horizen's PilotJourneyTab) is unaffected.
   */
  onUsablePassportDetected?: () => void;
  /**
   * OCSGA Presence recognition fix (2026-08-27) — when the enclosing Journey
   * observer has ALREADY resolved (server-side, via
   * services/identity/passportPrincipal.ts's `loadUsableCitizenPassportForAuthProfile`,
   * authProfileId-scoped — never persona-upward) that the caller holds a
   * usable Citizen Passport, seed the SAME recognized-state short-circuit
   * this component's own Account-step sign-in check
   * (`/api/passport/usable-status`) sets via `existingUsablePassport`. Without
   * this, an already-platform-authenticated caller who never goes through
   * this wizard's OWN internal Bureau-account sign-in sub-step (e.g. an agent
   * persona like Aigent Z acting for a principal who claimed their Citizen
   * Passport under their own persona) never triggers that internal check, so
   * the raw class-selection screen rendered instead of the recognized state —
   * the exact defect this prop closes. Optional: every caller that doesn't
   * pass it (standalone Bureau access, Horizen's PilotJourneyTab) is
   * unaffected — `existingUsablePassport` simply starts `false`, as before.
   */
  initialUsablePassport?: boolean;
  /** Recognized Passport class to display in the banner (never required). */
  initialPassportClass?: string | null;
  /** T2-safe recognized Passport reference to display (never the raw UUID). */
  initialPassportRef?: string | null;
}

export function PassportBureauApplyTab({
  personaId,
  prefillAgentCardUrl,
  prefillAgentDisplayName,
  routeTo,
  onUsablePassportDetected,
  initialUsablePassport,
  initialPassportClass,
  initialPassportRef,
}: PassportBureauApplyTabProps = {}) {
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);
  const [step, setStep] = useState<StepId>('class');
  const [passportClass, setPassportClass] = useState<PassportClass>('citizen');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // VSP standing credential — fetched lazily for vault step
  const [vspSummary, setVspSummary] = useState<{
    label: string; compiledAt: string | null; factCount: number;
    domains: string[]; anchoredToPassport: boolean; capabilityClaimCount: number;
  } | null>(null);
  const [vspLoading, setVspLoading] = useState(false);
  useEffect(() => {
    if (step !== 'vault') return;
    setVspLoading(true);
    authedFetchHeaders().then(headers =>
      fetch('/api/vsp/persona', { headers, cache: 'no-store' })
        .then(r => r.json())
        .then(j => { if (j.ok && j.primaryProfile) setVspSummary(j.primaryProfile); })
        .catch(() => {})
        .finally(() => setVspLoading(false))
    ).catch(() => setVspLoading(false));
  }, [step]);

  // Participant — agent identity.
  // `signIn` is the SAME canonical wallet authentication call
  // SmartWalletDrawer uses (services/wallet, via this shared hook) — reused
  // directly by the account step's wallet-email sign-in path below, never
  // duplicated (2026-08-12).
  const { signIn: signInWithWalletAuth } = useSupabaseSessionPersonas();
  const [agentName, setAgentName] = useState(prefillAgentDisplayName ?? '');
  const [agentType, setAgentType] = useState('general');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentCardUrl, setAgentCardUrl] = useState(prefillAgentCardUrl ?? '');
  const [agentCapabilities, setAgentCapabilities] = useState('');

  // Agent Card source: 'genesis' (we create it) or 'url' (user pastes existing).
  // Sprint 3 adds the genesis path — the non-technical user can sponsor a new
  // agent without hosting their own card. When the journey already knows
  // which agent's card to sponsor (prefillAgentCardUrl), default straight to
  // the 'url' tab — 'genesis' (create a brand-new agent) is the wrong default
  // when the operator's actual intent is to sponsor an agent that already
  // exists and already has a published card.
  const [agentCardSource, setAgentCardSource] = useState<'genesis' | 'url' | 'quick'>(prefillAgentCardUrl ? 'url' : 'genesis');
  const [genesisSlug, setGenesisSlug] = useState('');
  const [genesisSponsorPassportId, setGenesisSponsorPassportId] = useState('');
  const [genesisBusy, setGenesisBusy] = useState(false);
  const [genesisCompleted, setGenesisCompleted] = useState(false);

  // aigentMe designation — when checked, the generated agent (card + the
  // participant passport it earns) becomes the citizen's aigentMe, mapped to
  // their persona + citizen passport + wallet via the is_aigent_me flag. One
  // per persona; the toggle disables when an aigentMe already exists.
  const [makeAigentMe, setMakeAigentMe] = useState(false);
  const [existingAigentMe, setExistingAigentMe] = useState<{ displayName: string } | null>(null);
  // Admin gate for the Option A (autonomous agent) stub.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    authedFetchHeaders()
      .then((headers) =>
        Promise.all([
          fetch('/api/agents/aigentme', { headers, cache: 'no-store' })
            .then((r) => r.json())
            .then((j) => {
              if (!cancelled && j?.ok && j.agent) {
                setExistingAigentMe({ displayName: String(j.agent.displayName ?? 'aigentMe') });
              }
            })
            .catch(() => {}),
          fetch('/api/wallet/active-persona', { headers, cache: 'no-store' })
            .then((r) => r.json())
            .then((j) => {
              if (!cancelled) setIsAdmin(Boolean(j?.cartridgeFlags?.isAdmin));
            })
            .catch(() => {}),
        ]),
      )
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Sponsorship/approval-dependency display (Guided Journey Runtime —
  // Citizen-to-agent continuation). handleQuickAgent/handleDeployAutonomous
  // already REFUSE server-side without a claimed Citizen Passport, but that
  // only surfaced reactively, as an error AFTER the operator clicked
  // "Generate & bind agent" — exactly the pattern the "Continue with my
  // agent?" flow makes likely to hit immediately (a Citizen application can
  // be SUBMITTED without being CLAIMED yet). This proactively shows the real
  // dependency the moment the Agent step is reached, so the button disables
  // itself instead of failing after the fact.
  const [sponsorEligibility, setSponsorEligibility] = useState<
    { status: 'loading' | 'claimed' | 'pending' | 'none'; detail: string } | null
  >(null);
  useEffect(() => {
    if (step !== 'agent') return;
    let cancelled = false;
    setSponsorEligibility({ status: 'loading', detail: 'Checking sponsorship eligibility…' });
    personaFetch('/api/polity-passport/wallet', { cache: 'no-store', personaIdHint: personaId })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const passportQubes = (json?.passportQubes ?? []) as Array<{
          passportId: string; passportClass: string; claimedAt: string | null; claimableReason?: string | null;
        }>;
        const claimed = passportQubes.find((pq) => pq.claimedAt && pq.passportClass === 'citizen')
          ?? passportQubes.find((pq) => pq.claimedAt);
        if (claimed) {
          if (!cancelled) setSponsorEligibility({ status: 'claimed', detail: `Citizen Passport ${claimed.passportId} is claimed — ready to sponsor.` });
          return;
        }
        const unclaimedCitizen = passportQubes.find((pq) => pq.passportClass === 'citizen');
        if (unclaimedCitizen) {
          if (!cancelled) {
            setSponsorEligibility({
              status: 'pending',
              detail: unclaimedCitizen.claimableReason
                ? `Citizen Passport issued but not yet claimed — ${unclaimedCitizen.claimableReason}.`
                : 'Citizen Passport issued but not yet claimed.',
            });
          }
          return;
        }
        const pendingApplications = (json?.pendingApplications ?? []) as Array<{ passportClass: string; applicationStatus: string }>;
        const pendingCitizenApp = pendingApplications.find((a) => a.passportClass === 'citizen');
        if (pendingCitizenApp) {
          if (!cancelled) {
            setSponsorEligibility({
              status: 'pending',
              detail: `Citizen application ${pendingCitizenApp.applicationStatus.replace(/_/g, ' ')} — not yet claimed.`,
            });
          }
          return;
        }
        if (!cancelled) {
          setSponsorEligibility({
            status: 'none',
            detail: 'No Citizen Passport application yet — a Polity Agent Passport is sponsored from a claimed Citizen Passport.',
          });
        }
      })
      .catch(() => { if (!cancelled) setSponsorEligibility(null); });
    return () => { cancelled = true; };
  }, [step, personaId]);

  // Option A (admin-only) — deploy an autonomous agent. Binds to the current
  // constitution; agent class only (no kybe / citizenship), enforced server-side.
  const [autonomousBusy, setAutonomousBusy] = useState(false);
  const [autonomousDeployed, setAutonomousDeployed] = useState<string | null>(null);
  const handleDeployAutonomous = useCallback(async () => {
    setAutonomousBusy(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders();
      const walletRes = await fetch('/api/polity-passport/wallet', { headers, cache: 'no-store' });
      const walletData = await walletRes.json();
      const claimed = (walletData?.passportQubes ?? []).find(
        (pq: { claimedAt: string | null; passportClass?: string }) => pq.claimedAt && pq.passportClass === 'citizen',
      ) ?? (walletData?.passportQubes ?? []).find((pq: { claimedAt: string | null }) => pq.claimedAt);
      if (!claimed) {
        setError('A claimed Citizen Passport is required to sponsor an autonomous agent (no orphaned agents).');
        return;
      }
      const name = agentName.trim() || 'Autonomous Agent';
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'autonomous-agent';
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const r = await fetch('/api/agents/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          slug,
          displayName: name,
          description: agentDescription.trim() || 'Autonomous agent — delegated instrument, no sovereignty.',
          sponsorPassportId: claimed.passportId,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error ?? 'Autonomous agent deploy failed');
        return;
      }
      setAutonomousDeployed(data.agent.agentCardUrl);
      setNotice(`Autonomous agent deployed — Agent Card live at ${data.agent.agentCardUrl}. Bound to Constitution ${data.constitutionalBinding?.constitutionVersion}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setAutonomousBusy(false);
    }
  }, [agentName, agentDescription]);

  const handleQuickAgent = useCallback(async () => {
    setGenesisBusy(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders();
      const walletRes = await fetch('/api/polity-passport/wallet', { headers, cache: 'no-store' });
      const walletData = await walletRes.json();
      const claimed = (walletData?.passportQubes ?? []).find(
        (pq: { claimedAt: string | null }) => pq.claimedAt,
      );
      if (!claimed) {
        setError('You need a claimed Polity Citizen Passport first — a Polity Agent Passport is sponsored from one. Apply as a Citizen, then come back here.');
        return;
      }
      const name = agentName.trim() || 'Polity Helper';
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'polity-helper';
      const suffix = Math.random().toString(36).slice(2, 6);
      const slug = `${baseSlug}-${suffix}`;
      const desc = agentDescription.trim() || 'General-purpose polity helper agent';
      const r = await fetch('/api/agents/genesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          slug,
          displayName: name,
          description: desc,
          sponsorPassportId: claimed.passportId,
          isAigentMe: makeAigentMe,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error ?? 'Agent genesis failed');
        return;
      }
      setAgentName(name);
      setAgentDescription(desc);
      setGenesisSlug(slug);
      setGenesisSponsorPassportId(claimed.passportId);
      setAgentCardUrl(data.agent.agentCardUrl);
      setGenesisCompleted(true);
      if (data.agent.isAigentMe) setExistingAigentMe({ displayName: name });
      setNotice(
        data.agent.isAigentMe
          ? `aigentMe Agent Card live at ${data.agent.agentCardUrl} — its Polity Agent Passport will map to your aigentMe.`
          : `Agent Card live at ${data.agent.agentCardUrl}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenesisBusy(false);
    }
  }, [agentName, agentDescription, makeAigentMe]);

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
          isAigentMe: makeAigentMe,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error ?? 'Agent genesis failed');
        return;
      }
      setAgentCardUrl(data.agent.agentCardUrl);
      setGenesisCompleted(true);
      if (data.agent.isAigentMe) setExistingAigentMe({ displayName: agentName.trim() });
      setNotice(
        data.agent.isAigentMe
          ? `aigentMe Agent Card live at ${data.agent.agentCardUrl} — submit below to sponsor your aigentMe's Polity Agent Passport.`
          : `Agent Card live at ${data.agent.agentCardUrl} — submit below to sponsor a Polity Agent Passport for ${agentName.trim()}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenesisBusy(false);
    }
  }, [agentName, agentDescription, genesisSlug, genesisSponsorPassportId, makeAigentMe]);

  // Agent Card autofill (Delegate/agent route, "Paste existing Agent Card
  // URL" path). Without this, name/description/capabilities had to be
  // re-typed by hand even though the pasted card already publishes them —
  // a coherence risk (the application could say something the card itself
  // disagrees with) as well as needless data entry. Never overwrites a
  // field the card doesn't itself declare; never invents a value the card
  // doesn't have.
  const [cardFetchBusy, setCardFetchBusy] = useState(false);
  const [cardFetchError, setCardFetchError] = useState<string | null>(null);
  const handleFetchCardDetails = useCallback(async () => {
    const url = agentCardUrl.trim();
    if (!url) return;
    setCardFetchBusy(true);
    setCardFetchError(null);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Could not fetch Agent Card (HTTP ${res.status})`);
      const card = await res.json();
      if (typeof card?.name === 'string' && card.name.trim()) setAgentName(card.name.trim());
      if (typeof card?.description === 'string' && card.description.trim()) setAgentDescription(card.description.trim());
      const skillNames = Array.isArray(card?.skills)
        ? card.skills
            .map((s: unknown) => (s && typeof s === 'object' ? (s as Record<string, unknown>).name : undefined))
            .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0)
        : [];
      if (skillNames.length > 0) setAgentCapabilities(skillNames.join(', '));
      const runtimeAgentId = card?.metadata?.runtime_agent_id;
      if (typeof runtimeAgentId === 'string' && runtimeAgentId.trim()) setAgentType(runtimeAgentId.trim());
    } catch (e) {
      setCardFetchError(e instanceof Error ? e.message : 'Could not fetch Agent Card');
    } finally {
      setCardFetchBusy(false);
    }
  }, [agentCardUrl]);

  // Guided Journey Runtime prefill: when the operator arrives already
  // sponsoring a specific, known agent (prefillAgentCardUrl), auto-run the
  // same fetch-and-autofill the "Fetch & autofill" button triggers manually
  // — never leaving a known Agent Card unfilled for the operator to notice
  // and re-paste by hand. Runs once per distinct prefill URL; does not
  // re-run if the operator edits the field afterward.
  const prefillRanForUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!prefillAgentCardUrl || prefillRanForUrl.current === prefillAgentCardUrl) return;
    prefillRanForUrl.current = prefillAgentCardUrl;
    void handleFetchCardDetails();
  }, [prefillAgentCardUrl, handleFetchCardDetails]);

  // Step 1 — account
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [signedIn, setSignedIn] = useState(false);
  /** Set right after a successful Account-step sign-in (Bureau OR wallet)
   *  when /api/passport/usable-status reports the now-authenticated caller
   *  already holds a usable Citizen Passport — short-circuits the wizard
   *  instead of re-running personhood binding / vault / consents / submit.
   *  Seeded from `initialUsablePassport` (OCSGA Presence recognition fix,
   *  2026-08-27) so an enclosing Journey observer's ALREADY-resolved
   *  server-side fact shows this same recognized state immediately, without
   *  requiring the caller to go through this wizard's own internal
   *  Bureau-account sign-in sub-step first. */
  const [existingUsablePassport, setExistingUsablePassport] = useState(Boolean(initialUsablePassport));
  /** Recognized Passport class/ref to display in the banner — seeded from
   *  props (server-resolved) and never re-derived client-side; this
   *  component's own internal Bureau-account detection path does not (yet)
   *  resolve class/ref, so these stay whatever the enclosing Journey passed
   *  in — `null` when unset, never fabricated. */
  const [recognizedPassportClass] = useState<string | null>(initialPassportClass ?? null);
  const [recognizedPassportRef] = useState<string | null>(initialPassportRef ?? null);

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
  // Citizen-to-agent continuation (Guided Journey Runtime — Continuity
  // Without Premature Approval): offered once, right after a successful
  // Citizen submission, in this same session.
  const [citizenJustSubmitted, setCitizenJustSubmitted] = useState(false);
  const [continuationDismissed, setContinuationDismissed] = useState(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  /*
   * SECOND onUsablePassportDetected INVOCATION (CFS-055 coherence pass,
   * 2026-08-13) — the in-flow completion path this callback's own doc
   * comment already promised. `applications` is populated by the EXISTING
   * `loadStatus()` (called at session restore, after Account, and after
   * Submit — no new fetch introduced here). Whenever it comes back
   * showing a citizen application that has moved to 'approved' —
   * `hasApprovedCitizenApplication`'s exact predicate, which is NEVER true
   * for 'submitted'/'pending_approval'/'needs_more_information'/'denied'
   * — that is the canonical, positive confirmation that a Citizen Passport
   * was just issued (services/passport/issuanceService.ts sets
   * `citizen_status: 'active'` at the SAME moment a steward's decision
   * sets `application_status: 'approved'`). Fires at most once per mount
   * (the ref guards against re-firing on every subsequent loadStatus()
   * call once already detected), after the same ~500ms confirmation
   * interval as the Account-step invocation, and never mutates any
   * journey/stage state itself — it only asks, exactly like the other
   * invocation.
   */
  const approvedCitizenNotifiedRef = useRef(false);
  useEffect(() => {
    if (approvedCitizenNotifiedRef.current) return;
    if (!hasApprovedCitizenApplication(applications)) return;
    approvedCitizenNotifiedRef.current = true;
    if (onUsablePassportDetected) {
      setTimeout(() => onUsablePassportDetected(), 500);
    }
  }, [applications, onUsablePassportDetected]);

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
      // Account–Personhood Separation: a Supabase session from the broader
      // platform (the operator's normal login) is NOT a Bureau account. If
      // `signedIn` treated any session as sufficient, an already-logged-in
      // operator applying as Citizen would silently skip the Account step
      // and never create the Bureau persona that step exists to create —
      // the KybeDID bind that follows has nothing to bind. Only a session
      // whose email is the Bureau's own synthetic-account domain (minted by
      // handleAccount below) counts.
      const email = data?.session?.user?.email;
      if (email && email.endsWith('@passport.metame.internal')) {
        setSignedIn(true);
        void loadStatus();
      }
    })();
  }, [loadStatus]);

  const handleClassChoice = useCallback(
    (chosen: PassportClass) => {
      setPassportClass(chosen);
      setChecks({});
      // Two fully independent resolvers (services/passport/passportWizardSteps.ts)
      // — never a single function branching on `chosen` internally. That
      // shape is what caused the 2026-07-31 regression where a Delegate/
      // agent applicant was routed through the human Account step.
      setStep(chosen === 'participant' ? resolveDelegateStepAfterClassChoice() : resolveCitizenStepAfterClassChoice(signedIn));
    },
    [signedIn],
  );

  /*
   * THE OBSERVER'S ANSWER, APPLIED ONCE (operator, 2026-08-03):
   *
   *   is passport present?  yes → agent delegation path
   *                         no  → citizen passport path
   *
   * Routed through `handleClassChoice`, deliberately, so the SAME two
   * resolvers decide the entry step as when the operator picks by hand — a
   * second path into the wizard would be free to diverge from the first, which
   * is exactly how the Delegate-through-the-Account-step regression happened.
   *
   * Guarded on `step === 'class'` so it only ever replaces the QUESTION, never
   * a decision already in progress: once the operator has moved off the class
   * step, a late-arriving observer read must not yank them back.
   */
  const autoRoutedRef = useRef(false);
  useEffect(() => {
    if (!routeTo || autoRoutedRef.current || step !== 'class') return;
    autoRoutedRef.current = true;
    handleClassChoice(routeTo === 'delegate' ? 'participant' : 'citizen');
  }, [routeTo, step, handleClassChoice]);

  const handleAccount = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const identifier = username.trim();
      if (mode === 'signup') {
        // UNCHANGED — Bureau persona-name + password account creation.
        const res = await fetch('/api/passport/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, recoveryEmail: recoveryEmail || undefined }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Signup failed');
        setNotice(json.recoveryPolicy?.warning ?? null);
        const syntheticEmail = `${identifier.toLowerCase()}@passport.metame.internal`;
        const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
          email: syntheticEmail,
          password,
        });
        if (signInError) throw new Error(signInError.message);
      } else {
        /*
         * SIGN IN — two identifiers, one field (operator directive,
         * 2026-08-12: "Persona name, username, or email").
         *
         * A Bureau persona name can NEVER contain "@" — validateBureauUsername
         * (services/passport/bureauIdentityService.ts) only ever allows
         * lowercase letters, digits and hyphens — so testing for "@" is an
         * unambiguous, lossless split, never a heuristic that could
         * misroute a valid Bureau sign-in:
         *
         *   contains "@"   → an existing wallet's real email. Resolved
         *                    through the EXACT canonical wallet
         *                    authentication call SmartWalletDrawer itself
         *                    uses (useSupabaseSessionPersonas's `signIn`,
         *                    which calls supabase.auth.signInWithPassword)
         *                    — never a parallel password verifier.
         *   no "@"         → the existing Bureau persona-name path,
         *                    byte-for-byte unchanged (synthetic email +
         *                    signInWithPassword).
         *
         * A distinct "wallet username" identifier does not exist in the
         * canonical wallet auth service today (Supabase Auth resolves by
         * email only) — CLAUDE.md's No-Guessing rule forbids inventing a
         * second lookup for one, so this stays exactly the two real paths.
         */
        if (identifier.includes('@')) {
          const { error } = await signInWithWalletAuth(identifier, password);
          if (error) throw new Error(error);
        } else {
          const syntheticEmail = `${identifier.toLowerCase()}@passport.metame.internal`;
          const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
            email: syntheticEmail,
            password,
          });
          if (signInError) throw new Error(signInError.message);
        }
      }
      setSignedIn(true);

      /*
       * Authentication resolves an existing usable Citizen Passport before
       * continuing (operator directive: "C. Existing Passport holder —
       * Authentication resolves existing usable Passport; no duplicate
       * Passport issuance"). Applies uniformly to the Bureau path and the
       * wallet path alike — a returning holder, however they just
       * authenticated, is never pushed through personhood binding / vault /
       * consents / submit a second time. Best-effort: a failed check simply
       * falls through to the existing continuation, never blocking sign-in.
       */
      let alreadyHasPassport = false;
      try {
        const headers = await authedFetchHeaders();
        const statusRes = await fetch('/api/passport/usable-status', { headers, cache: 'no-store' });
        const statusJson = await statusRes.json();
        alreadyHasPassport = Boolean(statusJson?.ok && statusJson.usable);
      } catch {
        /* best-effort — falls through to the normal continuation */
      }

      if (alreadyHasPassport) {
        setExistingUsablePassport(true);
        setNotice('You already hold an active Polity Citizen Passport — no need to apply again.');
        /*
         * CFS-055 coherence pass (2026-08-12): this component's OWN state
         * (`existingUsablePassport`) is a local confirmation, never the
         * constitutional truth the enclosing Journey acts on — the
         * emerald banner above renders from it immediately, but the
         * Passport STAGE only becomes COMPLETE once the Journey observer
         * independently rereads `loadUsableCitizenPassportForAuthProfile`
         * via its own `/state` route. The ~500ms delay lets the visitor
         * actually see this confirmation before the enclosing surface
         * potentially swaps to the post-Passport room underneath it.
         */
        if (onUsablePassportDetected) {
          setTimeout(() => onUsablePassportDetected(), 500);
        }
      } else {
        // Only the Citizen route ever reaches this step — Delegate/agent
        // applicants never visit Account (resolveDelegateStepAfterClassChoice
        // sends them straight to 'agent' from Class).
        setStep(resolveCitizenStepAfterAccountCreation());
      }
      void loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account step failed');
    } finally {
      setBusy(false);
    }
  }, [username, password, recoveryEmail, mode, loadStatus, signInWithWalletAuth, onUsablePassportDetected]);

  const handleBind = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const hasAuth = headers && typeof headers === 'object' && 'Authorization' in headers;
      if (!hasAuth) {
        throw new Error('No auth session — please sign in first (Step 2).');
      }
      const res = await fetch('/api/passport/identity/bind', {
        method: 'POST',
        headers,
        // Defaults to the applicant's own persona name, never a hardcoded
        // placeholder — Persona–Personhood Separation still holds (the
        // persona name identifies how they act; personhood is bound
        // independently), but an unset display name shouldn't silently
        // become a generic label when we already know their persona name.
        body: JSON.stringify({ displayName: displayName || username || undefined }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: `Personhood bind failed (HTTP ${res.status})` }));
      if (!json.ok) throw new Error(json.error || 'Personhood bind failed');
      setBound(true);
      setKybeRef(json.kybePublicRef ?? null);
      setNotice(
        json.alreadyBound
          ? 'Personhood already bound — continuing with your existing KybeDID.'
          : json.existingRootDidMapped
            ? 'Existing platform personhood mapped — your KybeDID was reused.'
            : 'New KybeDID minted and bound.',
      );
      // Only the Citizen route ever reaches this step (Human Personhood
      // Exclusivity) — always continues to the private vault step.
      setStep('vault');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bind failed');
    } finally {
      setBusy(false);
    }
  }, [displayName, username]);

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
  }, [agentName, agentType, agentDescription, agentCardUrl, agentCapabilities, displayName, loadStatus]);

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
      if (!json.ok) {
        // Identity Hardening: one active Citizen Passport per identity. Surface
        // the guidance to apply as a Participant instead, naming the existing
        // passport rather than failing generically.
        if (json.code === 'citizen_passport_exists') {
          setError(
            `${json.error}${json.passportId ? ` (existing passport: ${json.passportId})` : ''}`,
          );
          return;
        }
        throw new Error(json.error || 'Submission failed');
      }
      setNotice(`Application submitted — status: ${json.applicationStatus}`);
      setCitizenJustSubmitted(true);
      void loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }, [captchaToken, vaultRef, loadStatus]);

  // "Continue with my agent?" — carries forward the active persona/principal
  // context (they're already signed in and have just submitted a Citizen
  // application) straight into the Agent step. Application continuity does
  // NOT collapse approval dependencies: the agent application may be
  // prepared and submitted here, but the existing genesis/sponsor checks
  // (handleQuickAgent above) still require a CLAIMED Citizen Passport before
  // an agent can actually be sponsored — submitting here does not bypass
  // that, it only avoids restarting the wizard from Class later.
  const handleContinueWithAgent = useCallback(() => {
    setPassportClass('participant');
    setChecks({});
    setStep('agent');
  }, []);

  // Branch by constitutional subject (Guided Journey Runtime invariant:
  // Branch by Constitutional Subject). The Delegate/agent route NEVER
  // shows Account or Personhood as steps at all — not even as mysteriously
  // skipped boxes — because an agent application never touches either.
  // Membership/order comes from the authoritative wizardSteps() rule
  // (services/passport/passportWizardSteps.ts); only label/icon are a UI
  // concern kept here.
  const STEP_META: Record<StepId, { label: string; icon: React.ReactNode }> = {
    class: { label: 'Class', icon: <ShieldCheck className="h-4 w-4" /> },
    account: { label: 'Account', icon: <UserPlus className="h-4 w-4" /> },
    identity: { label: 'Personhood', icon: <KeyRound className="h-4 w-4" /> },
    vault: { label: 'Private Vault', icon: <Lock className="h-4 w-4" /> },
    agent: { label: 'Agent', icon: <Bot className="h-4 w-4" /> },
    consents: { label: 'Consents', icon: <FileCheck2 className="h-4 w-4" /> },
    submit: { label: 'Submit', icon: <Send className="h-4 w-4" /> },
  };
  const steps: Array<{ id: StepId; label: string; icon: React.ReactNode }> = wizardSteps(passportClass).map(
    (id) => ({ id, ...STEP_META[id] }),
  );
  const stepGridClass = steps.length === 4 ? 'grid-cols-4' : 'grid-cols-6';

  // Tier-3 right-justified context badge — shows which passport class the
  // applicant has chosen. Portaled into SubHeaderSlot so it sits on the same
  // row as the Apply/Registry tabs, right-aligned via ml-auto.
  const tierBadge = step !== 'class' ? (
    <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
      <ShieldCheck className="h-3 w-3" />
      {passportClass === 'participant' ? 'Agent Application' : 'Citizen Application'}
    </div>
  ) : null;

  // Short-circuit: the account step's sign-in just resolved an existing
  // usable Citizen Passport for this caller (Bureau OR wallet auth) — never
  // re-run personhood binding / vault / consents / submit on a holder who
  // already has one. Checked before the step-strip/class-picker render, not
  // folded into a StepId, since it can arise from EITHER route's Account
  // step and is not itself a wizard stage.
  if (existingUsablePassport) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-700 bg-emerald-950/40 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">You already hold a Polity Citizen Passport</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Your constitutional presence is already established for this account — there is nothing
              further to apply for.
            </p>
            {(recognizedPassportClass || recognizedPassportRef) && (
              <p className="mt-1 text-xs text-slate-500">
                {recognizedPassportClass === 'citizen' ? 'Polity Citizen Passport' : recognizedPassportClass}
                {recognizedPassportRef ? ` — ref ${recognizedPassportRef}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {subHeaderSlotEl && tierBadge ? createPortal(tierBadge, subHeaderSlotEl) : null}
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {passportClass === 'participant' ? 'Polity Agent Passport Sponsorship' : 'Polity Citizen Passport Application'}
          </h2>
          <p className="text-sm text-slate-400">
            {passportClass === 'participant'
              ? 'Constitutional presence for an agent, sponsored from an eligible Polity Citizen Passport — never an independent personhood claim, and never itself a grant of delegated authority.'
              : 'Continuing constitutional personhood for a human principal. Your private data stays in your custody — always.'}
          </p>
        </div>
      </div>

      {/* Step strip — rounded-rectangle boxes, equal-width, one row.
          Replaces the prior pill design which wrapped to two lines on
          'Private Vault'. Per operator note 2026-06-13: 'use a better
          kind of more polished looking boxes... still rounded corners'.
          Step count/labels are derived from the selected class (One
          Journey, Conditional Steps) — never a fixed six-box line. */}
      <div className={cls('grid gap-2', stepGridClass)}>
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
          <p className="text-sm text-slate-300">Who is this Passport for?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleClassChoice('citizen')}
              className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-violet-500/60 hover:bg-slate-800"
            >
              <User className="h-6 w-6 text-violet-400" />
              <span className="text-sm font-semibold text-slate-100">Polity Citizen Passport</span>
              <span className="text-xs text-slate-400">
                Continuing constitutional personhood — for you, a human principal. Anonymous, self-custody privacy.
              </span>
            </button>
            <button
              onClick={() => handleClassChoice('participant')}
              className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-violet-500/60 hover:bg-slate-800"
            >
              <Bot className="h-6 w-6 text-violet-400" />
              <span className="text-sm font-semibold text-slate-100">Polity Agent Passport</span>
              <span className="text-xs text-slate-400">
                Constitutional presence for an agent you operate — sponsored from your Polity Citizen Passport. Delegated authority is granted separately.
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

          {/* Sponsorship/approval-dependency display — proactive, not
              reactive-on-click. See the sponsorEligibility effect above. */}
          {sponsorEligibility && (
            <div
              className={cls(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                sponsorEligibility.status === 'claimed'
                  ? 'border-emerald-700/50 bg-emerald-900/10 text-emerald-200'
                  : sponsorEligibility.status === 'loading'
                    ? 'border-slate-700/50 bg-slate-900/40 text-slate-400'
                    : 'border-amber-600/50 bg-amber-900/10 text-amber-200',
              )}
            >
              {sponsorEligibility.status === 'loading' ? (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : sponsorEligibility.status === 'claimed' ? (
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{sponsorEligibility.detail}</span>
            </div>
          )}

          {/* Agent Card source toggle (Sprint 3) */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => { setAgentCardSource('quick'); setGenesisCompleted(false); }}
              className={cls(
                'rounded px-3 py-1.5',
                agentCardSource === 'quick' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400',
              )}
            >
              Generate helper agent (fastest)
            </button>
            <button
              type="button"
              onClick={() => { setAgentCardSource('genesis'); setGenesisCompleted(false); }}
              className={cls(
                'rounded px-3 py-1.5',
                agentCardSource === 'genesis' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400',
              )}
            >
              Genesis a new agent
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

          {/* aigentMe designation — only for generated cards (quick/genesis). */}
          {(agentCardSource === 'quick' || agentCardSource === 'genesis') && (
            <label
              className={cls(
                'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs',
                existingAigentMe
                  ? 'border-slate-700/60 bg-slate-900/40 cursor-not-allowed'
                  : 'border-amber-500/40 bg-amber-500/5 cursor-pointer',
              )}
            >
              <input
                type="checkbox"
                checked={makeAigentMe && !existingAigentMe}
                disabled={!!existingAigentMe}
                onChange={(e) => setMakeAigentMe(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded accent-amber-500"
              />
              <span className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                {existingAigentMe ? (
                  <span className="text-slate-400">
                    You already have an aigentMe ({existingAigentMe.displayName}). Only one aigentMe is allowed per persona.
                  </span>
                ) : (
                  <span className="text-amber-200/90">
                    <strong className="text-amber-200">This is my aigentMe.</strong> The generated agent card and the
                    participant passport it earns will become your aigentMe — your primary personal delegate — mapped to
                    your persona, your citizen passport, and your wallet.
                  </span>
                )}
              </span>
            </label>
          )}

          {/* Option A (advanced, admin-only) — autonomous agent deployment.
              The agent binds to the current constitution and is agent-class
              only: NO kybe DID, never presents as a human/citizen, cannot hold a
              citizen passport (enforced server-side in sponsorPolityAgent). */}
          {isAdmin && (agentCardSource === 'quick' || agentCardSource === 'genesis') && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 px-3 py-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-purple-200">
                  <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                  Deploy as autonomous agent (Option A)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                  Admin only
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Advanced: deploy a fully autonomous agent that can occupy the agent seat and act
                directly under bounded delegation. <strong className="text-slate-300">Guardrails:</strong> no
                kybe DID, never presents as a human/citizen, always identifiable as an agent, cannot
                hold a citizen passport, and binds to the current Constitution / Agent Charter /
                Delegation Framework with an immediate-effect revocation authority.
              </p>
              <button
                type="button"
                onClick={handleDeployAutonomous}
                disabled={autonomousBusy || !!autonomousDeployed || sponsorEligibility?.status !== 'claimed'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-[11px] font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
              >
                {autonomousBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                {autonomousDeployed ? 'Autonomous agent deployed' : 'Deploy autonomous agent'}
              </button>
              {autonomousDeployed && (
                <code className="block text-[10px] text-purple-300 font-mono break-all">{autonomousDeployed}</code>
              )}
            </div>
          )}

          {agentCardSource === 'quick' ? (
            <div className="space-y-3 rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-3">
              <p className="text-[11px] text-emerald-300">
                One-click agent — we auto-generate a general helper agent bound to your Citizen Passport.
                Optionally name it or describe what it does; otherwise defaults apply.
              </p>
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Agent name (optional — defaults to 'Polity Helper')"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <input
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                placeholder="What does this agent do? (optional — defaults to 'General-purpose polity helper agent')"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={handleQuickAgent}
                disabled={genesisBusy || genesisCompleted || sponsorEligibility?.status !== 'claimed'}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {genesisBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {genesisCompleted ? 'Agent Card live' : 'Generate & bind agent'}
              </button>
              {genesisCompleted && (
                <code className="block text-[10px] text-emerald-300 font-mono break-all">{agentCardUrl}</code>
              )}
            </div>
          ) : (
            <>
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
                disabled={genesisBusy || genesisCompleted || sponsorEligibility?.status !== 'claimed'}
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
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={agentCardUrl}
                  onChange={(e) => setAgentCardUrl(e.target.value)}
                  placeholder="Agent card URL (A2A agent-card.json — the identity anchor)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => void handleFetchCardDetails()}
                  disabled={cardFetchBusy || !agentCardUrl.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  {cardFetchBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Fetch &amp; autofill
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Pastes the name, description, and declared skills from the card itself into the fields
                below — never re-typed by hand, never drifting from what the card actually says.
              </p>
              {cardFetchError && <p className="text-xs text-rose-400">{cardFetchError}</p>}
            </div>
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
            </>
          )}
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
            placeholder={
              mode === 'signup'
                ? 'Persona name (lowercase letters, numbers and hyphens)'
                : 'Persona name, username, or email'
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500">
            {mode === 'signup'
              ? 'Your persona name is the handle through which you enter and act within the platform. It is not the proof of your personhood.'
              : "Already have a metaMe/estate wallet? Sign in with its email and password — the same authentication your wallet already uses. No new account is created."}
          </p>
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
            Binding establishes your KybeDID — the privacy-preserving anchor proving that one
            continuing person exists behind this Passport. Existing personhood is reused rather than
            duplicated (one KybeDID per human).
          </p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name — optional"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500">Defaults to your persona name.</p>
          {bound && kybeRef && (
            <p className="font-mono text-xs text-slate-400">KybeDID commitment: {kybeRef}</p>
          )}
          <button
            onClick={handleBind}
            disabled={busy || !signedIn}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {bound ? 'Re-check personhood binding' : 'Bind personhood'}
          </button>
        </div>
      )}

      {step === 'vault' && (
        <div className="space-y-3">
          {/* VSP Standing Credential — anchored to this passport on compile */}
          <div className="rounded-xl border border-violet-700/40 bg-violet-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-200">Standing Credential</span>
            </div>
            {vspLoading ? (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking Standing Cartridge…
              </p>
            ) : vspSummary ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-300">
                  <span className="text-white font-medium">{vspSummary.label}</span>
                  {vspSummary.compiledAt
                    ? ` — compiled ${new Date(vspSummary.compiledAt).toLocaleDateString()}`
                    : ' — not yet compiled'}
                </p>
                {vspSummary.compiledAt && (
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{vspSummary.factCount} verified facts</span>
                    <span>{vspSummary.domains.length} domains</span>
                    {vspSummary.capabilityClaimCount > 0 && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" /> {vspSummary.capabilityClaimCount} capability claims
                      </span>
                    )}
                    {vspSummary.anchoredToPassport && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Anchored to Passport
                      </span>
                    )}
                  </div>
                )}
                {!vspSummary.anchoredToPassport && vspSummary.compiledAt && (
                  <p className="text-xs text-amber-400">
                    Compile a new VSP after applying for your passport to anchor it to your KybeDID.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No compiled Standing Profile found. Open the <strong className="text-slate-300">Standing Cartridge</strong> tab in the HMS cartridge to build your Verified Standing Profile — evidence-derived, principal-verified, portable across all Polity services.
              </p>
            )}
          </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
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
            Sponsor a Polity Agent Passport for <strong>{agentName || 'your agent'}</strong>.
            A steward reviews it in the Bureau queue; you can watch status below.
          </p>
          {!allChecked && (
            <p className="text-xs text-amber-300">
              You must accept the consents on{' '}
              <button
                type="button"
                onClick={() => setStep('consents')}
                className="underline hover:text-amber-200"
              >
                Step 3 (Consents)
              </button>{' '}
              before submitting.
            </p>
          )}
          <button
            onClick={handleSubmitParticipant}
            disabled={busy || !allChecked || !agentName.trim() || !agentCardUrl.trim()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Sponsor a Polity Agent Passport for this agent
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
            Submit your Polity Citizen Passport application
          </button>
        </div>
      )}

      {citizenJustSubmitted && !continuationDismissed && (
        <div className="space-y-3 rounded-xl border border-violet-700/50 bg-violet-950/20 p-4">
          <p className="text-sm text-slate-200">
            Do you also want to sponsor a Polity Agent Passport for an agent?
          </p>
          <p className="text-xs text-slate-400">
            Your Polity Citizen Passport application must still be approved before any linked Polity
            Agent Passport can be approved or activated — but you can prepare and submit both in
            one continuous journey.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleContinueWithAgent}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              Continue with my agent
            </button>
            <button
              onClick={() => setContinuationDismissed(true)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Not now
            </button>
          </div>
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
