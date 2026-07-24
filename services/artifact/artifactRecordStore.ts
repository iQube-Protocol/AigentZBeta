/**
 * artifactRecordStore — the durable home for produced artifacts (CFS-025 AR /
 * CFS-023 Phase 4 follow-on). Operational + constitutional productions persist
 * here so they survive a refresh and carry a stable record id; DISPOSABLE
 * productions are NEVER persisted (their definition).
 *
 * Best-effort + soft-fail (the delegationGrantStore pattern): if the
 * 20260712000000 migration is not applied, every call no-ops and the produce
 * flow keeps working response-only. T2 discipline: no T0 id is stored; the
 * verification pair is content_hash + receipt_id.
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const MISSING = 'artifact_records';

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[artifact records] migration 20260712000000 not applied; ${scope} skipped`);
  } else {
    console.error(`[artifact records] ${scope} failed:`, message);
  }
}

export interface SaveArtifactRecordInput {
  artifactId: string;
  profile: string;
  consequenceClass: 'operational' | 'constitutional';
  delegate: string;
  title: string;
  brief: string;
  body: string;
  receiptId: string | null;
  sovereignty: unknown;
  /** CVR-003 — the canonical invariant ids that grounded this production
   *  (`groundingOf(result).invariantIds` from runArtifact, or the composition's
   *  `grounded.invariantIds`). T2-safe public knowledge-object ids. Requires
   *  migration 20260714000000 (cited_invariant_ids column); omitted → not sent. */
  citedInvariantIds?: string[];
  /** SPEC-MMC-002 §6.2 — T2-safe one-way commitment of the producing persona
   *  (`actorCommitmentFor(personaId)` below). NEVER the personaId itself.
   *  Requires migration 20260819000000; omitted → not sent, and the row's
   *  `actor_commitment` stays NULL (unattributed, same as every pre-Phase-2
   *  row — never guessed or backfilled). */
  actorCommitment?: string;
  /** SPEC-MMC-002 §3 taxonomy label (application/agent/capability/cartridge/
   *  tool/workflow/code_project). Requires migration 20260819000000;
   *  omitted → not sent. */
  artefactType?: string;
  /** Where the artifact runs, when known. Requires migration 20260819000000;
   *  omitted → not sent. */
  runtimeHost?: string;
  /** Per-artefact ACL/visibility model. Requires migration 20260819000000;
   *  omitted → not sent. */
  permissions?: unknown;
}

export interface ArtifactRecordRow {
  id: string;
  artifact_id: string;
  profile: string;
  consequence_class: string;
  delegate: string;
  title: string;
  brief: string;
  body: string;
  content_hash: string;
  receipt_id: string | null;
  sovereignty: unknown;
  /** CVR-003 (migration 20260714000000). jsonb array of invariant ids; absent
   *  on rows written before the column landed. */
  cited_invariant_ids?: unknown;
  /** SPEC-MMC-002 §6.2 (migration 20260819000000). T2-safe one-way persona
   *  commitment; NULL on rows written before this migration OR before a
   *  caller started supplying it (soft-fail-forward, same as every other
   *  additive column here). NEVER the personaId — never send this to the
   *  browser (see the `mine` route's projection, which omits it entirely). */
  actor_commitment?: string | null;
  /** SPEC-MMC-002 §3 taxonomy (migration 20260819000000). Nullable. */
  artefact_type?: string | null;
  /** SPEC-MMC-002 §3 "Runtime or host" (migration 20260819000000). Nullable. */
  runtime_host?: string | null;
  /** SPEC-MMC-002 §3 "Permissions" (migration 20260819000000). Nullable. */
  permissions?: unknown;
  created_at: string;
}

/**
 * Server-computed, one-way, T2-safe commitment to the acting persona — the
 * ONLY subject handle `artifact_records.actor_commitment` (or any produce-*
 * route) ever expresses. Same derivation every produce-* route already
 * applies locally (produce-software, produce-research, composition/publish,
 * homecoming/agent/produce all hand-copy this identical one-liner today —
 * a pre-existing duplication this pass does not fully remediate). Factored
 * here so the mySoftware `mine` read route (SPEC-MMC-002 §6.2) can share the
 * identical formula rather than hand-copying it a fifth time (CLAUDE.md
 * "Extend, Don't Duplicate" / source-of-truth parity) — a full dedup pass
 * across all five call sites is a reasonable follow-up, not attempted here.
 */
