/**
 * Use Case Zero build-order item 11 — the first REAL seeded end-to-end demo
 * transaction for the three-party scenario:
 *   party-a = ArkAgent      (portfolio principal / capital owner)
 *   party-b = Aigent Nakamoto (execution/strategy service)
 *   party-c = Aigent Kn0w1  (underwriting/risk-capacity provider)
 *
 * WHY PERSONA RESOLUTION IS INJECTED, NOT HARDCODED (operator's own explicit
 * instruction, 2026-09-14 — Supabase is down platform-wide as of this build):
 * every function below that needs a real ArkAgent/Nakamoto/Kn0w1 identity
 * accepts it as a parameter, fails closed (throws a clear, actionable error)
 * if any is missing/empty, and NEVER hardcodes, fabricates, or guesses a
 * personaId. Once Supabase returns, resolving the three ids (see
 * `resolveUseCaseZeroDemoPersonaIds` below) and running this script's CLI
 * entry point is the ONLY remaining step.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY `composeUnderwritingAdmissionEvidence` IS NOT CALLED INSIDE THE "PURE"
 * COMPOSE FUNCTION — a correction of this build item's own brief, made after
 * reading `services/vela/velaUnderwritingAdmissionEvidence.ts` in full
 * (CLAUDE.md No-Guessing: "verify real field names/signatures, never assume
 * from this brief's paraphrase"):
 *
 * The brief describes `composeUnderwritingAdmissionEvidence` as one of "the
 * REAL pure compose functions" in this chain. That is not what the file
 * itself says: `composeUnderwritingAdmissionEvidence(admin: SupabaseClient,
 * input)` is `async`, takes a live Supabase admin client as its FIRST
 * parameter, and performs a real, no-write-but-genuinely-networked read
 * (`getCurrentAssessment`/`listFindings` against `aegis_assessments`/
 * `aegis_findings`) before it can honestly resolve ADMITTED/REFUSED/
 * UNRESOLVED. It cannot be called with zero I/O, and it must NEVER be
 * short-circuited into fabricating an ADMITTED result for a candidate this
 * demo has not verified is actually, ratified-ly admissible — doing so would
 * be exactly the kind of guessed/fabricated constitutional fact CLAUDE.md's
 * No-Guessing rule forbids, on a chain whose whole point is that Aegis
 * admission is independently, evidentially decided.
 *
 * So `composeUseCaseZeroDemoChain` below is genuinely pure (no I/O at all)
 * by accepting the ALREADY-RESOLVED `AegisAdmissionEvidence` as an injected
 * parameter — the exact same "accept the dependency this worktree/session
 * cannot itself produce, fail closed if it is missing" discipline the brief
 * applies to the three personaIds, applied consistently to this fourth,
 * Aegis-shaped dependency. The one place this codebase's REAL
 * `composeUnderwritingAdmissionEvidence` is actually invoked is the CLI
 * entry point (`main()`, below) and `persistUseCaseZeroDemoChain`'s own
 * caller contract — both of which already require a live Supabase client
 * for their other effects, so this is not a new credential requirement, only
 * the correct placement of an existing one. `composeUnderwritingEnvelope`'s
 * OWN gate (imported, never reimplemented) is what decides FROZEN vs
 * BLOCKED from the injected evidence — this file never second-guesses that
 * gate or treats a non-ADMITTED evidence object as ADMITTED.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN DECISIONS THIS BRIEF LEFT TO MY JUDGMENT (surfaced again in the
 * final session report; flag/correct any of these you disagree with):
 *
 *  1. DEMO_APPLICATION_ID = 'demo-use-case-zero-application'. No canonical
 *     demo/test Vela applicationId convention exists anywhere in this
 *     codebase's non-test source (verified: `services/vela/velaFactorProvider.ts`
 *     is the only precedent, defaulting to the named string
 *     'factor-confidential-workloads' — never a UUID/opaque id). This value
 *     mirrors that same "a named, self-describing default string" choice,
 *     clearly prefixed `demo-` so it can never be mistaken for a real,
 *     deployed Vela `applicationId` (which is itself a per-deployment-
 *     transaction value anyway — see `velaConfig.ts`'s own header).
 *  2. `flowOwnerPersonaId` for ALL THREE party bindings is ArkAgent's own
 *     persona — ArkAgent is the principal/initiator of this three-party
 *     scenario (capital owner), so ArkAgent's own `activity_receipts` rows
 *     are the chain-of-record every party's binding resolves back to. This
 *     mirrors the existing single-flow-owner model
 *     `vela_underwriting_party_bindings` already assumes (one `requestRef`,
 *     one recording persona).
 *  3. Candidate slug for the "execution/strategy service" role is `'nakamoto'`
 *     (`services/horizen/registrableAgents.ts`'s `REGISTRABLE_AGENTS.nakamoto`,
 *     displayName "Aigent Nakamoto") — the closest real fit among the four
 *     REGISTRABLE_AGENTS entries (moneypenny/nakamoto/kn0w1/factor) for an
 *     "execution/strategy provider" role; no new REGISTRABLE_AGENTS entry is
 *     invented.
 *  4. `authorizedByAgentRef` on the disclosure authorization is
 *     `'aigent-moneypenny'` — MoneyPenny is this whole chain's own
 *     composition-gate role (`velaUnderwritingCompositionGate.ts`'s header),
 *     and every existing test in this repo that constructs a disclosure
 *     authorization (`tests/vela-underwriting-composition-gate.test.ts`)
 *     already uses this exact value for the same role.
 *  5. The fixture-activation mechanism (Part 2) is documented in
 *     `useCaseZeroDemoFixture.ts`'s own header, not here.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NO LIVE RUN WAS ATTEMPTED FROM THIS WORKTREE: Supabase is down
 * platform-wide (confirmed live during this session) and this isolated
 * worktree carries no Supabase credentials regardless. Every claim of
 * correctness here is proven by pure computation and mocked-dependency unit
 * tests (`tests/seed-use-case-zero-demo.test.ts`), never a live call.
 *
 * Server-side only (imports server-only modules throughout this chain).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  proposeFactorSelection,
  recordFactorSelection,
  type FactorSelectionArtifact,
} from '@/services/factor/factorSelectionArtifact';
import {
  composeUnderwritingAdmissionEvidence,
  recordUnderwritingAdmissionEvidence,
  type AegisAdmissionEvidence,
} from '@/services/vela/velaUnderwritingAdmissionEvidence';
import {
  authorizeUnderwritingDisclosure,
  recordUnderwritingDisclosureAuthorization,
  type VelaUnderwritingDisclosureAuthorization,
} from '@/services/vela/velaUnderwritingDisclosureAuthorization';
import {
  composeUnderwritingEnvelope,
  submitFrozenUnderwritingEnvelope,
  type ComposeUnderwritingEnvelopeResult,
} from '@/services/vela/velaUnderwritingCompositionGate';
import {
  recordUnderwritingPartyBinding,
  resolvePartyBindingForViewer,
  type RecordUnderwritingPartyBindingInput,
} from '@/services/vela/velaUnderwritingPartyBinding';
import { deriveVelaPartyNamespaceRef } from '@/services/vela/velaPartyNamespace';
import {
  VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
  VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
  type VelaMultiPartyDisclosureScope,
  type VelaMultiPartyPartyInput,
} from '@/services/vela/velaMultiPartyProjection';
import { getConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';
import type { VelaTransport } from '@/services/vela/velaTypes';

// ── Fixed demo identifiers ──────────────────────────────────────────────────

/** Fixed, clearly-named demo request — never a fresh/random value, so
 *  re-running this script against the SAME demo scenario is idempotent. */
