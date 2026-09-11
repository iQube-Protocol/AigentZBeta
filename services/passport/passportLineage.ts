/**
 * Passport consolidation / lineage — resolution, origin rule, reconciliation.
 *
 * PRD-PAG-001 Amendment A §A.5 (ratified 2026-07-27, operator:
 * "ratified - build"). The operator's model:
 *
 *   Provisional Passports (low-assurance, e.g. captcha)
 *           ↓ high-assurance uniqueness proof (World ID)
 *   Canonical Passport lineage established
 *           ↓
 *   predecessors retained for provenance; one active canonical Passport
 *
 * ── WHAT IS REUSED (charter: everything but three things) ──────────────────
 *
 *   - "Provisional" vs "canonical" IS the existing grade distinction on the
 *     graded ladder (`personhoodProof.ts`) — no new axis.
 *   - The consolidation transition IS the ratified
 *     `active → superseded_by_reissue` edge, evidence
 *     `reissue_continuity_binding`, one-way (`passportStatusMachine.ts`).
 *     This module looks that rule up; it invents no transition.
 *   - Consolidation declares itself under the `consolidation` consequence
 *     class of the canonical step-up policy (`stepUpPolicy.ts`, §A.6 level 3)
 *     and refuses to plan below the required grade — the two ratified
 *     increments compose.
 *
 * ── NET-NEW (the three chartered pieces) ───────────────────────────────────
 *
 *   1. LINEAGE RESOLUTION — which provisional Passports belong to ONE
 *      verified personhood. Keyed off the high-assurance uniqueness proof
 *      (the World ID nullifier persisted by the existing personhood
 *      substrate) and the canonical personhood key (the kybe). NEVER off a
 *      matching email or display name — the same spine rule that forbids
 *      email binding (ruling 3), canaried in tests/passport-lineage.test.ts.
 *   2. DETERMINISTIC ORIGIN — the earliest valid Passport in a lineage is
 *      canonical unless the citizen explicitly selects another.
 *   3. STANDING + DELEGATION RECONCILIATION — consolidation must not
 *      duplicate standing and must not resurrect revoked delegation.
 *
 * ── DISCIPLINE ─────────────────────────────────────────────────────────────
 *
 * Pattern mirror: `passportStatusMachine.ts` — this module RESOLVES and
 * DESCRIBES; it never executes. `planConsolidation` returns the transitions a
 * caller would perform (DB write, receipt, registry refresh); it performs
 * none of them. Every DB read fails closed with a named reason.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  citizenTransitionRule,
  type CitizenPassportStatus,
} from './passportStatusMachine';
import { requiredGradeFor, satisfies, type HolderProofGrade } from './stepUpPolicy';

// ── Lineage member shape ───────────────────────────────────────────────────
//
// Deliberately CONTAINS NO contact or presentation fields. A record's mailbox
// or label is not evidence of personhood; the resolver must be structurally
// unable to merge on them.

export interface LineagePassportRecord {
  id: string;
  passportClass: string;
  citizenStatus: string | null;
  participantStatus: string | null;
  /** Canonical personhood key — the kybe the record hangs off. */
  kybeIdentityId: string | null;
  /** The high-assurance uniqueness proof (World ID), when verified. */
  worldIdNullifierHash: string | null;
  worldIdVerifiedAt: string | null;
  revoked: boolean;
  expiresAt: string | null;
  issuedAt: string | null;
  createdAt: string;
}

export interface PassportLineage {
  /** Every record resolved to this one personhood, oldest first. */
  members: LineagePassportRecord[];
}

// ── 1. Lineage resolution (pure core) ──────────────────────────────────────

/**
 * Group passport records into lineages by personhood evidence ONLY:
 * records sharing a World ID nullifier or a kybe belong to one personhood
 * (union across both keys). A record carrying NEITHER key is a singleton —
 * there is no evidence to merge it on, so it is never merged.
 *
 * THE RULE THIS ENCODES (charter-mandated, canaried): two records sharing an
 * email address or a display name but carrying different personhood proofs
 * are DIFFERENT lineages. This function never reads a contact or
 * presentation field; the member type does not even carry one.
 */