export function actorCommitmentFor(personaId: string): string {
  return createHash('sha256').update(`artifact:actor:${personaId}`).digest('hex').slice(0, 16);
}

/** Persist a produced (non-disposable) artifact. Returns the record id or null (soft-fail). */
export async function saveArtifactRecord(input: SaveArtifactRecordInput): Promise<string | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('artifact_records')
      .insert({
        artifact_id: input.artifactId,
        profile: input.profile,
        consequence_class: input.consequenceClass,
        delegate: input.delegate,
        title: input.title.slice(0, 300),
        brief: input.brief,
        body: input.body,
        content_hash: createHash('sha256').update(input.body).digest('hex'),
        receipt_id: input.receiptId,
        sovereignty: input.sovereignty,
        // Sent only when supplied AND non-empty: on a DB that predates the
        // 20260714000000 migration, grounded saves soft-fail (logged) while
        // every un-grounded save keeps working unchanged.
        ...(input.citedInvariantIds && input.citedInvariantIds.length > 0
          ? { cited_invariant_ids: input.citedInvariantIds }
          : {}),
        // SPEC-MMC-002 §6.2: sent only when supplied — on a DB that predates
        // 20260819000000, an attributed save soft-fails (logged) while every
        // caller that doesn't pass these keeps working unchanged.
        ...(input.actorCommitment ? { actor_commitment: input.actorCommitment } : {}),
        ...(input.artefactType ? { artefact_type: input.artefactType } : {}),
        ...(input.runtimeHost ? { runtime_host: input.runtimeHost } : {}),
        ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
      })
      .select('id')
      .single();
    if (error) {
      softFail('save', error.message);
      return null;
    }
    return String(data.id);
  } catch (e) {
    softFail('save', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Read one record by id, or null. */
export async function readArtifactRecord(id: string): Promise<ArtifactRecordRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin.from('artifact_records').select('*').eq('id', id).maybeSingle();
    if (error) {
      softFail('read', error.message);
      return null;
    }
    return (data as ArtifactRecordRow) ?? null;
  } catch (e) {
    softFail('read', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Promote a persisted record operational → constitutional (CFS-025 maturation:
 * up one tier, never down — the caller enforces canPromote + writes the
 * anchored receipt first and passes its id here). Returns the updated row or null.
 */
export async function promoteArtifactRecord(id: string, receiptId: string): Promise<ArtifactRecordRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('artifact_records')
      .update({ consequence_class: 'constitutional', receipt_id: receiptId })
      .eq('id', id)
      .eq('consequence_class', 'operational') // promotion only ever moves UP from operational
      .select('*')
      .maybeSingle();
    if (error) {
      softFail('promote', error.message);
      return null;
    }
    return (data as ArtifactRecordRow) ?? null;
  } catch (e) {
    softFail('promote', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** List produced artifacts, newest first (optionally by delegate and/or
 *  actorCommitment — SPEC-MMC-002 §6.2's per-persona "mine" filter). Both
 *  filters are additive/AND'd; `delegate`'s existing behavior is unchanged. */
export async function listArtifactRecords(
  opts: { delegate?: string; actorCommitment?: string; limit?: number } = {},
): Promise<ArtifactRecordRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    let q = admin.from('artifact_records').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 50);
    if (opts.delegate) q = q.eq('delegate', opts.delegate);
    if (opts.actorCommitment) q = q.eq('actor_commitment', opts.actorCommitment);
    const { data, error } = await q;
    if (error) {
      softFail('list', error.message);
      return [];
    }
    return (data ?? []) as ArtifactRecordRow[];
  } catch (e) {
    softFail('list', e instanceof Error ? e.message : String(e));
    return [];
  }
}
