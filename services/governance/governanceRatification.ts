/**
 * Governance Ratification — the persisted constitutional act.
 *
 * OPERATOR RULING, 2026-07-27:
 *
 *   "Ratification must become an explicit authorised operator act. Editing a
 *    constitutional document does not constitute ratification and must not
 *    automatically emit a governance receipt. The ratification act must bind the
 *    decision to the exact document version and immutable content hash, invoke
 *    the existing governance receipt helper, and enter the DVN anchoring
 *    pipeline."
 *
 *   "The platform cannot infer constitutional authority from a repository edit.
 *    A document edit may mean: drafting; typo correction; formatting; proposal;
 *    negotiation; amendment preparation; metadata maintenance; actual
 *    ratification."
 *
 *     Document edited           → proposed constitutional state
 *     Explicit ratification act → authorised constitutional transition
 *                               → governance receipt → anchoring
 *
 * WHAT THIS MODULE IS. The observable governance record that replaces the
 * hardcoded `GOVERNANCE_DECISIONS` array as the EVENT SOURCE. A ratification is
 * written here first; the receipt, the decision-log projection, the DVN anchor
 * and the publication CID all hang off this row:
 *
 *     Ratification event → Governance record
 *                            ├── Governance Decision Log projection
 *                            ├── Activity receipt
 *                            ├── DVN anchor
 *                            └── Constitutional document registry
 *
 * THE SEQUENCE (the ruling's canonical order, steps 3–10):
 *   3/4. freeze + hash the candidate  — `resolveRatificationCandidate`
 *   5.   explicit authorised act      — the caller is admin-gated (the route)
 *   6.   persist the event            — insert, receipt_id NULL
 *   7.   createGovernanceReceipt()    — the existing helper, never a fork
 *   8.   DVN                          — the helper's action types are already
 *                                       in ANCHORABLE_ACTION_TYPES; nothing in
 *                                       the DVN pipeline is touched
 *   9/10. publish + attach CID/anchor — `attachPublication`, and anchor state is
 *                                       OBSERVED from the receipt, never stored
 *
 * ANCHORING DOES NOT DEPEND ON PUBLICATION. The hash is computed and committed
 * at step 4. `contentCid` is attached later or never. A ratification whose
 * Autodrive publish fails is a valid, receipted, anchorable ratification with
 * `contentCid: null` — the ruling is explicit that "anchoring should not
 * silently depend on publication succeeding."
 *
 * ANCHOR STATE IS OBSERVED, NOT ASSERTED. There is deliberately NO
 * `anchor_status` column. Writing a hopeful value at insert time is how a record
 * comes to claim an anchor it never got. The state is read from the receipt's
 * real `receipt_status` at read time, and BOTH vocabularies are reported: the
 * receipt's own (`local | dvn_pending | dvn_recorded | dvn_failed`) and the
 * ruling's governance vocabulary (`local | submitted | anchored | failed`). Map,
 * never unify — the two words mean things in two different systems.
 *
 * RETROSPECTIVE ≠ ORIGINAL. Law XVI and the Horizen amendments were ratified
 * before any of this existed. They enter as `ratificationKind: 'retrospective'`
 * and carry the honesty fields the ruling requires: the original ratification
 * date, the date the platform recorded it, whether the exact historical content
 * was recoverable, and whether anchoring is retrospective. Critically,
 * `contentHashScope` says WHICH document the hash is of — `as-ratified` (the
 * bytes that were actually ratified) or `as-recorded` (the document as it stands
 * today, which may differ). A retrospective attestation that cannot recover the
 * historical bytes MUST be `as-recorded`; claiming otherwise would be exactly
 * the misrepresentation the ruling forbids.
 *
 * T2 discipline: NO personaId is ever stored or serialised. The ratifying
 * authority is a one-way `ratifiedByRef` commitment, the same class of value the
 * DVN pipeline and the Constitutional Agreement primitive already use. The
 * object is `findForbiddenObjectKey`-clean by construction, and a leak is a
 * REFUSAL, never a write.
 */