export const USE_CASE_ZERO_DEMO_REQUEST_REF = 'demo-use-case-zero-arkagent-nakamoto-kn0w1-001';

/** See this file's header, design decision 1. */
export const USE_CASE_ZERO_DEMO_APPLICATION_ID = 'demo-use-case-zero-application';

/** Opaque service identifier Factor proposes this candidate FOR — never
 *  resolved from the underwriting provider (see factorSelectionArtifact.ts's
 *  own import-boundary invariant 2). A plain, self-describing demo string. */
export const USE_CASE_ZERO_DEMO_SERVICE_ID = 'use-case-zero-underwriting-demo';

export const USE_CASE_ZERO_PARTY_A = 'party-a'; // ArkAgent
export const USE_CASE_ZERO_PARTY_B = 'party-b'; // Aigent Nakamoto
export const USE_CASE_ZERO_PARTY_C = 'party-c'; // Aigent Kn0w1

/** See this file's header, design decision 4. */
export const DEMO_AUTHORIZING_AGENT_REF = 'aigent-moneypenny';
/** Candidate slug for the execution/strategy role — design decision 3. */
const DEMO_CANDIDATE_AGENT_SLUG = 'nakamoto';
const DEMO_FACTOR_AGENT_ID = 'aigent-factor';
const DEFAULT_ACTIVE_CARTRIDGE = 'moneypenny';

