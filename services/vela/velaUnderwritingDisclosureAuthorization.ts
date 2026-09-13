/**
 * Vela underwriting disclosure authorization — Use Case Zero build-order
 * item 9's Tier-1 act, the direct sequel to item 8
 * (`services/vela/velaUnderwritingAdmissionEvidence.ts`, merged 2026-09-13).
 *
 * OPERATOR'S OWN RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "The
 * next item should be: MoneyPenny Constitutional Composition Gate. Its job
 * is narrow: consume the existing Factor selection artifact + Aegis
 * admission evidence + QubeTalk/iQube disclosure authorization and only then
 * construct/freeze the multi-party Vela request. The sequence should become:
 * Factor selection -> Aegis admission -> QubeTalk/iQube disclosure
 * authorization -> MoneyPenny composition gate -> frozen multi-party
 * consequence/risk envelope -> Vela submission. [...] QubeTalk/iQube
 * disclosure scope must authorize the exact parties, request, computation
 * and output class. COMPUTE_WITH and DISCLOSE_TO remain separate at this
 * layer too. [...] And yes, QubeTalk/iQube disclosure authorization should
 * be part of this backend item, not deferred again. We already have the
 * guest-side disclosure semantics; this step should bind the real upstream
 * authorization artifact into that wire format."
 *
 * THIS FILE IS THE "BIND THE REAL UPSTREAM AUTHORIZATION ARTIFACT INTO THAT
 * WIRE FORMAT" HALF OF THAT INSTRUCTION. It does not invent a second
 * disclosure-scope shape — it wraps the ALREADY-BUILT, guest-wire-exact
 * `VelaMultiPartyDisclosureScope` (`services/vela/velaMultiPartyProjection.ts`)
 * in a receiptable, provenance-bound authorization record: WHO authorized
 * this exact scope (`authorizedByAgentRef`), for WHICH selection/request
 * (`selectionRef`/`requestRef`/`applicationId`), and what evidence grounded
 * that authorization (`evidenceRefs` — opaque references to the actual
 * QubeTalk conversation/message ids or iQube consent records; never invented
 * when absent). The MoneyPenny composition gate
 * (`velaUnderwritingCompositionGate.ts`, this item's other half) is the ONLY
 * consumer of the object this file produces.
 *
 * TWO DISAMBIGUATIONS, both explicit operator instructions, both already
 * investigated — read before touching anything named "disclosure" in this
 * codebase:
 *
 *  1. `services/qubetalk/disclosurePolicy.ts` (`evaluateDisclosure`/
 *     `isDisclosableTo`) is a DIFFERENT, unrelated concept: it decides which
 *     pieces of CONVERSATION CONTEXT (chat messages/notes) may be surfaced
 *     to which audience in QubeTalk messaging. THIS file's disclosure
 *     authorization is a FINANCIAL-COMPUTATION scope authorization — which
 *     parties may COMPUTE_WITH/DISCLOSE_TO which output, for which specific
 *     request — never a chat-context-visibility decision. This file imports
 *     nothing from `disclosurePolicy.ts` and does not extend
 *     `evaluateDisclosure` to cover this case (see "rejected approaches" in
 *     the accompanying resolution record).
 *  2. `services/moneypenny/admissionAuthority.ts`'s `decideAdmission` is a
 *     DIFFERENT, pre-existing, case-scoped (`factor_cases`) agent-onboarding
 *     readiness admission decision — unrelated to this item's request-scoped
 *     underwriting flow. Neither this file nor its sibling
 *     (`velaUnderwritingCompositionGate.ts`) calls, imports, or approximates
 *     it. "MoneyPenny" in THIS item's own name refers freshly to the
 *     composition-gate role the governing architecture doc
 *     (`docs/vela/accelerator/constitutional-financial-services/
 *     03_MONEYPENNY_DISCLOSURE_AND_RISK_ARCHITECTURE_v0.1.md`) assigns that
 *     agent for the request-scoped flow, not a call into that other module.
 *
 * WHAT THIS FILE COMPOSES, NEVER FORKS: `assertValidVelaMultiPartyDisclosureScope`
 * (`velaMultiPartyProjection.ts`) is the ONLY scope-shape validation this file
 * performs — reused verbatim, never reimplemented. This is where "COMPUTE_WITH
 * and DISCLOSE_TO remain separate at this layer too" is enforced: by reusing
 * the substrate's own type-and-runtime-validated `VelaScopeAction` union
 * rather than a looser, locally-invented shape that could drift from it.
 * `createActivityReceipt` (`services/receipts/activityReceiptService.ts`) is
 * the canonical receipt writer, used directly — same choice every prior item
 * in this chain made.
 *
 * PURE CONSTRUCTION, ZERO EFFECT: `authorizeUnderwritingDisclosure` performs
 * no DB write, no receipt, no network call — it validates and stamps a
 * deterministic `authorizationRef` commitment over
 * (selectionRef, requestRef, applicationId, scope). `recordUnderwritingDisclosureAuthorization`
 * is the separate, explicit effectful step, mirroring every sibling in this
 * chain's own compose/record split
 * (`proposeFactorSelection`/`recordFactorSelection`,
 * `composeUnderwritingAdmissionEvidence`/`recordUnderwritingAdmissionEvidence`).
 *
 * OUT OF SCOPE for this file (built by its sibling,
 * `velaUnderwritingCompositionGate.ts`, instead): cross-referencing this
 * authorization against a Factor selection or Aegis admission artifact;
 * freezing a multi-party envelope; submitting anything to Vela. This file
 * produces one authorization artifact and its receipt, nothing more.
 *
 * Server-side only (imports `velaMultiPartyProjection.ts` and
 * `activityReceiptService.ts`, both server-side only).
 */