export function groupIntoLineages(records: LineagePassportRecord[]): PassportLineage[] {
  // Union-find over personhood keys. Each record contributes up to two keys
  // (nullifier, kybe); records sharing any key collapse into one lineage.
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (p === undefined || p === k) {
      parent.set(k, k);
      return k;
    }
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  const keysOf = (r: LineagePassportRecord): string[] => {
    const keys: string[] = [];
    if (r.worldIdNullifierHash) keys.push(`nullifier:${r.worldIdNullifierHash}`);
    if (r.kybeIdentityId) keys.push(`kybe:${r.kybeIdentityId}`);
    if (keys.length === 0) keys.push(`record:${r.id}`); // singleton — no evidence, no merge
    return keys;
  };

  for (const r of records) {
    const keys = keysOf(r);
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
  }

  const byRoot = new Map<string, LineagePassportRecord[]>();
  for (const r of records) {
    const root = find(keysOf(r)[0]);
    const bucket = byRoot.get(root) ?? [];
    bucket.push(r);
    byRoot.set(root, bucket);
  }

  return [...byRoot.values()].map((members) => ({
    members: [...members].sort(compareByAge),
  }));
}

/** Oldest first; issuance beats creation when present; id breaks ties so the
 *  order is total and the origin rule is deterministic. */