/** Deterministic, verified-ACCEPTABLE demo party inputs (per
 *  `services/vela/wasm/projector/app/app.go`'s own `evaluateCombinedInputs`
 *  rule: for every party, `totalSpend <= party's own spendLimit` AND
 *  `totalExposure + totalSpend <= party's own riskLimit`). Two contributing
 *  parties (party-a, party-b) each contribute 400 proposed spend against a
 *  1000 spend/risk limit: totalSpend=800<=1000 for both, combined=800<=1000
 *  for both -> ACCEPTABLE. Verified against the real Go rule, not guessed. */
const DEMO_PARTY_INPUTS = { currentExposure: 0, proposedSpend: 400, privateSpendLimit: 1000, privateRiskLimit: 1000 };

const HEX_ADDRESS_PREFIX = '0x';
function demoRecipientAddress(index: number): string {
  return HEX_ADDRESS_PREFIX + index.toString(16).padStart(40, '0');
}

// ── Fail-closed persona injection ───────────────────────────────────────────

export interface UseCaseZeroDemoPersonas {
  arkAgentPersonaId: string;
  nakamotoPersonaId: string;
  kn0w1PersonaId: string;
}

/** Throws a clear, actionable error if any persona is missing, empty, or
 *  not a plausible non-empty string — never proceeds with a placeholder,
 *  never fabricates a fallback. */
export function assertUseCaseZeroDemoPersonas(personas: Partial<UseCaseZeroDemoPersonas>): asserts personas is UseCaseZeroDemoPersonas {
  const required: Array<[keyof UseCaseZeroDemoPersonas, string]> = [
    ['arkAgentPersonaId', 'ArkAgent'],
    ['nakamotoPersonaId', 'Aigent Nakamoto'],
    ['kn0w1PersonaId', 'Aigent Kn0w1'],
  ];
  for (const [field, label] of required) {
    const value = personas[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `seedUseCaseZeroDemo: ${label}'s personaId (${field}) is missing or empty — refusing to proceed. ` +
          'Resolve it via resolveUseCaseZeroDemoPersonaIds() (or another real lookup) and pass it explicitly; ' +
          'never a hardcoded or guessed value.',
      );
    }
  }
}

// ── Pure artifact construction ──────────────────────────────────────────────

/**
 * Builds Factor's deterministic candidate-selection artifact for the demo
 * scenario. Pure (delegates to the real, unmodified `proposeFactorSelection`).
 * Exported so a caller needing to look up an existing Aegis assessment for
 * THIS candidate (`composeUnderwritingAdmissionEvidence`'s own required
 * input) can construct the identical artifact independently of
 * `composeUseCaseZeroDemoChain` — see this file's header.
 */
export function buildUseCaseZeroDemoFactorSelection(personas: UseCaseZeroDemoPersonas): FactorSelectionArtifact {
  assertUseCaseZeroDemoPersonas(personas);
  return proposeFactorSelection({
    requestRef: USE_CASE_ZERO_DEMO_REQUEST_REF,
    applicationId: USE_CASE_ZERO_DEMO_APPLICATION_ID,
    candidateAgentSlug: DEMO_CANDIDATE_AGENT_SLUG,
    serviceId: USE_CASE_ZERO_DEMO_SERVICE_ID,
    selectionReason:
      'Use Case Zero demo: ArkAgent (capital owner) selects Aigent Nakamoto as the execution/strategy ' +
      'candidate for a jointly-computed underwriting request, with Aigent Kn0w1 supplying risk-capacity ' +
      'evidence via disclosure of the joint result.',
    evidenceRefs: [],
    factorAgentId: DEMO_FACTOR_AGENT_ID,
  });
}

/** The exact asymmetric disclosure scope the brief specifies. Exported so the
 *  local fixture (Part 2) can reuse it verbatim rather than hand-typing a
 *  second copy that could drift. */
