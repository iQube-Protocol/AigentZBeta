/**
 * Vela underwriting party binding — Use Case Zero build-order item 10b, the
 * direct sequel to item 10a (`services/vela/velaUnderwritingChainProjection.ts`,
 * merged 2026-09-13 as dev@26a3cb321).
 *
 * THE GAP THIS CLOSES (read `supabase/migrations/
 * 20261001001100_vela_underwriting_party_bindings.sql`'s own header first —
 * this file is that migration's ONLY reader/writer): there is no binding
 * anywhere in this codebase between a `party` label used in a
 * `VelaMultiPartyDisclosureScope` grant (`velaMultiPartyProjection.ts` —
 * `grants[].party`/`.to` are free strings) and any real, authenticated
 * persona. A party's "view" of a Constitutional Risk Flow could not be
 * authorized non-spoofably. Operator ruling this item implements (verbatim,
 * 2026-09-14): "Party identity in a transaction is not a client-supplied
 * label. It is a recorded constitutional binding between the transaction
 * namespace and the authenticated principal/persona that contributed or was
 * authorized to control that namespace."
 *
 * THIS TABLE IS NOT `activity_receipts` — NEVER RECEIPTED, NEVER ANCHORED:
 * per CLAUDE.md's HMS Identifier Isolation / Identity & Access Spine T0 rule,
 * a real personaId must never appear in a DVN-anchorable/chain-bound record.
 * `vela_underwriting_party_bindings` is server-internal access-control
 * metadata — the same escape valve `factor_case_events.actor_persona_id`
 * already establishes in this codebase. This file never calls
 * `createActivityReceipt`, never touches
 * `services/dvn/activityReceiptDvnPipeline.ts`, and adds no new
 * `ActivityActionType`.
 *
 * ANTI-ENUMERATION, THE WHOLE POINT OF `resolvePartyBindingForViewer`: EVERY
 * non-match case — no row for (requestRef, partyLabel) at all, or a row that
 * exists but names a DIFFERENT persona — resolves the exact SAME
 * `{ authorized: false }` shape. A caller must never be able to distinguish
 * "no such party" from "wrong persona" from either the return value or any
 * error text; this is what makes a party label non-spoofable rather than
 * merely gated. See `tests/vela-underwriting-party-binding.test.ts`'s own
 * non-spoofability suite.
 *
 * UNIQUENESS, DELIBERATELY NARROW (mirrors the migration's own
 * `UNIQUE (request_ref, party_label)` — never `(request_ref,
 * authority_persona_id)`): the same persona MAY legitimately hold more than
 * one party role on the same requestRef, each as its own separate row. This
 * file never assumes "one persona, one party" anywhere.
 *
 * NO "LIST MY PARTY BINDINGS" LOOKUP — mirrors item 10a's own precedent (no
 * "list my requests" UI exists either): a participant must already know
 * their own requestRef + partyLabel, the same honest scoping as the
 * operator's own text-input pattern in `ConstitutionalRiskFlowPanel.tsx`.
 *
 * Fail-closed, never throws — mirrors `velaUnderwritingRiskTelemetry.ts`'s
 * own discipline: a missing admin client, a query error, or an unexpected
 * exception resolves the caller's own safe default (`null` for a record,
 * `{ authorized: false }` for a resolution) rather than propagating.
 *
 * Server-side only (imports `getSupabaseServer`, server-only).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const PARTY_BINDINGS_TABLE = 'vela_underwriting_party_bindings';

/** The migration's own CHECK constraint — the only value this column may
 *  hold today. Kept as an explicit union (not `string`) so a caller adding a
 *  second binding type in the future must deliberately extend both this type
 *  and the migration's CHECK together. */
export type VelaUnderwritingPartyBindingType = 'CONTRIBUTOR';