function compareByAge(a: LineagePassportRecord, b: LineagePassportRecord): number {
  const ta = Date.parse(a.issuedAt ?? a.createdAt);
  const tb = Date.parse(b.issuedAt ?? b.createdAt);
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── 2. Deterministic origin rule ───────────────────────────────────────────

/**
 * A member that can carry the canonical lineage. Deliberately strict, the
 * same posture as `isPassportUsable`: an unrecognised state is NOT valid.
 * Consolidation is a citizen personhood operation (Addendum D), so only
 * citizen-class records qualify as origin candidates.
 */
export function isOriginCandidate(r: LineagePassportRecord): boolean {
  if (r.passportClass !== 'citizen') return false;
  if (r.revoked) return false;
  if (r.expiresAt && Date.parse(r.expiresAt) < Date.now()) return false;
  return r.citizenStatus === 'active';
}

/**
 * The deterministic origin rule (§A.5): the EARLIEST valid Passport in the
 * lineage is canonical — unless the citizen explicitly selects another valid
 * member. An explicit selection that names an invalid or absent member is an
 * error, not a silent fallback: the citizen's stated choice must never be
 * quietly substituted.
 */
export function canonicalOriginOf(
  lineage: PassportLineage,
  explicitSelectionId?: string,
):
  | { ok: true; canonical: LineagePassportRecord }
  | { ok: false; reason: 'no_valid_member' | 'invalid_selection' } {
  const candidates = lineage.members.filter(isOriginCandidate).sort(compareByAge);
  if (explicitSelectionId !== undefined) {
    const selected = candidates.find((r) => r.id === explicitSelectionId);
    if (!selected) return { ok: false, reason: 'invalid_selection' };
    return { ok: true, canonical: selected };
  }
  if (candidates.length === 0) return { ok: false, reason: 'no_valid_member' };
  return { ok: true, canonical: candidates[0] };
}

// ── 3. Standing + delegation reconciliation ────────────────────────────────

/** Severity order for the privilege-standing enum (migration 20260610,
 *  passport_citizen_privileges.privilege_status). Reconciliation keeps the
 *  MOST restrictive predecessor standing — consolidating can never launder a
 *  restriction away. */
const PRIVILEGE_SEVERITY: Readonly<Record<string, number>> = {
  full_privileges: 0,
  probationary: 1,
  under_review: 2,
  restricted: 3,
  suspended: 4,
  minimal_privileges: 5,
};

export interface LineageStanding {
  passportRecordId: string;
  privilegeStatus: string;
  /** Restriction identifiers as persisted in active_restrictions. */
  activeRestrictions: string[];
}

/**
 * A predecessor delegation, normalised by the caller from whichever store
 * holds it (Constitutional Agreements, agent grants). `state` is the
 * predecessor's OWN view: 'granted' when live on that predecessor, 'revoked'
 * when that predecessor revoked it.
 */
export interface LineageDelegation {
  agreementRef: string;
  capabilityRef: string;
  agentRef: string;
  state: 'granted' | 'revoked';
}

export interface ReconciledLineageState {
  /**
   * ONE post-consolidation standing object (or null when no predecessor
   * carried one). Standing is never duplicated: one privilege status (the
   * most restrictive found), restrictions deduplicated — never summed,
   * never repeated per predecessor.
   */
  standing: { privilegeStatus: string; activeRestrictions: string[] } | null;
  /**
   * ONE entry per (capability, agent) pair. A revocation ANYWHERE in the
   * lineage dominates: consolidation must never resurrect a delegation a
   * predecessor revoked, even when another predecessor still holds a live
   * grant for the same pair.
   */
  delegations: Array<{
    capabilityRef: string;
    agentRef: string;
    state: 'granted' | 'revoked';
    /** The refs that fed this entry, for the caller's audit trail. */
    sourceAgreementRefs: string[];
  }>;
}

export function reconcileLineage(
  standings: LineageStanding[],
  delegations: LineageDelegation[],
): ReconciledLineageState {
  // Standing: one object, most restrictive status, deduped restrictions.
  let standing: ReconciledLineageState['standing'] = null;
  if (standings.length > 0) {
    let worst = standings[0].privilegeStatus;
    const restrictions = new Set<string>();
    for (const s of standings) {
      if ((PRIVILEGE_SEVERITY[s.privilegeStatus] ?? 0) > (PRIVILEGE_SEVERITY[worst] ?? 0)) {
        worst = s.privilegeStatus;
      }
      for (const r of s.activeRestrictions) restrictions.add(r);
    }
    standing = { privilegeStatus: worst, activeRestrictions: [...restrictions].sort() };
  }

  // Delegation: keyed by (capability, agent); revocation dominates, forever.
  const byPair = new Map<
    string,
    { capabilityRef: string; agentRef: string; state: 'granted' | 'revoked'; sourceAgreementRefs: string[] }
  >();
  for (const d of delegations) {
    const key = `${d.capabilityRef} ${d.agentRef}`;
    const entry = byPair.get(key) ?? {
      capabilityRef: d.capabilityRef,
      agentRef: d.agentRef,
      state: 'granted' as const,
      sourceAgreementRefs: [],
    };
    if (!entry.sourceAgreementRefs.includes(d.agreementRef)) {
      entry.sourceAgreementRefs.push(d.agreementRef);
    }
    if (d.state === 'revoked') entry.state = 'revoked'; // one-way — never flips back
    byPair.set(key, entry);
  }

  return { standing, delegations: [...byPair.values()] };
}

// ── DB-facing lineage resolver ─────────────────────────────────────────────

export type LineageResolutionFailure =
  | 'anchor_not_found'
  | 'anchor_not_verified' // the anchor lacks the high-assurance uniqueness proof
  | 'attestation_mismatch' // an attested member's proven nullifier is not the anchor's
  | 'unavailable';

export interface ResolvedLineage {
  lineage: PassportLineage;
  /** The anchor's uniqueness proof — the key the lineage was resolved under. */
  anchorNullifierHash: string;
}

export type LineageResolution =
  | { ok: true; resolved: ResolvedLineage }
  | { ok: false; reason: LineageResolutionFailure };

interface PassportRow {
  id: string;
  passport_class: string;
  citizen_status: string | null;
  participant_status: string | null;
  kybe_identity_id: string | null;
  world_id_nullifier_hash: string | null;
  world_id_verified_at: string | null;
  revoked: boolean;
  expires_at: string | null;
  issued_at: string | null;
  created_at: string;
}

const RECORD_COLUMNS =
  'id, passport_class, citizen_status, participant_status, kybe_identity_id, world_id_nullifier_hash, world_id_verified_at, revoked, expires_at, issued_at, created_at';

function rowToMember(row: PassportRow): LineagePassportRecord {
  return {
    id: String(row.id),
    passportClass: String(row.passport_class),
    citizenStatus: row.citizen_status ?? null,
    participantStatus: row.participant_status ?? null,
    kybeIdentityId: row.kybe_identity_id ?? null,
    worldIdNullifierHash: row.world_id_nullifier_hash ?? null,
    worldIdVerifiedAt: row.world_id_verified_at ?? null,
    revoked: Boolean(row.revoked),
    expiresAt: row.expires_at ?? null,
    issuedAt: row.issued_at ?? null,
    createdAt: String(row.created_at),
  };
}

/**
 * Resolve the lineage of one VERIFIED personhood.
 *
 * The anchor must carry the high-assurance uniqueness proof — the persisted
 * World ID nullifier (`world_id_nullifier_hash`, stamped by the existing
 * `/api/polity-passport/verify-worldid` substrate). A lineage cannot be
 * established from a provisional record: without the uniqueness proof there
 * is no evidence the provisional passports belong to one human.
 *
 * Membership evidence, in order:
 *   1. records under the anchor's kybe (the canonical personhood chain), and
 *   2. explicitly ATTESTED members — records on OTHER kybes whose holder has
 *      re-produced the SAME World ID nullifier through the personhood
 *      substrate (the unique index on the nullifier means the proof cannot be
 *      persisted twice; the caller passes the freshly proven nullifier). An
 *      attestation whose nullifier differs from the anchor's is a hard
 *      failure, never a silent skip — a wrong attestation is evidence of
 *      confusion or attack, not noise.
 *
 * NEVER by email. NEVER by display name. No query in this function touches a
 * contact or presentation column.
 */
export async function resolveVerifiedLineage(input: {
  anchorPassportRecordId: string;
  /** Cross-kybe members whose holder re-proved the anchor's nullifier. */
  attestedMembers?: Array<{ passportRecordId: string; provenNullifierHash: string }>;
}): Promise<LineageResolution> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const { data: anchorRow, error: anchorErr } = await supabase
    .from('polity_passport_records')
    .select(RECORD_COLUMNS)
    .eq('id', input.anchorPassportRecordId)
    .maybeSingle();
  if (anchorErr) return { ok: false, reason: 'unavailable' };
  if (!anchorRow) return { ok: false, reason: 'anchor_not_found' };

  const anchor = rowToMember(anchorRow as unknown as PassportRow);
  if (!anchor.worldIdNullifierHash || !anchor.worldIdVerifiedAt) {
    return { ok: false, reason: 'anchor_not_verified' };
  }

  const members = new Map<string, LineagePassportRecord>([[anchor.id, anchor]]);

  // 1. The canonical personhood chain: every record under the anchor's kybe.
  if (anchor.kybeIdentityId) {
    const { data: kybeRows, error: kybeErr } = await supabase
      .from('polity_passport_records')
      .select(RECORD_COLUMNS)
      .eq('kybe_identity_id', anchor.kybeIdentityId);
    if (kybeErr) return { ok: false, reason: 'unavailable' };
    for (const row of (kybeRows ?? []) as unknown as PassportRow[]) {
      const member = rowToMember(row);
      members.set(member.id, member);
    }
  }

  // 2. Attested cross-kybe members — same nullifier or hard refusal.
  for (const attested of input.attestedMembers ?? []) {
    if (attested.provenNullifierHash !== anchor.worldIdNullifierHash) {
      return { ok: false, reason: 'attestation_mismatch' };
    }
    const { data: row, error: err } = await supabase
      .from('polity_passport_records')
      .select(RECORD_COLUMNS)
      .eq('id', attested.passportRecordId)
      .maybeSingle();
    if (err) return { ok: false, reason: 'unavailable' };
    if (!row) return { ok: false, reason: 'attestation_mismatch' };
    const member = rowToMember(row as unknown as PassportRow);
    members.set(member.id, member);
  }

  return {
    ok: true,
    resolved: {
      lineage: { members: [...members.values()].sort(compareByAge) },
      anchorNullifierHash: anchor.worldIdNullifierHash,
    },
  };
}