export function buildUseCaseZeroDemoDisclosureScope(): VelaMultiPartyDisclosureScope {
  return {
    binding: {
      applicationId: USE_CASE_ZERO_DEMO_APPLICATION_ID,
      requestRef: USE_CASE_ZERO_DEMO_REQUEST_REF,
      operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
      outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
    },
    grants: [
      { action: 'COMPUTE_WITH', party: USE_CASE_ZERO_PARTY_A },
      { action: 'COMPUTE_WITH', party: USE_CASE_ZERO_PARTY_B },
      { action: 'DISCLOSE_TO', party: USE_CASE_ZERO_PARTY_B, to: USE_CASE_ZERO_PARTY_A },
      { action: 'DISCLOSE_TO', party: USE_CASE_ZERO_PARTY_A, to: USE_CASE_ZERO_PARTY_C },
    ],
  };
}

export interface ComposeUseCaseZeroDemoChainParams extends UseCaseZeroDemoPersonas {
  /**
   * The REAL Aegis admission evidence for THIS candidate/request, already
   * resolved by calling the real, unmodified `composeUnderwritingAdmissionEvidence`
   * against a live Supabase client (see this file's header — that call
   * cannot happen inside this pure function). Required; never fabricated
   * as ADMITTED by this function.
   */
  admissionEvidence: AegisAdmissionEvidence;
}

export interface UseCaseZeroDemoComposedChain {
  requestRef: string;
  applicationId: string;
  factorSelection: FactorSelectionArtifact;
  admissionEvidence: AegisAdmissionEvidence;
  disclosureAuthorization: VelaUnderwritingDisclosureAuthorization;
  /** Three party-binding INPUTS — not yet recorded; `persistUseCaseZeroDemoChain` records them. */
  partyBindingInputs: RecordUnderwritingPartyBindingInput[];
  /** FROZEN or BLOCKED — decided entirely by the real, unmodified
   *  `composeUnderwritingEnvelope` gate, never second-guessed here. */
  envelopeResult: ComposeUnderwritingEnvelopeResult;
  /** party-a + party-b ONLY (see this file's header on Kn0w1/party-c's role) —
   *  the real party inputs `submitFrozenUnderwritingEnvelope` needs when the
   *  envelope is FROZEN. */
  velaParties: VelaMultiPartyPartyInput[];
}

/**
 * Composes the ENTIRE Use Case Zero demo chain deterministically from the
 * three injected personas + the already-resolved Aegis admission evidence.
 * PURE: no I/O, no DB, no receipt, no network call — every artifact is a
 * plain, computed object. Fails closed (throws) if any persona or the
 * admission evidence is missing.
 */
export function composeUseCaseZeroDemoChain(
  params: ComposeUseCaseZeroDemoChainParams,
): UseCaseZeroDemoComposedChain {
  assertUseCaseZeroDemoPersonas(params);
  if (!params.admissionEvidence) {
    throw new Error(
      'composeUseCaseZeroDemoChain: admissionEvidence is required — resolve it via ' +
        'composeUnderwritingAdmissionEvidence(admin, { factorSelection }) against a live Supabase client ' +
        'before composing the demo chain. Never fabricated as ADMITTED here.',
    );
  }

  const factorSelection = buildUseCaseZeroDemoFactorSelection(params);

  const disclosureAuthorization = authorizeUnderwritingDisclosure({
    selectionRef: factorSelection.selectionRef,
    requestRef: USE_CASE_ZERO_DEMO_REQUEST_REF,
    applicationId: USE_CASE_ZERO_DEMO_APPLICATION_ID,
    scope: buildUseCaseZeroDemoDisclosureScope(),
    authorizedByAgentRef: DEMO_AUTHORIZING_AGENT_REF,
    evidenceRefs: [],
  });

  const partyPersonaByLabel: Record<string, string> = {
    [USE_CASE_ZERO_PARTY_A]: params.arkAgentPersonaId,
    [USE_CASE_ZERO_PARTY_B]: params.nakamotoPersonaId,
    [USE_CASE_ZERO_PARTY_C]: params.kn0w1PersonaId,
  };

  const partyBindingInputs: RecordUnderwritingPartyBindingInput[] = Object.entries(partyPersonaByLabel).map(
    ([partyLabel, personaId]) => ({
      requestRef: USE_CASE_ZERO_DEMO_REQUEST_REF,
      applicationId: USE_CASE_ZERO_DEMO_APPLICATION_ID,
      partyLabel,
      partyNamespaceRef: deriveVelaPartyNamespaceRef(USE_CASE_ZERO_DEMO_APPLICATION_ID, {
        authorityPrincipal: personaId,
        confidentialPrivacyIdentity: personaId,
      }),
      authorityPrincipalId: personaId,
      authorityPersonaId: personaId,
      // Design decision 2 — ArkAgent is the flow-recording persona for every
      // party binding in this demo (see this file's header).
      flowOwnerPersonaId: params.arkAgentPersonaId,
      bindingEvidenceRef: disclosureAuthorization.authorizationRef,
    }),
  );

  const envelopeResult = composeUnderwritingEnvelope({
    factorSelection,
    admissionEvidence: params.admissionEvidence,
    disclosureAuthorization,
  });

  const velaParties: VelaMultiPartyPartyInput[] = [
    {
      identities: { authorityPrincipal: params.arkAgentPersonaId, confidentialPrivacyIdentity: params.arkAgentPersonaId },
      recipientAddress: demoRecipientAddress(1),
      inputs: DEMO_PARTY_INPUTS,
    },
    {
      identities: { authorityPrincipal: params.nakamotoPersonaId, confidentialPrivacyIdentity: params.nakamotoPersonaId },
      recipientAddress: demoRecipientAddress(2),
      inputs: DEMO_PARTY_INPUTS,
    },
  ];

  return {
    requestRef: USE_CASE_ZERO_DEMO_REQUEST_REF,
    applicationId: USE_CASE_ZERO_DEMO_APPLICATION_ID,
    factorSelection,
    admissionEvidence: params.admissionEvidence,
    disclosureAuthorization,
    partyBindingInputs,
    envelopeResult,
    velaParties,
  };
}

