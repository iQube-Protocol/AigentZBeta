/**
 * Use Case Zero demo fixture — Use Case Zero build-order item 11, Part 2.
 *
 * NON-LIVE DATA. Every value here — personaIds, receipt ids, the on-chain
 * request id — is a clearly-fake placeholder string, never a real database
 * row or real persona. This module exists ONLY to give the browser a
 * populated `ConstitutionalRiskFlowState` (+ its three redacted participant
 * views) to render for local QA, without needing Supabase, Vela, or any
 * live credential. See `app/(shell)/moneypenny/dev-fixtures/use-case-zero/`
 * for the gated viewer this feeds — that page 404s outside development, and
 * every render carries an unmistakable "DEMO / LOCAL FIXTURE" banner (see
 * that directory's own header for the full activation-safety rationale).
 *
 * WHY THIS REUSES `composeUseCaseZeroDemoChain` FOR select/authorize/freeze,
 * RATHER THAN HAND-TYPING A SECOND COPY (CLAUDE.md inv.engineering.036/037):
 * `scripts/seedUseCaseZeroDemo.ts`'s pure compose function already produces
 * the exact `FactorSelectionArtifact`/`VelaUnderwritingDisclosureAuthorization`/
 * `ComposeUnderwritingEnvelopeResult` this fixture needs for those three
 * steps — reusing it means this fixture can never silently drift from what
 * the real seed script would actually produce for the same three personas.
 *
 * WHY execute/quote/settle/receipt/telemetry ARE NOT REUSABLE FROM THAT
 * FUNCTION: those five steps only exist, in the real chain, AFTER a live
 * `runVelaUnderwritingProjection` call (a real network/chain act this
 * fixture must never perform). This module builds them by hand, but the
 * ONE substantive, potentially-driftable fact among them — the underwriting
 * quote's own nine fields for an ACCEPTABLE verdict — is NOT hand-typed
 * either: it is read from the REAL, exported, deterministic
 * `createUnderwritingProvider().quoteForVerdict('ACCEPTABLE')`
 * (`services/financialServices/providers/underwriting/simulatedUnderwritingProvider.ts`),
 * the same call `runVelaUnderwritingProjection` itself makes. Every other
 * execute/receipt/telemetry field is an explicit, clearly-fake fixture
 * placeholder (an on-chain request id, receipt ids, a telemetry record id)
 * — never claimed as a real receipt/chain fact.
 *
 * The three party bindings this fixture implies are NEVER actually recorded
 * anywhere — this module performs no I/O of any kind.
 */