export interface RecordUnderwritingPartyBindingInput {
  requestRef: string;
  applicationId: string;
  partyLabel: string;
  partyNamespaceRef: string;
  /** The authenticated principal identifier this binding is recorded under —
   *  caller-supplied, never derived here. */
  authorityPrincipalId: string;
  /** The real, authenticated persona this party label resolves to. T0 —
   *  never leaves this server-only module past its own DB write. */
  authorityPersonaId: string;
  /** The persona whose OWN activity_receipts rows carry this requestRef's
   *  chain evidence — see this file's header and the migration's own column
   *  comment. */
  flowOwnerPersonaId: string;
  /** Opaque reference to whatever evidence grounded this binding (e.g. a
   *  disclosure-authorization ref) — caller-supplied, never fabricated when
   *  absent. */
  bindingEvidenceRef?: string;
  bindingType?: VelaUnderwritingPartyBindingType;
}

/**
 * Records ONE party-binding row via a plain insert. Fail-closed: resolves
 * `null` (never throws) whenever the database is unavailable, the write
 * itself errors (including a UNIQUE(request_ref, party_label) violation on a
 * duplicate binding attempt), or an unexpected exception occurs.
 */
export async function recordUnderwritingPartyBinding(
  input: RecordUnderwritingPartyBindingInput,
): Promise<{ id: string } | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;

  try {
    const { data, error } = await admin
      .from(PARTY_BINDINGS_TABLE)
      .insert({
        request_ref: input.requestRef,
        application_id: input.applicationId,
        party_label: input.partyLabel,
        party_namespace_ref: input.partyNamespaceRef,
        authority_principal_id: input.authorityPrincipalId,
        authority_persona_id: input.authorityPersonaId,
        flow_owner_persona_id: input.flowOwnerPersonaId,
        binding_type: input.bindingType ?? 'CONTRIBUTOR',
        binding_evidence_ref: input.bindingEvidenceRef ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error(
        '[vela-underwriting-party-binding] insert failed:',
        (error as { message?: string } | null)?.message ?? 'no row returned',
      );
      return null;
    }
    return { id: String((data as { id: unknown }).id) };
  } catch (err) {
    console.error(
      '[vela-underwriting-party-binding] insert threw:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export interface ResolvePartyBindingForViewerParams {
  requestRef: string;
  partyLabel: string;
  /** The CALLER's own resolved persona (from the identity spine) — never a
   *  client-supplied value. */
  viewerPersonaId: string;
}

export type ResolvePartyBindingForViewerResult =
  | { authorized: true; flowOwnerPersonaId: string }
  | { authorized: false };

/** One shared denial value — every non-match path returns THIS, never a
 *  differently-shaped or differently-detailed refusal (anti-enumeration; see
 *  this file's header). */
const DENIED: ResolvePartyBindingForViewerResult = { authorized: false };

interface PartyBindingRow {
  authority_persona_id: string;
  flow_owner_persona_id: string;
}

/**
 * Resolves whether `viewerPersonaId` may view `partyLabel`'s Constitutional
 * Risk Flow participant view for `requestRef`. Looks up the ONE row for
 * (requestRef, partyLabel) and returns `authorized: true` with
 * `flowOwnerPersonaId` ONLY when that row's `authority_persona_id` equals
 * `viewerPersonaId` EXACTLY. Every other case — no row at all, or a row
 * naming a different persona — resolves the SAME `{ authorized: false }`.
 * Fail-closed on a query error or unexpected exception too.
 */
export async function resolvePartyBindingForViewer(
  params: ResolvePartyBindingForViewerParams,
): Promise<ResolvePartyBindingForViewerResult> {
  const admin = getSupabaseServer();
  if (!admin) return DENIED;

  try {
    const { data, error } = await admin
      .from(PARTY_BINDINGS_TABLE)
      .select('authority_persona_id, flow_owner_persona_id')
      .eq('request_ref', params.requestRef)
      .eq('party_label', params.partyLabel)
      .maybeSingle();

    if (error) {
      console.error('[vela-underwriting-party-binding] resolve read failed:', error.message ?? error);
      return DENIED;
    }
    if (!data) return DENIED;

    const row = data as unknown as PartyBindingRow;
    if (row.authority_persona_id !== params.viewerPersonaId) return DENIED;

    return { authorized: true, flowOwnerPersonaId: String(row.flow_owner_persona_id) };
  } catch (err) {
    console.error(
      '[vela-underwriting-party-binding] resolve threw:',
      err instanceof Error ? err.message : String(err),
    );
    return DENIED;
  }
}