// ── Effectful persistence (idempotent) ──────────────────────────────────────

export interface PersistUseCaseZeroDemoChainParams {
  /** The persona whose OWN `activity_receipts` rows record this demo chain —
   *  ArkAgent's persona, per design decision 2. */
  actorPersonaId: string;
  requestedByAgentRef?: string;
  /** Required ONLY when the envelope is FROZEN (i.e. admission was ADMITTED)
   *  — `submitFrozenUnderwritingEnvelope` needs a real `VelaTransport` to
   *  submit to. Omit when the envelope is BLOCKED (nothing is submitted). */
  transport?: VelaTransport;
  maxPollAttempts?: number;
  activeCartridge?: string;
}

export interface PersistUseCaseZeroDemoChainResult {
  created: string[];
  skippedExisting: string[];
  blocked?: string;
  velaResult?: { onChainRequestId: string; disposition: string; providerMode: string };
}

/**
 * Persists the composed demo chain, idempotently: before writing each
 * artifact, checks whether evidence already exists for
 * `USE_CASE_ZERO_DEMO_REQUEST_REF` (via the EXISTING read-only
 * `getConstitutionalRiskFlowState` — the same `matchFor`-by-requestRef
 * idiom `velaUnderwritingChainProjection.ts` already implements, reused
 * rather than hand-rolled a second time) and SKIPS re-inserting anything
 * already found. Never re-submits to Vela a second time for the same
 * requestRef.
 *
 * Needs live Supabase credentials to actually run (transitively, via
 * `createActivityReceipt`/`getSupabaseServer()`) — proven only via mocked
 * unit tests in this worktree, never a live call.
 */