import {
  composeUseCaseZeroDemoChain,
  type UseCaseZeroDemoComposedChain,
} from '@/scripts/seedUseCaseZeroDemo';
import type { AegisAdmissionEvidence } from '@/services/vela/velaUnderwritingAdmissionEvidence';
import { createUnderwritingProvider } from '@/services/financialServices/providers/underwriting/simulatedUnderwritingProvider';
import type { ConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';
import {
  redactConstitutionalRiskFlowStateForParty,
  type ConstitutionalRiskFlowParticipantView,
} from '@/services/vela/velaUnderwritingPartyView';

/** Clearly-fake demo personaIds — see this file's header. Never real. */
export const FIXTURE_ARKAGENT_PERSONA_ID = 'fixture-persona-arkagent';
export const FIXTURE_NAKAMOTO_PERSONA_ID = 'fixture-persona-nakamoto';
export const FIXTURE_KN0W1_PERSONA_ID = 'fixture-persona-kn0w1';

const FIXTURE_ASSESSMENT_REF = 'fixture-aegis-assessment-nakamoto-001';
const FIXTURE_ADMISSION_REF = 'fixture-aegis-admission-nakamoto-001';

/**
 * A fixture ADMITTED admission-evidence object — NOT produced by the real
 * `composeUnderwritingAdmissionEvidence` (that function requires a live
 * Supabase read; this fixture has none). Every field is a clearly-fake
 * placeholder; `admissionStatus: 'ADMITTED'` is the fixture's own
 * scripted premise ("Aegis has already ratified this candidate"), never a
 * claim that a real ratified assessment exists.
 */
function buildFixtureAdmissionEvidence(selectionRef: string, requestRef: string, candidateAgentId: string): AegisAdmissionEvidence {
  return {
    admissionRef: FIXTURE_ADMISSION_REF,
    selectionRef,
    requestRef,
    candidateAgentId,
    serviceId: null,
    assessmentRef: FIXTURE_ASSESSMENT_REF,
    assessmentVersion: 'fixture-v1',
    admissionStatus: 'ADMITTED',
    trustSummary: {
      decision: 'admissible',
      conditions: [],
      rationale: 'Fixture premise: Aegis has ratified this candidate as admissible.',
      criticalFailedFindingCount: 0,
    },
    evidenceRefs: [FIXTURE_ASSESSMENT_REF],
    effectiveAt: new Date(0).toISOString(),
    freshnessMs: 0,
    aegisAgentId: 'aigent-aegis',
    reason: 'Fixture: Aegis ratified this candidate as admissible.',
  };
}

export interface UseCaseZeroDemoFixture {
  composed: UseCaseZeroDemoComposedChain;
  state: ConstitutionalRiskFlowState;
  participantViews: {
    'party-a': ConstitutionalRiskFlowParticipantView;
    'party-b': ConstitutionalRiskFlowParticipantView;
    'party-c': ConstitutionalRiskFlowParticipantView;
  };
}

/**
 * Builds the full demo fixture: the composed chain (reused, not
 * re-derived), the operator/global `ConstitutionalRiskFlowState`, and the
 * three parties' redacted participant views (via the REAL,
 * unmodified `redactConstitutionalRiskFlowStateForParty` — never
 * hand-typed separately). `async` only because
 * `UnderwritingProvider.quoteForVerdict` is (its own implementation is a
 * synchronous, deterministic lookup — see that file's own header); no real
 * I/O happens anywhere in this function.
 */
export async function buildUseCaseZeroDemoFixture(): Promise<UseCaseZeroDemoFixture> {
  // Build the ADMITTED admission evidence against the SAME deterministic
  // Factor selection the compose function itself derives, so
  // selectionRef/requestRef/candidateAgentId agree (composeUnderwritingEnvelope's
  // own gate 1 would otherwise refuse a mismatched pairing).
  const { buildUseCaseZeroDemoFactorSelection } = await import('@/scripts/seedUseCaseZeroDemo');
  const factorSelection = buildUseCaseZeroDemoFactorSelection({
    arkAgentPersonaId: FIXTURE_ARKAGENT_PERSONA_ID,
    nakamotoPersonaId: FIXTURE_NAKAMOTO_PERSONA_ID,
    kn0w1PersonaId: FIXTURE_KN0W1_PERSONA_ID,
  });
  const admissionEvidence = buildFixtureAdmissionEvidence(
    factorSelection.selectionRef,
    factorSelection.requestRef,
    factorSelection.candidateAgentId,
  );

  const composed = composeUseCaseZeroDemoChain({
    arkAgentPersonaId: FIXTURE_ARKAGENT_PERSONA_ID,
    nakamotoPersonaId: FIXTURE_NAKAMOTO_PERSONA_ID,
    kn0w1PersonaId: FIXTURE_KN0W1_PERSONA_ID,
    admissionEvidence,
  });

  if (composed.envelopeResult.outcome !== 'FROZEN') {
    // Structurally unreachable given the fixture's own ADMITTED premise
    // above, but fail loudly rather than silently rendering a half-built
    // fixture if this ever changes.
    throw new Error(
      `useCaseZeroDemoFixture: expected the envelope to freeze, got BLOCKED (${composed.envelopeResult.blockedReason}).`,
    );
  }
  const envelope = composed.envelopeResult.envelope;

  const provider = createUnderwritingProvider();
  const quote = await provider.quoteForVerdict('ACCEPTABLE');

  const FIXTURE_ON_CHAIN_REQUEST_ID = 'fixture-on-chain-request-001';

  const state: ConstitutionalRiskFlowState = {
    requestRef: composed.requestRef,
    select: {
      id: 'select',
      state: 'complete',
      reason: `Factor proposed candidate ${composed.factorSelection.candidateAgentId} (${composed.factorSelection.providerMode}).`,
      selectionRef: composed.factorSelection.selectionRef,
      candidateAgentId: composed.factorSelection.candidateAgentId,
      serviceId: composed.factorSelection.serviceId,
      counterpartyId: composed.factorSelection.counterpartyId,
      providerMode: composed.factorSelection.providerMode,
      selectionReason: composed.factorSelection.selectionReason,
      receiptId: 'fixture-receipt-select-001',
    },
    admit: {
      id: 'admit',
      state: 'complete',
      reason: composed.admissionEvidence.reason,
      admissionRef: composed.admissionEvidence.admissionRef,
      admissionStatus: composed.admissionEvidence.admissionStatus,
      assessmentRef: composed.admissionEvidence.assessmentRef,
      assessmentVersion: composed.admissionEvidence.assessmentVersion,
      aegisAgentId: composed.admissionEvidence.aegisAgentId,
      receiptId: 'fixture-receipt-admit-001',
    },
    authorize: {
      id: 'authorize',
      state: 'complete',
      reason: `Disclosure authorized by ${composed.disclosureAuthorization.authorizedByAgentRef}.`,
      authorizationRef: composed.disclosureAuthorization.authorizationRef,
      applicationId: composed.disclosureAuthorization.applicationId,
      authorizedByAgentRef: composed.disclosureAuthorization.authorizedByAgentRef,
      scope: composed.disclosureAuthorization.scope,
      receiptId: 'fixture-receipt-authorize-001',
    },
    freeze: {
      id: 'freeze',
      state: 'complete',
      reason: `Envelope ${envelope.envelopeRef} was frozen and submitted to Vela.`,
      envelopeRef: envelope.envelopeRef,
      applicationId: envelope.applicationId,
      candidateAgentId: envelope.candidateAgentId,
      receiptId: 'fixture-receipt-freeze-001',
    },
    execute: {
      id: 'execute',
      state: 'complete',
      reason: `Vela resolved ACCEPTABLE (${quote.providerMode}).`,
      onChainRequestId: FIXTURE_ON_CHAIN_REQUEST_ID,
      disposition: 'ACCEPTABLE',
      providerMode: quote.providerMode,
      receiptId: 'fixture-receipt-freeze-001',
    },
    quote: {
      id: 'quote',
      state: 'complete',
      reason: `Underwriting quote computed (${quote.providerMode}): ACCEPTABLE.`,
      quote,
      receiptId: 'fixture-receipt-quote-001',
    },
    settle: {
      id: 'settle',
      state: 'not_started',
      reason: 'Vela ran as a no-funds path — no asset-bearing settlement was submitted with this request.',
      settlementOccurred: false,
    },
    receipt: {
      id: 'receipt',
      state: 'complete',
      reason: '5 causal receipt(s) found for this request.',
      receipts: [
        { receiptId: 'fixture-receipt-select-001', actionType: 'factor_selection_proposed', receiptStatus: 'local', createdAt: new Date(0).toISOString() },
        { receiptId: 'fixture-receipt-admit-001', actionType: 'vela_underwriting_admission_evidence_composed', receiptStatus: 'local', createdAt: new Date(0).toISOString() },
        { receiptId: 'fixture-receipt-authorize-001', actionType: 'vela_underwriting_disclosure_authorized', receiptStatus: 'local', createdAt: new Date(0).toISOString() },
        { receiptId: 'fixture-receipt-freeze-001', actionType: 'vela_underwriting_envelope_frozen', receiptStatus: 'local', createdAt: new Date(0).toISOString() },
        { receiptId: 'fixture-receipt-quote-001', actionType: 'vela_underwriting_projection_completed', receiptStatus: 'local', createdAt: new Date(0).toISOString() },
      ],
    },
    telemetry: {
      id: 'telemetry',
      state: 'complete',
      reason: 'Risk-invariant telemetry recorded in golden_cycle_records.',
      telemetryRecordId: 'fixture-telemetry-001',
    },
  };

  return {
    composed,
    state,
    participantViews: {
      'party-a': redactConstitutionalRiskFlowStateForParty(state, 'party-a'),
      'party-b': redactConstitutionalRiskFlowStateForParty(state, 'party-b'),
      'party-c': redactConstitutionalRiskFlowStateForParty(state, 'party-c'),
    },
  };
}
