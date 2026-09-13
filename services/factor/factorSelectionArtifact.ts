/**
 * Factor selection artifact — Use Case Zero build-order item 7, the direct
 * sequel to item 6 (`services/vela/velaUnderwritingRiskTelemetry.ts`, merged
 * 2026-09-13).
 *
 * CRITICAL DISAMBIGUATION (read before touching anything named "Factor" or
 * "Use Case Zero"): `services/factor/useCaseZeroOrchestrator.ts` is a
 * COMPLETELY DIFFERENT, pre-existing "Use Case Zero" — an agent-onboarding/
 * readiness bootstrap state machine (agentShell -> didqubeContainer ->
 * ownerWallet -> settlementWallet -> passport -> delegationAuthority ->
 * pulsePnl -> aegisAssessment -> moneypennyAdmission -> bankrBinding ->
 * velaReadiness -> runtimeActivation -> governedOperationRehearsal), keyed on
 * long-lived `factor_cases` rows with their own state machine. It shares
 * vocabulary (Factor, Aegis, MoneyPenny, Vela, "Use Case Zero") with THIS
 * item's own domain but is NOT the same artifact — the naming-collision
 * rule CLAUDE.md's Adversarial Research Review section states for research
 * publication, applied here to engineering code. This module does NOT
 * modify, import from, or reuse the `factor_cases` state machine, and its
 * `requestRef`/`selectionRef` model is request-scoped, never case-scoped.
 * THIS item's "Use Case Zero" is the multi-party confidential underwriting
 * demo (`docs/vela/accelerator/constitutional-financial-services/
 * 05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`): Party A/B private state ->
 * joint-compute scope -> confidential risk verdict -> underwriting quote
 * (`services/vela/velaUnderwritingProjection.ts`, item 5) -> risk telemetry
 * (item 6) -> Factor candidate selection (this item, 7).
 *
 * OPERATOR'S OWN RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "At this
 * point the constitutional loop is already coherent through telemetry, so
 * Factor should be added very narrowly as the economic coordination /
 * selection layer, not as another decision engine. The clean contract is:
 * Factor discovers and proposes -> candidate agent/service/counterparty/
 * coverage provider -> includes economic terms/availability/relevant
 * identifiers -> MoneyPenny evaluates whether that candidate can participate
 * -> Aegis supplies the independent admission/trust evidence -> only then
 * does the multi-party Vela path proceed. For this pass, I'd keep Factor's
 * scope to three things: candidate discovery, service/counterparty
 * selection, and construction of a deterministic selection artifact that
 * MoneyPenny can bind into the request/receipt chain."
 *
 * THE SIX INVARIANTS, verbatim, and how EACH is enforced (or explicitly
 * deferred) by this file:
 *
 *  1. "Factor may recommend, but must not confer constitutional authority."
 *     Enforced by IMPORT BOUNDARY: this file imports nothing from
 *     `services/factor/authorityChain.ts`, `services/delegation/*`,
 *     `services/access/evaluateAccess.ts`, `services/identity/
 *     getActivePersona.ts`, or any authority/delegation-chain code. Proven
 *     structurally by `tests/factor-selection-artifact.test.ts`'s
 *     import-boundary suite (reads this file's own source text via the
 *     `importAuthority`/`forbiddenImportFindings` helpers in
 *     `tests/_lib/sourceAuthority.ts` — the same technique
 *     `tests/persona-spine-fetch.test.ts` uses for its own forbidden-
 *     transport canary).
 *
 *  2. "Factor may select candidates, but must not bypass Aegis admission."
 *     Enforced by IMPORT BOUNDARY: this file imports nothing from
 *     `services/aegis/*` and never calls Aegis. Aegis integration is
 *     explicitly the NEXT item, not this one (operator: "Once Factor is in,
 *     Aegis should be the next and last backend layer before UI").
 *
 *  3. "Factor's economic terms must be treated as inputs/evidence, not
 *     trusted truth unless independently verified." Enforced by
 *     COMMITMENT, NEVER VERBATIM STORAGE: any raw `rawQuotedTerms` object a
 *     caller supplies is NEVER stored or forwarded verbatim in the artifact
 *     — only a one-way sha256 commitment (`quotedTermsRef`, full 64-char hex
 *     digest) over it, the same commitment-reference recipe already used
 *     repeatedly in this codebase (the HMS locker-ref recipe in CLAUDE.md's
 *     own worked example; `personaPublicRef()` in
 *     `services/identity/personaReferences.ts`;
 *     `deriveVelaPartyNamespaceRef` in `services/vela/velaPartyNamespace.ts`;
 *     `commitMultiPartyPayload` in `services/vela/velaUnderwritingProjection.ts`
 *     — whose own choice of a FULL, untruncated digest for exactly this
 *     reason (collision-resistance across many candidates matters more than
 *     brevity here) this field mirrors).
 *
 *  4. "Any party/provider selected by Factor must be bound into the
 *     transaction context before the consequence/risk envelope is frozen."
 *     NOT enforced by this item's code — this is a future ordering
 *     constraint for the NEXT item, which will bind a selection artifact's
 *     `requestRef`/`selectionRef` into the multi-party wiring's own
 *     request-construction step (`buildVelaMultiPartyProjectionRequest`,
 *     `services/vela/velaMultiPartyProjection.ts`) before submission. This
 *     module produces the artifact + its receipt only, structurally
 *     isolated, ready for a later item to consume by reading
 *     `selectionRef`/`requestRef` off it — see "OUT OF SCOPE" below.
 *
 *  5. "Factor must not gain access to confidential operands merely because
 *     it assembled the transaction." Enforced STRUCTURALLY:
 *     `FactorSelectionInput`'s own field set has no field shaped like a
 *     party's raw financial inputs (`currentExposure`/`proposedSpend`/
 *     `privateSpendLimit`/`privateRiskLimit`, or any generic map of those) —
 *     mirroring `underwritingProviderTypes.ts`'s own gate-1 structural
 *     proof and `velaUnderwritingRiskTelemetry.ts`'s own privacy-boundary
 *     field set exactly. Proven by a `@ts-expect-error` gate test.
 *
 *  6. "Factor's selection artifact should be receiptable and traceable into
 *     the final causal chain." Enforced by a NEW, DVN-anchorable
 *     `ActivityActionType`, `'factor_selection_proposed'` (see
 *     `services/receipts/activityReceiptService.ts` and
 *     `services/dvn/activityReceiptDvnPipeline.ts`), written via
 *     `recordFactorSelection` below.
 *
 * ALSO PER THE OPERATOR, explicitly: "do not let Factor call the
 * underwriting provider directly in a way that bypasses the MoneyPenny
 * orchestration path. Factor should assemble the opportunity; MoneyPenny
 * should remain the place where that opportunity becomes consequential." —
 * enforced by IMPORT BOUNDARY: this file imports nothing from
 * `services/vela/velaMultiPartyProjection.ts`,
 * `services/vela/velaUnderwritingProjection.ts`, or
 * `services/financialServices/providers/underwriting/*`. It never calls
 * `runVelaUnderwritingProjection` or any Vela transport function.
 *
 * OUT OF SCOPE for this item (do not extend this file, or wire it into
 * `velaUnderwritingProjection.ts`, to cover these — that composition is the
 * NEXT item's job): Aegis admission-evidence integration; MoneyPenny binding
 * this artifact into `velaUnderwritingProjection.ts`'s request construction;
 * any change to `useCaseZeroOrchestrator.ts`/`factorCaseService.ts`/the
 * `factor_cases` state machine; any live/external candidate-agent registry
 * or scoring/ranking logic (`REGISTRABLE_AGENTS` is the only real registry
 * that exists today — see `resolveRegistrableAgent` below); any UI/demo
 * surface; any change to `velaUnderwritingProjection.ts` or
 * `velaMultiPartyProjection.ts` themselves.
 *
 * Server-side only (imports `createActivityReceipt`, server-only).
 */