import { createHash } from 'crypto';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  standingBandFor,
  findForbiddenObjectKey,
  type ConstitutionalObject,
} from '@/types/constitutionalObject';
import { createGovernanceReceipt } from '@/services/governance/governanceReceiptHelper';
import type { ReceiptStatus } from '@/services/receipts/activityReceiptService';
import {
  GOVERNANCE_DECISIONS,
  type DecisionDomain,
  type DecisionStatus,
  type GovernanceDecision,
  type SovereigntyImpact,
} from '@/services/governance/governanceDecisionLog';
import {
  resolveFrameworkByPath,
  hashDocumentBody,
  type ConstitutionalDocument,
} from '@/services/polity/constitutionalFrameworkRegistry';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';

const MISSING = 'governance_ratifications';

// ---------------------------------------------------------------------------
// §1 The contract
// ---------------------------------------------------------------------------

export const RATIFICATION_LIFECYCLE = ['proposed', 'ratified', 'published', 'superseded'] as const;
export type RatificationLifecycleState = (typeof RATIFICATION_LIFECYCLE)[number];

/** Whether this is the act itself, or a later attestation of a past act. */
export type RatificationKind = 'original' | 'retrospective';

/**
 * WHICH document the `contentHash` is of. The honesty field.
 *  - `as-ratified` — the bytes that were actually ratified at `ratifiedAt`.
 *  - `as-recorded` — the document as it stands at `recordedAt`, which may differ
 *                    from what was ratified. The only honest scope for a
 *                    retrospective attestation whose historical bytes are gone.
 */
export type ContentHashScope = 'as-ratified' | 'as-recorded';

/** The ruling's anchoring vocabulary. Mapped from the receipt's, never merged. */
export type AnchorStatus = 'local' | 'submitted' | 'anchored' | 'failed';

/** The two lifecycle acts. Both are already in ANCHORABLE_ACTION_TYPES. */
export const RATIFICATION_ACTS = {
  ratify: 'governance_decision_ratified',
  amend: 'governance_decision_amended',
} as const;
export type RatificationAct = keyof typeof RATIFICATION_ACTS;

/** The ratification object the ruling specifies, plus the honesty fields. */
export interface GovernanceRatification {
  decisionId: string;

  documentId: string;
  documentTitle: string;
  documentVersion: string;
  /** Repo-relative provenance of the hashed bytes. */
  documentPath: string;
  /** The registered framework this document is, when it is one. */
  frameworkId: string | null;

  /** MANDATORY. sha256 of the exact bytes ratified. */
  contentHash: string;
  /** Attached AFTER publication, if publication happens at all. */
  contentCid: string | null;
  contentHashScope: ContentHashScope;

  amendmentIds: string[];
  supersedes: string[];
  /** The content hash of the document version this one replaces, when known. */
  previousContentHash: string | null;

  /** T2 one-way commitment of the ratifying authority. NEVER a personaId. */
  ratifiedBy: string;
  authorityBasis: string;

  act: RatificationAct;
  ratificationKind: RatificationKind;
  /** The constitutional date — the historical date for a retrospective record. */
  ratifiedAt: string;
  /** When the PLATFORM recorded it. Equals `ratifiedAt` for an original act. */
  recordedAt: string;
  effectiveAt: string | null;

  /** Retrospective only. null for an original act (the question is meaningless). */
  historicalContentRecoverable: boolean | null;
  anchoringIsRetrospective: boolean;

  receiptId: string | null;
  /** The receipt's OWN status — observed, never written by this module. */
  receiptStatus: ReceiptStatus | null;
  /** The governance-vocabulary reading of the same observation. */
  anchorStatus: AnchorStatus | null;

  domain: DecisionDomain;
  summary: string;
  publishedAt: string | null;
}

export type RatificationPayload = Omit<
  GovernanceRatification,
  'receiptStatus' | 'anchorStatus'
>;

// ---------------------------------------------------------------------------
// §2 Pure helpers
// ---------------------------------------------------------------------------

function commitment(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 16);
}