// ── Consolidation plan (describes; never executes) ─────────────────────────

export interface ConsolidationStep {
  passportRecordId: string;
  from: CitizenPassportStatus;
  to: CitizenPassportStatus;
  /** From the ratified machine rule — always 'reissue_continuity_binding'. */
  evidence: string;
  /** The receipt the EXECUTOR must anchor, from the same rule. */
  receipt: string;
}

export interface SkippedMember {
  passportRecordId: string;
  reason: 'not_citizen_class' | 'no_ratified_transition';
}

export type ConsolidationPlan =
  | {
      ok: true;
      canonicalPassportRecordId: string;
      /** `active → superseded_by_reissue` per predecessor, machine-ratified. */
      steps: ConsolidationStep[];
      /** Members honestly left alone, with the reason. Never silent. */
      skipped: SkippedMember[];
    }
  | {
      ok: false;
      reason: 'step_up_required' | 'no_valid_member' | 'invalid_selection' | 'transition_not_ratified';
      requiredGrade?: HolderProofGrade;
    };

/**
 * Plan a consolidation: the canonical origin keeps flying; every other ACTIVE
 * citizen predecessor is superseded through the EXISTING ratified transition
 * (`active → superseded_by_reissue`, evidence `reissue_continuity_binding`,
 * one-way). Predecessors are retained for provenance — superseded, never
 * deleted.
 *
 * STEP-UP GATED (the increments compose): consolidation is the
 * `consolidation` consequence class of the canonical step-up policy. The
 * caller states the grade of holder proof actually presented in this
 * interaction; below the required grade the plan REFUSES. Passing a grade
 * the holder did not prove is the caller's breach, not this module's — the
 * same trust contract as `issuePassportSession`.
 */