import { createHash } from 'crypto';
import {
  assertValidVelaMultiPartyDisclosureScope,
  type VelaMultiPartyDisclosureScope,
} from './velaMultiPartyProjection';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export interface VelaUnderwritingDisclosureAuthorizationInput {
  /** Binds this authorization to the EXACT Factor proposal it covers — never
   *  a separately-suppliable candidate/request identifier; the composition
   *  gate independently cross-references these against the real Factor
   *  selection artifact before ever trusting this authorization. */
  selectionRef: string;
  requestRef: string;
  applicationId: string;
  /** The REAL, already-existing Vela wire-format scope — reused verbatim,
   *  never redefined or wrapped in a second shape. This authorization IS an
   *  authorized, receipted, provenance-bound instance of this exact type. */
  scope: VelaMultiPartyDisclosureScope;
  /** Who/what performed this Tier-1 authorization act (e.g. a QubeTalk
   *  conversation coordinator, an operator-facing consent flow) — caller-
   *  supplied, never invented or defaulted to a hardcoded agent. */
  authorizedByAgentRef: string;
  /** Opaque references to the actual QubeTalk conversation/message ids or
   *  iQube consent records that grounded this authorization — caller-
   *  supplied, never fabricated when absent (empty array, not a guessed
   *  placeholder). */
  evidenceRefs?: string[];
}

export interface VelaUnderwritingDisclosureAuthorization {
  authorizationRef: string;
  selectionRef: string;
  requestRef: string;
  applicationId: string;
  scope: VelaMultiPartyDisclosureScope;
  authorizedByAgentRef: string;
  evidenceRefs: string[];
  timestamp: string;
}

/**
 * Constructs a Tier-1 disclosure-authorization artifact. Pure: no DB, no
 * receipt, no network call.
 *
 * Calls `assertValidVelaMultiPartyDisclosureScope(input.scope)` FIRST — this
 * throws on a malformed scope (missing/non-object binding, a `grants` field
 * that is not an array, a grant whose `action` is not exactly
 * `'COMPUTE_WITH'`/`'DISCLOSE_TO'`, etc.) before any field of this
 * authorization is assembled, exactly mirroring
 * `buildVelaMultiPartyProjectionRequest`'s own gate-1 discipline. This is
 * where "COMPUTE_WITH and DISCLOSE_TO remain separate at this layer too" is
 * enforced — by reuse, not by a second implementation.
 */
export function authorizeUnderwritingDisclosure(
  input: VelaUnderwritingDisclosureAuthorizationInput,
): VelaUnderwritingDisclosureAuthorization {
  assertValidVelaMultiPartyDisclosureScope(input.scope);

  const authorizationRef = createHash('sha256')
    .update(
      'vela:disclosure-authorization:' +
        input.selectionRef +
        ':' +
        input.requestRef +
        ':' +
        input.applicationId +
        ':' +
        JSON.stringify(input.scope),
    )
    .digest('hex')
    .slice(0, 16);

  return {
    authorizationRef,
    selectionRef: input.selectionRef,
    requestRef: input.requestRef,
    applicationId: input.applicationId,
    scope: input.scope,
    authorizedByAgentRef: input.authorizedByAgentRef,
    evidenceRefs: input.evidenceRefs ?? [],
    timestamp: new Date().toISOString(),
  };
}

export interface RecordUnderwritingDisclosureAuthorizationParams {
  actorPersonaId: string;
  /** Typically the same as `authorization.authorizedByAgentRef`, but
   *  caller-supplied per this chain's own convention — never re-derived
   *  silently from the authorization. */
  requestedByAgentRef: string;
  activeCartridge?: string;
}

const DEFAULT_ACTIVE_CARTRIDGE = 'moneypenny';

/**
 * Writes the ONE causal receipt for a disclosure-authorization act via
 * `createActivityReceipt` directly (never the `constitutionalCommerce`
 * apparatus — same choice every prior item in this chain made).
 * `actionInput` binds the authorization VERBATIM — it carries only opaque
 * refs, the public wire-level scope, and the authorizing agent id, so no
 * hand-reconstructed subset is needed.
 */
export async function recordUnderwritingDisclosureAuthorization(
  authorization: VelaUnderwritingDisclosureAuthorization,
  params: RecordUnderwritingDisclosureAuthorizationParams,
): Promise<{ receiptId: string | null }> {
  const receipt = await createActivityReceipt({
    personaId: params.actorPersonaId,
    activeCartridge: params.activeCartridge ?? DEFAULT_ACTIVE_CARTRIDGE,
    actionType: 'vela_underwriting_disclosure_authorized',
    summary:
      `Disclosure authorized for request ${authorization.requestRef} ` +
      `(selection ${authorization.selectionRef}, application ${authorization.applicationId})`,
    agentsInvoked: [params.requestedByAgentRef],
    actionInput: authorization as unknown as Record<string, unknown>,
  });
  return { receiptId: receipt?.id ?? null };
}