/** T2-safe one-way commitment of the ratifying authority. Server-only. */
export function ratifierCommitment(personaId: string): string {
  return commitment('governance:ratifier', personaId);
}

/**
 * Map the receipt's status vocabulary onto the ruling's. PURE.
 *
 * The two vocabularies are NOT the same words and are not collapsed: the caller
 * always receives both. `dvn_pending` means "submitted to the canister and not
 * yet reconciled", which the governance vocabulary calls `submitted`; a receipt
 * with no DVN attempt at all is `local` in both, and that coincidence is not a
 * licence to treat the vocabularies as one.
 */
export function anchorStatusFromReceipt(status: ReceiptStatus | null | undefined): AnchorStatus | null {
  switch (status) {
    case 'local':
      return 'local';
    case 'dvn_pending':
      return 'submitted';
    case 'dvn_recorded':
      return 'anchored';
    case 'dvn_failed':
      return 'failed';
    default:
      return null;
  }
}

/** PURE — the ConstitutionalObject a ratification record carries. */
export function buildRatificationObject(
  payload: RatificationPayload,
): ConstitutionalObject<RatificationPayload> {
  return {
    identity: {
      id: payload.decisionId,
      kind: 'ratification',
      ref: commitment('ratification', payload.decisionId),
      displayLabel: `${payload.documentTitle} ${payload.documentVersion}`,
    },
    version: {
      version: 1,
      status: payload.ratificationKind === 'retrospective' ? 'active' : 'published',
      ...(payload.supersedes[0] ? { supersedes: payload.supersedes[0] } : {}),
    },
    // A ratified constitutional document is foundational by definition; a
    // retrospective attestation of one is canonical but not self-elevating.
    standing:
      payload.ratificationKind === 'original'
        ? { standing: 0.9, band: standingBandFor(0.9), reach: 0 }
        : { standing: 0.7, band: standingBandFor(0.7), reach: 0 },
    authority: {
      ratificationRequired: true,
      governingInvariants: ['CFS-009', payload.authorityBasis],
    },
    ownership: { ownerCommitment: payload.ratifiedBy },
    provenance: {
      receiptIds: payload.receiptId ? [payload.receiptId] : [],
      contentCommitment: payload.contentHash,
      source: payload.ratificationKind === 'retrospective' ? 'attested' : 'ratified',
    },
    lifecycle: {
      state: payload.contentCid ? 'published' : 'ratified',
      order: RATIFICATION_LIFECYCLE,
    },
    dependencies: [{ id: payload.documentId, kind: 'specification' }],
    payload,
  };
}

// ---------------------------------------------------------------------------
// §3 Candidate resolution — freeze + hash (ruling steps 3 and 4)
// ---------------------------------------------------------------------------

/**
 * Roots a ratifiable document may live under. Ratification is an act over
 * CONSTITUTIONAL material; pointing it at arbitrary repo files would let the
 * governance ledger attest to anything.
 */
export const RATIFIABLE_ROOTS = [
  'codexes/packs/irl/foundation/',
  'codexes/packs/polity-core/items/',
  'codexes/packs/agentiq/updates/',
] as const;

export interface RatificationCandidate {
  document: ConstitutionalDocument;
  frameworkId: string | null;
}

/**
 * Resolve and FREEZE the exact bytes a ratification will commit to.
 *
 * Registered frameworks resolve through the Constitutional Framework Registry
 * (which supplies the declared id, title and version). An unregistered document
 * under a ratifiable root resolves through the SAME corpus-store read path —
 * never `readFileSync`, because `next.config` traces pack JSON only and a direct
 * `.md` read succeeds locally while returning nothing on Lambda. A document that
 * cannot be read yields null, and the act refuses rather than anchoring blind.
 */