export async function persistUseCaseZeroDemoChain(
  composed: UseCaseZeroDemoComposedChain,
  params: PersistUseCaseZeroDemoChainParams,
): Promise<PersistUseCaseZeroDemoChainResult> {
  const requestedByAgentRef = params.requestedByAgentRef ?? DEMO_AUTHORIZING_AGENT_REF;
  const activeCartridge = params.activeCartridge ?? DEFAULT_ACTIVE_CARTRIDGE;
  const created: string[] = [];
  const skippedExisting: string[] = [];

  const existing = await getConstitutionalRiskFlowState({
    personaId: params.actorPersonaId,
    requestRef: composed.requestRef,
  });

  if (existing.select.state === 'complete') {
    skippedExisting.push('factor_selection_proposed');
  } else {
    await recordFactorSelection(composed.factorSelection, {
      actorPersonaId: params.actorPersonaId,
      requestedByAgentRef: composed.factorSelection.factorAgentId,
      activeCartridge,
    });
    created.push('factor_selection_proposed');
  }

  if (existing.admit.state !== 'not_started') {
    skippedExisting.push('vela_underwriting_admission_evidence_composed');
  } else {
    await recordUnderwritingAdmissionEvidence(composed.admissionEvidence, {
      actorPersonaId: params.actorPersonaId,
      requestedByAgentRef: composed.admissionEvidence.aegisAgentId,
      activeCartridge,
    });
    created.push('vela_underwriting_admission_evidence_composed');
  }

  if (existing.authorize.state === 'complete') {
    skippedExisting.push('vela_underwriting_disclosure_authorized');
  } else {
    await recordUnderwritingDisclosureAuthorization(composed.disclosureAuthorization, {
      actorPersonaId: params.actorPersonaId,
      requestedByAgentRef: composed.disclosureAuthorization.authorizedByAgentRef,
      activeCartridge,
    });
    created.push('vela_underwriting_disclosure_authorized');
  }

  for (const binding of composed.partyBindingInputs) {
    // Anti-enumeration lookup already exists for exactly this question
    // ("is THIS persona already bound to this (requestRef, partyLabel)?") —
    // reused rather than a hand-rolled existence query.
    const alreadyBound = await resolvePartyBindingForViewer({
      requestRef: binding.requestRef,
      partyLabel: binding.partyLabel,
      viewerPersonaId: binding.authorityPersonaId,
    });
    if (alreadyBound.authorized) {
      skippedExisting.push(`party_binding:${binding.partyLabel}`);
    } else {
      await recordUnderwritingPartyBinding(binding);
      created.push(`party_binding:${binding.partyLabel}`);
    }
  }

  if (composed.envelopeResult.outcome === 'BLOCKED') {
    return { created, skippedExisting, blocked: composed.envelopeResult.blockedReason };
  }

  if (existing.freeze.state !== 'not_started') {
    skippedExisting.push('vela_underwriting_envelope_frozen');
    return { created, skippedExisting };
  }

  if (!params.transport) {
    throw new Error(
      'persistUseCaseZeroDemoChain: the envelope is FROZEN and ready to submit, but no VelaTransport was ' +
        'provided — pass one (e.g. a VelaClientAdapter against a real deployment) to actually submit to Vela.',
    );
  }

  const result = await submitFrozenUnderwritingEnvelope({
    envelope: composed.envelopeResult.envelope,
    parties: composed.velaParties,
    transport: params.transport,
    actorPersonaId: params.actorPersonaId,
    requestedByAgentRef,
    maxPollAttempts: params.maxPollAttempts,
    activeCartridge,
  });
  created.push('vela_underwriting_envelope_frozen');

  return {
    created,
    skippedExisting,
    velaResult: {
      onChainRequestId: result.velaResult.onChainRequestId,
      disposition: result.velaResult.disposition,
      providerMode: result.velaResult.quote.providerMode,
    },
  };
}

// ── Persona resolution (query-only; separate from compose/persist) ─────────

/**
 * Resolves ArkAgent/Nakamoto/Kn0w1's real personaIds via the platform's OWN
 * existing resolution shape — never a new resolver invented for this item.
 *
 * Nakamoto/Kn0w1 resolve by `fio_handle` (`REGISTRABLE_AGENTS.nakamoto
 * .fioHandle` / `.kn0w1.fioHandle` — 'nakamoto@aigent' / 'kn0w1@aigent'),
 * using the SAME `personas` query shape `services/identity/
 * resolveIframePersona.ts`'s `lookupPersonaFromUrl` already uses for its own
 * fio_handle branch (`.eq('fio_handle', raw).eq('status', 'active')`) — no
 * standalone exported "resolve by fio_handle" function exists anywhere in
 * this codebase to import instead (verified), so this mirrors that exact
 * query shape rather than inventing a new one.
 *
 * ArkAgent resolves by `display_name = 'ArkAgent'`, mirroring
 * `supabase/migrations/20260804000200_mark_arkagent_aigentme_active.sql`'s
 * own resolution. That migration ALSO matches `personas.slug = 'arkagent'`
 * — a repo-wide grep of every `supabase/migrations/*.sql` file found no
 * `CREATE TABLE personas` or `ALTER TABLE personas ADD COLUMN slug`
 * anywhere, so a `slug` column appears not to exist on `personas` today.
 * This is a STATIC-ANALYSIS finding only (no live schema query was possible
 * in this worktree) — stated here explicitly as unverified, per the
 * brief's own instruction, rather than guessed. This function therefore
 * matches on `display_name` ONLY; if `slug` genuinely exists once Supabase
 * is reachable again, extend the `.or(...)` filter accordingly.
 *
 * Fails closed: any agent not found (or Supabase unreachable) resolves that
 * field as `null` — never a guessed id — so the caller can report exactly
 * which persona(s) still need resolving.
 */
