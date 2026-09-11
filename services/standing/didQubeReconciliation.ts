/**
 * DiDQube Phase 4 item 5 (2026-09-07, execution plan) — Standing/reputation's
 * REQUIRED first step: a dry-run, READ-ONLY reconciliation report, before any
 * write. "The highest-care item in this phase: must preserve existing
 * attribution exactly (supersession preserves history, never rewrites past
 * attribution). Build and run a dry-run reconciliation report before writing
 * anything, and get explicit operator sign-off on any row where the report
 * shows a discrepancy."
 *
 * This module performs NO writes. It answers exactly one question for every
 * canonical agent Standing identity (`personas` rows carrying
 * `app_origin = CANONICAL_AGENT_STANDING_APP_ORIGIN`,
 * services/standing/agentStandingPersona.ts): does this identity's underlying
 * agent_root_identity anchor cleanly resolve through the canonical
 * `resolveDiDQube`, or is there a discrepancy (no anchor row at all, no
 * DiDQube container bound yet, or a conflicted/ambiguous resolution)?
 *
 * The walk: personas.root_did (a raw did_uri string, the existing
 * self-referential match key this file already documents as safe — Phase 2.5
 * review) -> agent_root_identity.did_uri = personas.root_did -> resolveDiDQube
 * ({kind:'agent_root_identity_id', ...}). This NEVER changes
 * resolveCanonicalAgentPersonaId's own lookup/provisioning logic — that write
 * path is untouched by this file, exactly as the plan's caution requires.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveDiDQube } from '@/services/identity/didQubeResolver';
import { CANONICAL_AGENT_STANDING_APP_ORIGIN } from './agentStandingPersona';

export type StandingDiDQubeDiscrepancyReason =
  | 'no_root_did'
  | 'agent_root_identity_not_found'
  | 'agent_root_identity_ambiguous'
  | 'didqube_unresolved'
  | 'didqube_conflicted'
  | 'didqube_ambiguous'
  | 'read_failed';

export interface StandingDiDQubeReconciliationRow {
  personaId: string;
  displayName: string | null;
  rootDid: string | null;
  /** true only when resolveDiDQube reached state='resolved' for this row's anchor. */
  resolved: boolean;
  didqubeId: string | null;
  /** Present only when `resolved` is false — the reconciliation report's own finding, never a guess. */
  discrepancyReason: StandingDiDQubeDiscrepancyReason | null;
  detail: string;
}

export interface StandingDiDQubeReconciliationReport {
  totalCanonicalStandingPersonas: number;
  resolvedCount: number;
  discrepancyCount: number;
  rows: StandingDiDQubeReconciliationRow[];
}

/**
 * Read-only. Never throws for an individual row's own resolution failure —
 * that failure IS the report's finding, not an exception to propagate. A
 * failure to read the `personas` table itself (the enumeration step) is the
 * one case this surfaces as a thrown error, since without it there is no
 * report to return at all.
 */
export async function reconcileStandingDiDQubeResolution(
  admin: SupabaseClient,
): Promise<StandingDiDQubeReconciliationReport> {
  const { data, error } = await admin
    .from('personas')
    .select('id, display_name, root_did')
    .eq('app_origin', CANONICAL_AGENT_STANDING_APP_ORIGIN)
    .is('auth_profile_id', null);
  if (error) throw new Error(`reconcileStandingDiDQubeResolution: personas read failed: ${error.message}`);

  const rows: StandingDiDQubeReconciliationRow[] = [];
  for (const p of (data ?? []) as Array<{ id: string; display_name: string | null; root_did: string | null }>) {
    rows.push(await reconcileOneStandingPersona(admin, p));
  }

  const resolvedCount = rows.filter((r) => r.resolved).length;
  return {
    totalCanonicalStandingPersonas: rows.length,
    resolvedCount,
    discrepancyCount: rows.length - resolvedCount,
    rows,
  };
}

async function reconcileOneStandingPersona(
  admin: SupabaseClient,
  p: { id: string; display_name: string | null; root_did: string | null },
): Promise<StandingDiDQubeReconciliationRow> {
  const base = { personaId: p.id, displayName: p.display_name, rootDid: p.root_did };

  if (!p.root_did) {
    return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'no_root_did', detail: 'personas row carries no root_did to resolve against.' };
  }

  let rootIdentityRows: Array<{ id: string }>;
  try {
    const { data, error } = await admin.from('agent_root_identity').select('id').eq('did_uri', p.root_did).limit(2);
    if (error) return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'read_failed', detail: `agent_root_identity read failed: ${error.message}` };
    rootIdentityRows = (data ?? []) as Array<{ id: string }>;
  } catch (e) {
    return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'read_failed', detail: `agent_root_identity read threw: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (rootIdentityRows.length === 0) {
    return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'agent_root_identity_not_found', detail: `no agent_root_identity row with did_uri='${p.root_did}'.` };
  }
  if (rootIdentityRows.length > 1) {
    return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'agent_root_identity_ambiguous', detail: `${rootIdentityRows.length} agent_root_identity rows share did_uri='${p.root_did}'.` };
  }

  const resolution = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId: rootIdentityRows[0].id });
  if (resolution.state === 'resolved') {
    return { ...base, resolved: true, didqubeId: resolution.primitive.didqubeId, discrepancyReason: null, detail: `resolved via DiDQube ${resolution.primitive.didqubeId}.` };
  }
  if (resolution.state === 'conflicted') {
    return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'didqube_conflicted', detail: resolution.detail };
  }
  if (resolution.state === 'ambiguous') {
    return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'didqube_ambiguous', detail: `${resolution.candidateCount} ambiguous DiDQube candidates.` };
  }
  // 'unresolved' | 'unsupported_subject_class'
  return { ...base, resolved: false, didqubeId: null, discrepancyReason: 'didqube_unresolved', detail: resolution.state === 'unresolved' ? `resolver reason: ${resolution.reason}` : 'unsupported subject class.' };
}