export async function resolveRatificationCandidate(
  documentPath: string,
  fallback: { documentId?: string; documentTitle?: string; documentVersion?: string },
): Promise<RatificationCandidate | null> {
  const normalized = documentPath.trim().replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) return null;
  if (!RATIFIABLE_ROOTS.some((root) => normalized.startsWith(root))) return null;

  const registered = await resolveFrameworkByPath(normalized);
  if (registered) {
    return { document: registered.document, frameworkId: registered.definition.id };
  }

  // codexes/packs/<packId>/<rest>
  const parts = normalized.split('/');
  if (parts.length < 4 || parts[0] !== 'codexes' || parts[1] !== 'packs') return null;
  const packId = parts[2];
  const relPath = parts.slice(3).join('/');
  const body = await corpusReadPackFile(packId, relPath);
  if (!body) return null;

  return {
    frameworkId: null,
    document: {
      id: fallback.documentId?.trim() || relPath.split('/').pop() || normalized,
      title: fallback.documentTitle?.trim() || relPath.split('/').pop() || normalized,
      version: fallback.documentVersion?.trim() || 'unversioned',
      format: 'markdown',
      body,
      sourcePath: normalized,
      contentHash: hashDocumentBody(body),
      byteLength: Buffer.byteLength(body, 'utf8'),
    },
  };
}