export interface ResolvedUseCaseZeroDemoPersonaIds {
  arkAgentPersonaId: string | null;
  nakamotoPersonaId: string | null;
  kn0w1PersonaId: string | null;
}

export async function resolveUseCaseZeroDemoPersonaIds(): Promise<ResolvedUseCaseZeroDemoPersonaIds> {
  const admin = getSupabaseServer();
  if (!admin) {
    return { arkAgentPersonaId: null, nakamotoPersonaId: null, kn0w1PersonaId: null };
  }

  async function byFioHandle(fioHandle: string): Promise<string | null> {
    const { data, error } = await admin!
      .from('personas')
      .select('id')
      .eq('fio_handle', fioHandle)
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data) return null;
    return String((data as { id: unknown }).id);
  }

  async function byDisplayName(displayName: string): Promise<string | null> {
    const { data, error } = await admin!
      .from('personas')
      .select('id')
      .eq('display_name', displayName)
      .maybeSingle();
    if (error || !data) return null;
    return String((data as { id: unknown }).id);
  }

  const [arkAgentPersonaId, nakamotoPersonaId, kn0w1PersonaId] = await Promise.all([
    byDisplayName('ArkAgent'),
    byFioHandle('nakamoto@aigent'),
    byFioHandle('kn0w1@aigent'),
  ]);

  return { arkAgentPersonaId, nakamotoPersonaId, kn0w1PersonaId };
}

// ── CLI entry point ──────────────────────────────────────────────────────

function cliArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

/**
 * `tsx scripts/seedUseCaseZeroDemo.ts --arkagent=<id> --nakamoto=<id> --kn0w1=<id> [--app=<applicationId>] [--evm-key=<hex>] [--vela-env=local|early_access]`
 *
 * The brief's own illustrative CLI signature named only the three persona
 * flags. `--vela-env` (and the optional `--evm-key` override, see
 * `resolveDemoVelaTransport` below) were added because
 * `submitFrozenUnderwritingEnvelope`'s real signature requires a
 * `VelaTransport`, and this codebase has no default production Vela
 * deployment to construct one from silently (`services/vela/velaConfig.ts`'s
 * own header: no production/testnet deployment is configured anywhere). When
 * the envelope resolves BLOCKED (Aegis has not yet ratified the candidate
 * admissible), no transport is resolved at all and these flags are unused.
 *
 * NO `--p521-key` ARGUMENT — REMOVED (2026-09-15, operator ruling: "keys are
 * substrate primitives, not UX concepts"): a P-521 key is never accepted
 * directly from the command line anymore. It is always derived internally,
 * deterministically, from whichever EVM signer resolves (see
 * `resolveDemoVelaTransport`), via the real, existing
 * `deriveAgentP521KeyPair` (`services/vela/agentP521Derivation.ts`) — the
 * same derivation already proven in `scripts/vela/public-devnet-smoke.ts`.
 * This removes one secret CLI argument unconditionally, in both the default
 * (MoneyPenny custody) and the `--evm-key` override path — never a second,
 * independently-suppliable P-521 secret store.
 */

/**
 * Resolves the single EVM requester signer this demo submits to Vela under,
 * and derives its P-521 communication key internally — never accepting a
 * raw P-521 key as an argument (`services/vela/agentP521Derivation.ts`'s own
 * doctrine: do not create a second long-lived P-521 secret store).
 *
 * Default: MoneyPenny's OWN existing custodied wallet — the `agent_keys` row
 * for `DEMO_AUTHORIZING_AGENT_REF` ('aigent-moneypenny'), the SAME wallet she
 * already signs Register/Verify/Claim/Pulse with
 * (`services/horizen/registrableAgents.ts`'s own custody doctrine: "the
 * registered agent's own custodied wallet IS runtimeAgentId's agent_keys
 * row"). MoneyPenny is already this chain's own requester/composition-gate
 * identity (`DEMO_AUTHORIZING_AGENT_REF`, above) — never any of the three
 * UC0 participant personas' own keys.
 *
 * `--evm-key` remains as an OPTIONAL override — useful for pointing this
 * script at a throwaway devnet test wallet instead of MoneyPenny's real
 * custody (the same override shape `scripts/vela/public-devnet-smoke.ts` and
 * `scripts/vela-slice2e-live-composition.ts` already use for their own,
 * separate purposes) — never a raw P-521 key either way.
 *
 * The resolved EVM private key and the derived P-521 private key exist ONLY
 * inside this function's own local `evmPrivateKeyHex`/`wallet`/
 * `p521PrivateKeyHex` variables — never logged, never returned, never placed
 * on any object this script prints (operator instruction, 2026-09-15: "Do
 * not log, print, persist, or expose the derived private key").
 */
