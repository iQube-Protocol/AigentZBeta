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
  created_at: string;
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

/** List produced artifacts, newest first (optionally by delegate). */
export async function listArtifactRecords(opts: { delegate?: string; limit?: number } = {}): Promise<ArtifactRecordRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    let q = admin.from('artifact_records').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 50);
    if (opts.delegate) q = q.eq('delegate', opts.delegate);
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