// ---------------------------------------------------------------------------
// §4 Durable store (soft-fail, capabilityRegistry / agreement pattern)
// ---------------------------------------------------------------------------

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[governance ratification] migration 20260825000000 not applied; ${scope} skipped`);
  } else {
    console.error(`[governance ratification] ${scope} failed:`, message);
  }
}

function rowToPayload(row: Record<string, unknown>): RatificationPayload {
  return {
    decisionId: String(row.decision_id),
    documentId: String(row.document_id),
    documentTitle: String(row.document_title),
    documentVersion: String(row.document_version),
    documentPath: String(row.document_path),
    frameworkId: row.framework_id ? String(row.framework_id) : null,
    contentHash: String(row.content_hash),
    contentCid: row.content_cid ? String(row.content_cid) : null,
    contentHashScope: String(row.content_hash_scope) as ContentHashScope,
    amendmentIds: (row.amendment_ids as string[] | null) ?? [],
    supersedes: (row.supersedes as string[] | null) ?? [],
    previousContentHash: row.previous_content_hash ? String(row.previous_content_hash) : null,
    ratifiedBy: String(row.ratified_by_ref),
    authorityBasis: String(row.authority_basis),
    act: String(row.act) as RatificationAct,
    ratificationKind: String(row.ratification_kind) as RatificationKind,
    ratifiedAt: String(row.ratified_at),
    recordedAt: String(row.recorded_at),
    effectiveAt: row.effective_at ? String(row.effective_at) : null,
    historicalContentRecoverable:
      row.historical_content_recoverable === null || row.historical_content_recoverable === undefined
        ? null
        : Boolean(row.historical_content_recoverable),
    anchoringIsRetrospective: Boolean(row.anchoring_is_retrospective),
    receiptId: row.receipt_id ? String(row.receipt_id) : null,
    domain: String(row.domain) as DecisionDomain,
    summary: String(row.summary),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

/**
 * OBSERVE the anchor state of a set of records.
 *
 * One batched read of the receipts' REAL `receipt_status`. Nothing here writes
 * an anchor value; a record whose receipt row cannot be found reports
 * `receiptStatus: null` / `anchorStatus: null` — an unobserved anchor is
 * reported as unobserved, never as `local` (which would be an assertion).
 */
async function observeAnchorStatuses(
  payloads: RatificationPayload[],
): Promise<GovernanceRatification[]> {
  const receiptIds = payloads.map((p) => p.receiptId).filter((v): v is string => Boolean(v));
  const statuses = new Map<string, ReceiptStatus>();

  if (receiptIds.length) {
    const admin = getSupabaseServer();
    if (admin) {
      try {
        const { data, error } = await admin
          .from('activity_receipts')
          .select('id,receipt_status')
          .in('id', receiptIds);
        if (error) softFail('observe-anchor', error.message);
        for (const r of data ?? []) {
          if (r?.id && r?.receipt_status) statuses.set(String(r.id), r.receipt_status as ReceiptStatus);
        }
      } catch (e) {
        softFail('observe-anchor', e instanceof Error ? e.message : String(e));
      }
    }
  }

  return payloads.map((p) => {
    const receiptStatus = p.receiptId ? statuses.get(p.receiptId) ?? null : null;
    return { ...p, receiptStatus, anchorStatus: anchorStatusFromReceipt(receiptStatus) };
  });
}

export async function listRatifications(): Promise<GovernanceRatification[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from('governance_ratifications')
      .select('*')
      .order('ratified_at', { ascending: false });
    if (error) {
      softFail('list', error.message);
      return [];
    }
    return observeAnchorStatuses((data ?? []).map(rowToPayload));
  } catch (e) {
    softFail('list', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function getRatification(decisionId: string): Promise<GovernanceRatification | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('governance_ratifications')
      .select('*')
      .eq('decision_id', decisionId.trim())
      .maybeSingle();
    if (error) {
      softFail('get', error.message);
      return null;
    }
    if (!data) return null;
    const [observed] = await observeAnchorStatuses([rowToPayload(data)]);
    return observed ?? null;
  } catch (e) {
    softFail('get', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ---------------------------------------------------------------------------
// §5 The act
// ---------------------------------------------------------------------------

export interface RecordRatificationInput {
  personaId: string;
  decisionId: string;
  act: RatificationAct;
  candidate: RatificationCandidate;

  domain?: DecisionDomain;
  summary?: string;
  authorityBasis?: string;
  sovereigntyImpact?: SovereigntyImpact;

  amendmentIds?: string[];
  supersedes?: string[];
  previousContentHash?: string | null;
  effectiveAt?: string | null;

  /** Defaults to 'original'. */
  ratificationKind?: RatificationKind;
  /** REQUIRED for a retrospective record — the original constitutional date. */
  originalRatifiedAt?: string;
  /** REQUIRED for a retrospective record — the ruling's honesty question. */
  historicalContentRecoverable?: boolean;
}

export type RecordRatificationResult =
  | { ok: true; ratification: GovernanceRatification; alreadyRecorded: boolean }
  | { ok: false; reason: string };

/**
 * Perform and persist the ratification act. Ruling steps 6 → 8.
 *
 * ORDER MATTERS: the event is persisted BEFORE the receipt. If the receipt write
 * fails, the constitutional act still exists in the record with `receiptId: null`
 * and an unobserved anchor — visible and retryable. The reverse order would
 * produce a receipt for an act with no record, which is the gap this closes.
 */
export async function recordRatification(
  input: RecordRatificationInput,
): Promise<RecordRatificationResult> {
  const decisionId = input.decisionId?.trim();
  if (!decisionId) return { ok: false, reason: 'decisionId required' };

  const kind: RatificationKind = input.ratificationKind ?? 'original';
  const now = new Date().toISOString();

  // ── The honesty contract, BEFORE any I/O ─────────────────────────────────
  // Deliberately ahead of the store check so it is enforceable and testable
  // without a database: an attestation that misrepresents history must be
  // refused on its own terms, not merely wherever the connection happens to be.
  // Both questions must be answered explicitly; defaulting either one would
  // silently manufacture a claim about the past.
  if (kind === 'retrospective') {
    if (!input.originalRatifiedAt?.trim()) {
      return {
        ok: false,
        reason:
          "a retrospective attestation must state originalRatifiedAt — recording it under today's " +
          'date would misrepresent a historic ratification as a new one',
      };
    }
    if (typeof input.historicalContentRecoverable !== 'boolean') {
      return {
        ok: false,
        reason:
          'a retrospective attestation must state historicalContentRecoverable — whether the exact ' +
          'bytes that were ratified are recoverable determines whether the hash is as-ratified or as-recorded',
      };
    }
  } else if (input.originalRatifiedAt || typeof input.historicalContentRecoverable === 'boolean') {
    // The inverse misrepresentation: an ORIGINAL act carrying a historical
    // date would backdate a ratification that is happening right now.
    return {
      ok: false,
      reason:
        'originalRatifiedAt / historicalContentRecoverable belong to a retrospective attestation — ' +
        "an original act happens now and must not claim a past date. Pass ratificationKind: 'retrospective'.",
    };
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'governance ratification store unavailable' };

  const { document, frameworkId } = input.candidate;

  // WHICH document the hash is of. A retrospective record whose historical bytes
  // are NOT recoverable can only honestly hash the document as it stands today.
  const contentHashScope: ContentHashScope =
    kind === 'original' || input.historicalContentRecoverable === true ? 'as-ratified' : 'as-recorded';

  const payload: RatificationPayload = {
    decisionId,
    documentId: document.id,
    documentTitle: document.title,
    documentVersion: document.version,
    documentPath: document.sourcePath,
    frameworkId,
    contentHash: document.contentHash,
    contentCid: null,
    contentHashScope,
    amendmentIds: input.amendmentIds ?? [],
    supersedes: input.supersedes ?? [],
    previousContentHash: input.previousContentHash ?? null,
    ratifiedBy: ratifierCommitment(input.personaId),
    authorityBasis: input.authorityBasis?.trim() || 'Law XI — amending canon is an operator act',
    act: input.act,
    ratificationKind: kind,
    ratifiedAt: kind === 'retrospective' ? String(input.originalRatifiedAt) : now,
    recordedAt: now,
    effectiveAt: input.effectiveAt ?? null,
    historicalContentRecoverable:
      kind === 'retrospective' ? Boolean(input.historicalContentRecoverable) : null,
    anchoringIsRetrospective: kind === 'retrospective',
    receiptId: null,
    domain: input.domain ?? 'constitutional',
    summary:
      input.summary?.trim() ||
      `${input.act === 'ratify' ? 'Ratified' : 'Amended'} ${decisionId} — ${document.title} ${document.version}`,
    publishedAt: null,
  };

  const object = buildRatificationObject(payload);
  // T2 canary — a leak is a REFUSAL, never a write.
  const leak = findForbiddenObjectKey(object);
  if (leak) return { ok: false, reason: `T0 identifier leak in ratification object at ${leak} — refused` };

  // Idempotence: the same decision + the same bytes is the same act.
  try {
    const { data: existing } = await admin
      .from('governance_ratifications')
      .select('*')
      .eq('decision_id', decisionId)
      .maybeSingle();
    if (existing) {
      const existingPayload = rowToPayload(existing);
      if (existingPayload.contentHash !== payload.contentHash) {
        return {
          ok: false,
          reason:
            `"${decisionId}" is already ratified against content hash ${existingPayload.contentHash.slice(0, 16)}…; ` +
            `this document hashes to ${payload.contentHash.slice(0, 16)}…. A ratification record is immutable — ` +
            'ratify the changed document under a new decision id that supersedes this one.',
        };
      }
      const [observed] = await observeAnchorStatuses([existingPayload]);
      return { ok: true, ratification: observed, alreadyRecorded: true };
    }
  } catch (e) {
    softFail('precheck', e instanceof Error ? e.message : String(e));
  }

  // ── Step 6: persist the event, receipt_id NULL ────────────────────────────
  const { data: inserted, error: insertError } = await admin
    .from('governance_ratifications')
    .insert({
      decision_id: decisionId,
      document_id: payload.documentId,
      document_title: payload.documentTitle,
      document_version: payload.documentVersion,
      document_path: payload.documentPath,
      framework_id: payload.frameworkId,
      content_hash: payload.contentHash,
      content_cid: null,
      content_hash_scope: payload.contentHashScope,
      amendment_ids: payload.amendmentIds,
      supersedes: payload.supersedes,
      previous_content_hash: payload.previousContentHash,
      ratified_by_ref: payload.ratifiedBy,
      authority_basis: payload.authorityBasis,
      act: payload.act,
      ratification_kind: payload.ratificationKind,
      ratified_at: payload.ratifiedAt,
      recorded_at: payload.recordedAt,
      effective_at: payload.effectiveAt,
      historical_content_recoverable: payload.historicalContentRecoverable,
      anchoring_is_retrospective: payload.anchoringIsRetrospective,
      domain: payload.domain,
      summary: payload.summary,
      object,
    })
    .select('*')
    .single();

  if (insertError) {
    softFail('record', insertError.message);
    return {
      ok: false,
      reason: insertError.message.includes(MISSING)
        ? 'governance_ratifications table missing — apply migration 20260825000000'
        : insertError.message,
    };
  }

  // ── Step 7: the EXISTING governance receipt helper (never a fork) ─────────
  // ── Step 8: which puts governance_decision_ratified / _amended into the
  //           DVN pipeline, where both action types already live in
  //           ANCHORABLE_ACTION_TYPES. Nothing in that pipeline is touched.
  let receiptId: string | null = null;
  try {
    const receipt = await createGovernanceReceipt({
      personaId: input.personaId,
      actionType: RATIFICATION_ACTS[input.act],
      decisionId,
      decisionType: payload.domain,
      affectedRoles: [],
      // The receipt attests to WHAT was ratified, not merely to the decision id.
      affectedAssets: [
        `document:${payload.documentPath}`,
        `document-version:${payload.documentVersion}`,
        `sha256:${payload.contentHash}`,
        `hash-scope:${payload.contentHashScope}`,
        ...payload.amendmentIds.map((a) => `amendment:${a}`),
        ...payload.supersedes.map((s) => `supersedes:${s}`),
        ...(payload.previousContentHash ? [`previous-sha256:${payload.previousContentHash}`] : []),
        ...(payload.effectiveAt ? [`effective-at:${payload.effectiveAt}`] : []),
        `ratification-kind:${payload.ratificationKind}`,
        ...(payload.anchoringIsRetrospective ? ['anchoring:retrospective'] : []),
      ],
      authorityBasis: payload.authorityBasis,
      constitutionalBasis: payload.frameworkId ?? 'CFS-009',
      escalationPath: 'operator',
      sovereigntyImpact: input.sovereigntyImpact ?? { me: 'neutral', c: 'neutral', z: 'neutral' },
      summary:
        `${payload.summary} · ${payload.documentTitle} ${payload.documentVersion} · ` +
        `sha256:${payload.contentHash.slice(0, 16)} (${payload.contentHashScope}, ${document.byteLength} bytes)` +
        (payload.anchoringIsRetrospective ? ' · RETROSPECTIVE ATTESTATION' : ''),
    });
    receiptId = receipt?.id ?? null;
  } catch (e) {
    console.error('[governance ratification] receipt write failed — the record stands:', e);
  }

  if (receiptId) {
    const withReceipt = { ...payload, receiptId };
    await admin
      .from('governance_ratifications')
      .update({ receipt_id: receiptId, object: buildRatificationObject(withReceipt) })
      .eq('id', inserted.id);
  }

  const [observed] = await observeAnchorStatuses([{ ...rowToPayload(inserted), receiptId }]);
  return { ok: true, ratification: observed, alreadyRecorded: false };
}

// ---------------------------------------------------------------------------
// §6 Step 9/10 — publication attaches LATER, and never gates the act
// ---------------------------------------------------------------------------

export type AttachPublicationResult =
  | { ok: true; ratification: GovernanceRatification }
  | { ok: false; reason: string };

/**
 * Attach an Autodrive CID to an already-recorded ratification (ruling step 10).
 *
 * Deliberately a SEPARATE call from `recordRatification`. The ruling: "anchoring
 * should not silently depend on publication succeeding. The receipt can first
 * attest to the exact hash, then later attach the CID or anchoring evidence."
 * A ratification with `contentCid: null` is complete and valid.
 */
export async function attachPublication(
  decisionId: string,
  input: { contentCid: string; publishedAt?: string },
): Promise<AttachPublicationResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'governance ratification store unavailable' };
  const cid = input.contentCid?.trim();
  if (!cid) return { ok: false, reason: 'contentCid required' };

  const existing = await getRatification(decisionId);
  if (!existing) return { ok: false, reason: `no ratification record for "${decisionId}"` };

  const publishedAt = input.publishedAt ?? new Date().toISOString();
  const payload: RatificationPayload = { ...existing, contentCid: cid, publishedAt };

  const { error } = await admin
    .from('governance_ratifications')
    .update({ content_cid: cid, published_at: publishedAt, object: buildRatificationObject(payload) })
    .eq('decision_id', decisionId.trim());
  if (error) {
    softFail('attach-publication', error.message);
    return { ok: false, reason: error.message };
  }

  const [observed] = await observeAnchorStatuses([payload]);
  return { ok: true, ratification: observed };
}

// ---------------------------------------------------------------------------
// §7 The Governance Decision Log, as a PROJECTION over the record
// ---------------------------------------------------------------------------

/**
 * OPERATOR RULING: *"GOVERNANCE_DECISIONS should cease to be the event source.
 * It may remain temporarily as: a compatibility projection; seed data; a read
 * model; a generated index. But ratification should write to an observable
 * governance record, and the decision log should be derived from those
 * records."*
 *
 * A projected entry says WHERE its authority comes from:
 *
 *   'ratified'  — a persisted ratification record exists. The decision is true
 *                 because an authorised act happened and was receipted.
 *   'seed'      — the entry exists only in the hardcoded array. It is retained
 *                 for compatibility and is explicitly NOT evidence that a
 *                 ratification occurred: nobody performed an act, no receipt
 *                 exists, nothing is anchored. Listing it any other way would
 *                 reproduce the exact inference the ruling forbids
 *                 ("Developer edits hardcoded array → System assumes
 *                 ratification happened").
 */
export type DecisionProvenance = 'ratified' | 'seed';

export interface ProjectedGovernanceDecision extends GovernanceDecision {
  provenance: DecisionProvenance;
  /** Present only for `provenance: 'ratified'`. */
  ratification: GovernanceRatification | null;
}

function ratificationToDecision(r: GovernanceRatification): ProjectedGovernanceDecision {
  const status: DecisionStatus = r.act === 'amend' ? 'amended' : 'ratified';
  return {
    id: r.decisionId,
    title: `${r.documentTitle} ${r.documentVersion}`,
    domain: r.domain,
    status,
    date: r.ratifiedAt.slice(0, 10),
    initiative: r.frameworkId ?? 'Constitutional Framework',
    summary: r.summary,
    rationale: r.authorityBasis,
    amends: r.supersedes[0] ?? null,
    superseded_by: null,
    sovereigntyImpact: { me: 'neutral', c: 'neutral', z: 'neutral' },
    constitutionalBasis: r.authorityBasis,
    registryReady: r.anchorStatus === 'anchored',
    provenance: 'ratified',
    ratification: r,
  };
}

/**
 * The decision log, DERIVED. Persisted ratifications first; seed entries that no
 * act has yet covered follow, flagged as seed. The array is read here and
 * NOWHERE else in the application — `tests/governance-ratification.test.ts`
 * fails the build if a new module starts treating it as the event source again.
 */
export async function projectGovernanceDecisionLog(): Promise<ProjectedGovernanceDecision[]> {
  const records = await listRatifications();
  const projected = records.map(ratificationToDecision);
  const covered = new Set(projected.map((d) => d.id));

  const seeded: ProjectedGovernanceDecision[] = GOVERNANCE_DECISIONS.filter(
    (d) => !covered.has(d.id),
  ).map((d) => ({ ...d, provenance: 'seed', ratification: null }));

  return [...projected, ...seeded];
}

/**
 * Resolve one decision, record first. The ratification act uses this rather than
 * the seed's own `getDecision` so a decision that HAS been ratified is described
 * by its record, not by whatever the array happens to still say.
 */
export async function resolveDecision(
  decisionId: string,
): Promise<ProjectedGovernanceDecision | null> {
  const record = await getRatification(decisionId);
  if (record) return ratificationToDecision(record);
  const seed = GOVERNANCE_DECISIONS.find((d) => d.id === decisionId.trim());
  return seed ? { ...seed, provenance: 'seed', ratification: null } : null;
}