export function planConsolidation(input: {
  lineage: PassportLineage;
  presentedProofGrade: HolderProofGrade;
  /** The citizen's explicit canonical choice, when they made one (§A.5). */
  explicitSelectionId?: string;
}): ConsolidationPlan {
  const requiredGrade = requiredGradeFor('consolidation');
  if (!satisfies(input.presentedProofGrade, requiredGrade)) {
    return { ok: false, reason: 'step_up_required', requiredGrade };
  }

  const origin = canonicalOriginOf(input.lineage, input.explicitSelectionId);
  if (!origin.ok) return { ok: false, reason: origin.reason };

  // The one ratified consolidation edge — looked up, never invented.
  const rule = citizenTransitionRule('active', 'superseded_by_reissue');
  if (!rule || rule.evidence !== 'reissue_continuity_binding' || rule.reversibility !== 'one_way') {
    return { ok: false, reason: 'transition_not_ratified' };
  }

  const steps: ConsolidationStep[] = [];
  const skipped: SkippedMember[] = [];
  for (const member of input.lineage.members) {
    if (member.id === origin.canonical.id) continue;
    if (member.passportClass !== 'citizen') {
      skipped.push({ passportRecordId: member.id, reason: 'not_citizen_class' });
      continue;
    }
    if (member.citizenStatus !== 'active') {
      // The machine ratifies superseded_by_reissue from 'active' only. A
      // draft or dormant predecessor has no ratified consolidation edge —
      // report it, do not force it.
      skipped.push({ passportRecordId: member.id, reason: 'no_ratified_transition' });
      continue;
    }
    steps.push({
      passportRecordId: member.id,
      from: 'active',
      to: 'superseded_by_reissue',
      evidence: rule.evidence,
      receipt: rule.receipt,
    });
  }

  return { ok: true, canonicalPassportRecordId: origin.canonical.id, steps, skipped };
}