import { createHash } from 'crypto';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

/**
 * Which side computed this selection's terms. ALWAYS `'SIMULATED'` today —
 * no LIVE candidate-discovery/economic-terms provider exists anywhere in
 * this codebase (mirrors `UnderwritingProviderMode`'s own "no LIVE
 * implementation exists yet" discipline in
 * `underwritingProviderTypes.ts`). Deliberately NOT a `FactorSelectionInput`
 * field — a caller cannot claim LIVE for a capability that does not exist
 * (CLAUDE.md No-Guessing rule).
 */
export type FactorCandidateProviderMode = 'SIMULATED' | 'LIVE';

export interface FactorSelectionInput {
  requestRef: string;
  applicationId: string;
  /**
   * Resolved against `services/horizen/registrableAgents.ts`'s
   * `REGISTRABLE_AGENTS` — the ONLY real candidate-agent registry that
   * exists in this codebase today. An unrecognised slug makes
   * `proposeFactorSelection` throw rather than invent a runtime agent id
   * (CLAUDE.md No-Guessing rule).
   */
  candidateAgentSlug: string;
  /**
   * The counterparty's own opaque namespace ref, if already known from the
   * multi-party wiring's own `deriveVelaPartyNamespaceRef` output — never a
   * raw identity string. Optional.
   */
  counterpartyNamespaceRef?: string | null;
  /**
   * Which coverage/underwriting (or other) service Factor is proposing for
   * this request — a caller-supplied opaque identifier. This module does
   * NOT auto-resolve it from the underwriting provider (that would require
   * importing from
   * `services/financialServices/providers/underwriting/*`, which this
   * module must never do — see the import-boundary invariants above).
   * Optional; `null` when not applicable.
   */
  serviceId?: string | null;
  /**
   * Raw quoted terms Factor received from the candidate/service — NEVER
   * trusted truth, NEVER stored/forwarded verbatim (invariant 3 above).
   * Optional; omit when no terms are available yet.
   */
  rawQuotedTerms?: Record<string, unknown>;
  /**
   * String form of an on-chain asset reference (never a live bigint —
   * bigint does not round-trip through JSON/JSONB). Optional.
   */
  assetContext?: { tokenAddress: string; assetAmount: string } | null;
  selectionReason: string;
  evidenceRefs?: string[];
  /**
   * The runtime agent id of the Factor instance making this proposal (e.g.
   * 'aigent-factor') — caller-supplied, never hardcoded here (mirrors every
   * other module in this chain's own `requestedByAgentRef`/`factorAgentId`
   * convention: never invented, never defaulted silently).
   */
  factorAgentId: string;
}