export async function resolveDemoVelaTransport(): Promise<VelaTransport | undefined> {
  const [{ VelaClientAdapter }, { resolveVelaDeployment }, { deriveAgentP521KeyPair }, { Wallet }] = await Promise.all([
    import('@/services/vela/velaClientAdapter'),
    import('@/services/vela/velaConfig'),
    import('@/services/vela/agentP521Derivation'),
    import('ethers'),
  ]);

  const evmKeyOverride = cliArg('evm-key');
  let evmPrivateKeyHex: string | undefined = evmKeyOverride;
  if (!evmPrivateKeyHex) {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const keys = await new AgentKeyService().getAgentKeys(DEMO_AUTHORIZING_AGENT_REF);
    evmPrivateKeyHex = keys?.evmPrivateKey ?? undefined;
  }
  if (!evmPrivateKeyHex) {
    console.error(
      'seedUseCaseZeroDemo: the envelope resolved FROZEN but no EVM requester signer could be resolved — ' +
        `no custodied key on record for "${DEMO_AUTHORIZING_AGENT_REF}" and no --evm-key override was supplied. ` +
        'Nothing was persisted.',
    );
    return undefined;
  }

  const wallet = new Wallet(evmPrivateKeyHex);
  const { privateKeyHex: p521PrivateKeyHex } = await deriveAgentP521KeyPair(wallet);

  const velaEnv = (cliArg('vela-env') as 'local' | 'early_access' | undefined) ?? 'local';
  return new VelaClientAdapter({
    deployment: resolveVelaDeployment(velaEnv),
    requesterPrivateKeyHex: wallet.privateKey,
    requesterP521PrivateKeyHex: p521PrivateKeyHex,
  });
}

async function main(): Promise<void> {
  const personas: Partial<UseCaseZeroDemoPersonas> = {
    arkAgentPersonaId: cliArg('arkagent'),
    nakamotoPersonaId: cliArg('nakamoto'),
    kn0w1PersonaId: cliArg('kn0w1'),
  };
  try {
    assertUseCaseZeroDemoPersonas(personas);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  const admin = getSupabaseServer();
  if (!admin) {
    console.error(
      'seedUseCaseZeroDemo: Supabase is not reachable from this environment — cannot resolve Aegis ' +
        'admission evidence or persist anything. Nothing was attempted.',
    );
    process.exitCode = 1;
    return;
  }

  const factorSelection = buildUseCaseZeroDemoFactorSelection(personas as UseCaseZeroDemoPersonas);
  const admissionEvidence = await composeUnderwritingAdmissionEvidence(admin, { factorSelection });

  const composed = composeUseCaseZeroDemoChain({ ...(personas as UseCaseZeroDemoPersonas), admissionEvidence });

  let transport: VelaTransport | undefined;
  if (composed.envelopeResult.outcome === 'FROZEN') {
    transport = await resolveDemoVelaTransport();
    if (!transport) {
      process.exitCode = 1;
      return;
    }
  }

  const result = await persistUseCaseZeroDemoChain(composed, {
    actorPersonaId: personas.arkAgentPersonaId!,
    transport,
  });

  console.log(`Use Case Zero demo seed (requestRef=${composed.requestRef}):`);
  console.log(`  created:          ${result.created.join(', ') || '(none)'}`);
  console.log(`  skipped existing: ${result.skippedExisting.join(', ') || '(none)'}`);
  if (result.blocked) console.log(`  BLOCKED: ${result.blocked}`);
  if (result.velaResult) {
    console.log(
      `  Vela result: onChainRequestId=${result.velaResult.onChainRequestId} disposition=${result.velaResult.disposition} providerMode=${result.velaResult.providerMode}`,
    );
  }
}

// Only run when invoked directly (`tsx scripts/seedUseCaseZeroDemo.ts ...`),
// never as a side effect of another module importing this file's exports.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