export interface FactorSelectionArtifact {
  selectionRef: string;
  requestRef: string;
  /** The RESOLVED `runtimeAgentId` (e.g. 'aigent-nakamoto'), never the raw slug. */
  candidateAgentId: string;
  serviceId: string | null;
  /** == `counterpartyNamespaceRef`, opaque. */
  counterpartyId: string | null;
  providerMode: FactorCandidateProviderMode;
  /** Full sha256 hex digest (64 chars), or `null` when no terms were supplied. */
  quotedTermsRef: string | null;
  assetContext: { tokenAddress: string; assetAmount: string } | null;
  selectionReason: string;
  evidenceRefs: string[];
  timestamp: string;
  factorAgentId: string;
}

/**
 * Builds a Factor candidate-selection artifact. Pure: no DB, no receipt, no
 * network call.
 *
 * Throws when `input.candidateAgentSlug` does not resolve against
 * `REGISTRABLE_AGENTS` — never invents a `candidateAgentId` for an
 * unrecognised slug (CLAUDE.md No-Guessing rule).
 */
export function proposeFactorSelection(input: FactorSelectionInput): FactorSelectionArtifact {
  const resolved = resolveRegistrableAgent(input.candidateAgentSlug);
  if (!resolved) {
    throw new Error(
      `Factor selection: unknown candidate agent slug "${input.candidateAgentSlug}" — refusing to invent a runtime agent id.`,
    );
  }
  const candidateAgentId = resolved.runtimeAgentId;

  // ALWAYS 'SIMULATED' — no LIVE provider exists anywhere in this codebase
  // today (see this file's header + FactorCandidateProviderMode's own doc
  // comment). Never accepted as an input field.
  const providerMode: FactorCandidateProviderMode = 'SIMULATED';

  const selectionRef = createHash('sha256')
    .update('factor:selection:' + input.requestRef + ':' + candidateAgentId)
    .digest('hex')
    .slice(0, 16);

  const quotedTermsRef =
    input.rawQuotedTerms !== undefined
      ? createHash('sha256')
          .update('factor:quoted-terms:' + JSON.stringify(input.rawQuotedTerms))
          .digest('hex')
      : null;

  return {
    selectionRef,
    requestRef: input.requestRef,
    candidateAgentId,
    serviceId: input.serviceId ?? null,
    counterpartyId: input.counterpartyNamespaceRef ?? null,
    providerMode,
    quotedTermsRef,
    assetContext: input.assetContext ?? null,
    selectionReason: input.selectionReason,
    evidenceRefs: input.evidenceRefs ?? [],
    timestamp: new Date().toISOString(),
    factorAgentId: input.factorAgentId,
  };
}

export interface RecordFactorSelectionParams {
  actorPersonaId: string;
  /** Typically the same as `artifact.factorAgentId`, but caller-supplied per
   *  this chain's own convention — never re-derived silently from the artifact. */
  requestedByAgentRef: string;
  activeCartridge?: string;
}

const DEFAULT_ACTIVE_CARTRIDGE = 'moneypenny';

/**
 * Writes the ONE causal receipt for a Factor selection proposal via
 * `createActivityReceipt` directly (never the `constitutionalCommerce`
 * apparatus, a different single-party authority/mandate flow — same choice
 * every prior item in this chain made). `actionInput` binds the artifact
 * VERBATIM — it is already privacy-safe by construction (invariant 5), so
 * no hand-reconstructed subset is needed.
 */
export async function recordFactorSelection(
  artifact: FactorSelectionArtifact,
  params: RecordFactorSelectionParams,
): Promise<{ receiptId: string | null }> {
  const receipt = await createActivityReceipt({
    personaId: params.actorPersonaId,
    activeCartridge: params.activeCartridge ?? DEFAULT_ACTIVE_CARTRIDGE,
    actionType: 'factor_selection_proposed',
    summary:
      `Factor proposed candidate ${artifact.candidateAgentId} for request ${artifact.requestRef} ` +
      `(${artifact.providerMode})`,
    agentsInvoked: [params.requestedByAgentRef],
    actionInput: artifact as unknown as Record<string, unknown>,
  });
  return { receiptId: receipt?.id ?? null };
}
