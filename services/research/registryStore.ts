/**
 * registryStore — the Experiment / Constitutional / Invariant Registry CRUD
 * service (CFS-051, Strand 1 build 2026-07-24). Mirrors
 * services/constitutional/capabilityRegistry.ts's soft-fail, service-role-
 * only pattern: every list* soft-fails to `[]` when the migration hasn't
 * been applied yet (never throws, never blocks the dev loop), every
 * create/update reports `{ ok: false, reason }` honestly on failure.
 *
 * Four sibling stores (experiment / principle / invariant / backlog) share
 * one shape — status, dependsOn, reviewHistory, createdAt/updatedAt — per
 * kind-specific table. `addReviewNote` and `transitionStatus` are generic
 * over `RegistryKind` so the API route and the tab component each have ONE
 * call site per action, not four.
 *
 * T2 discipline: `addReviewNote` takes a raw personaId ONLY to derive the
 * T2-safe `reviewerRef` (personaPublicRef — the same Polity Public Reference
 * derivation the DVN pipeline uses) — the raw id is never stored.
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import type {
  RegistryKind,
  RegistryReviewEntry,
  CandidateExperiment,
  CandidateExperimentStatus,
  CandidatePrinciple,
  CandidatePrincipleStatus,
  CandidateInvariant,
  CandidateInvariantStatus,
  BacklogItem,
  BacklogStatus,
} from '@/types/researchRegistry';

const TABLE_BY_KIND: Record<RegistryKind, string> = {
  experiment: 'research_candidate_experiments',
  principle: 'research_candidate_principles',
  invariant: 'research_candidate_invariants',
  backlog: 'research_backlog_items',
};

function softFail(scope: string, message: string): void {
  if (/does not exist/i.test(message)) {
    console.warn(`[research registry] migration 20260820000000 not applied; ${scope} skipped`);
  } else {
    console.error(`[research registry] ${scope} failed:`, message);
  }
}

function slugify(input: string, prefix: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
  const hash = createHash('sha256').update(input + Date.now()).digest('hex').slice(0, 6);
  return `${prefix}-${base || 'item'}-${hash}`;
}

function toRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    slug: String(r.slug),
    dependsOn: Array.isArray(r.depends_on) ? (r.depends_on as string[]) : [],
    reviewHistory: Array.isArray(r.review_history) ? (r.review_history as RegistryReviewEntry[]) : [],
    sourceNote: (r.source_note as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ─── Candidate Experiments ───────────────────────────────────────────────

export interface CreateCandidateExperimentInput {
  slug?: string;
  title: string;
  family?: string;
  layer?: 'I' | 'II' | 'III';
  seriesId?: string;
  hypothesis: string;
  charterRef?: string;
  status?: CandidateExperimentStatus;
  governingInvariants?: string[];
  dependsOn?: string[];
  sourceNote?: string;
}

export async function listCandidateExperiments(): Promise<CandidateExperiment[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from(TABLE_BY_KIND.experiment)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list-experiments', error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      ...toRow(r),
      title: String(r.title),
      family: (r.family as string | null) ?? null,
      layer: (r.layer as 'I' | 'II' | 'III' | null) ?? null,
      seriesId: (r.series_id as string | null) ?? null,
      hypothesis: String(r.hypothesis),
      charterRef: (r.charter_ref as string | null) ?? null,
      status: String(r.status) as CandidateExperimentStatus,
      governingInvariants: Array.isArray(r.governing_invariants) ? (r.governing_invariants as string[]) : [],
    }));
  } catch (e) {
    softFail('list-experiments', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function createCandidateExperiment(
  input: CreateCandidateExperimentInput,
): Promise<{ ok: true; item: CandidateExperiment } | { ok: false; reason: string }> {
  if (!input.title?.trim()) return { ok: false, reason: 'title required' };
  if (!input.hypothesis?.trim()) return { ok: false, reason: 'hypothesis required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  try {
    const slug = input.slug?.trim() || slugify(input.title, 'cand-exp');
    const { data, error } = await admin
      .from(TABLE_BY_KIND.experiment)
      .insert({
        slug,
        title: input.title.trim(),
        family: input.family?.trim() || null,
        layer: input.layer ?? null,
        series_id: input.seriesId?.trim() || null,
        hypothesis: input.hypothesis.trim(),
        charter_ref: input.charterRef?.trim() || null,
        status: input.status ?? 'proposed',
        governing_invariants: input.governingInvariants ?? [],
        depends_on: input.dependsOn ?? [],
        source_note: input.sourceNote?.trim() || null,
      })
      .select('*')
      .single();
    if (error) {
      softFail('create-experiment', error.message);
      return { ok: false, reason: error.message.includes('does not exist') ? 'research_candidate_experiments table missing — apply migration 20260820000000' : error.message };
    }
    return {
      ok: true,
      item: {
        ...toRow(data),
        title: String(data.title),
        family: (data.family as string | null) ?? null,
        layer: (data.layer as 'I' | 'II' | 'III' | null) ?? null,
        seriesId: (data.series_id as string | null) ?? null,
        hypothesis: String(data.hypothesis),
        charterRef: (data.charter_ref as string | null) ?? null,
        status: String(data.status) as CandidateExperimentStatus,
        governingInvariants: Array.isArray(data.governing_invariants) ? (data.governing_invariants as string[]) : [],
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('create-experiment', msg);
    return { ok: false, reason: msg };
  }
}

// ─── Candidate Constitutional Principles ────────────────────────────────

export interface CreateCandidatePrincipleInput {
  slug?: string;
  statement: string;
  rationale?: string;
  status?: CandidatePrincipleStatus;
  dependsOn?: string[];
  charterRef?: string;
  sourceNote?: string;
}

export async function listCandidatePrinciples(): Promise<CandidatePrinciple[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from(TABLE_BY_KIND.principle)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list-principles', error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      ...toRow(r),
      statement: String(r.statement),
      rationale: (r.rationale as string | null) ?? null,
      status: String(r.status) as CandidatePrincipleStatus,
      charterRef: (r.charter_ref as string | null) ?? null,
    }));
  } catch (e) {
    softFail('list-principles', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function createCandidatePrinciple(
  input: CreateCandidatePrincipleInput,
): Promise<{ ok: true; item: CandidatePrinciple } | { ok: false; reason: string }> {
  if (!input.statement?.trim()) return { ok: false, reason: 'statement required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  try {
    const slug = input.slug?.trim() || slugify(input.statement, 'cand-principle');
    const { data, error } = await admin
      .from(TABLE_BY_KIND.principle)
      .insert({
        slug,
        statement: input.statement.trim(),
        rationale: input.rationale?.trim() || null,
        status: input.status ?? 'proposed',
        depends_on: input.dependsOn ?? [],
        charter_ref: input.charterRef?.trim() || null,
        source_note: input.sourceNote?.trim() || null,
      })
      .select('*')
      .single();
    if (error) {
      softFail('create-principle', error.message);
      return { ok: false, reason: error.message.includes('does not exist') ? 'research_candidate_principles table missing — apply migration 20260820000000' : error.message };
    }
    return {
      ok: true,
      item: {
        ...toRow(data),
        statement: String(data.statement),
        rationale: (data.rationale as string | null) ?? null,
        status: String(data.status) as CandidatePrincipleStatus,
        charterRef: (data.charter_ref as string | null) ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('create-principle', msg);
    return { ok: false, reason: msg };
  }
}

// ─── Candidate Structural Invariants ─────────────────────────────────────

export interface CreateCandidateInvariantInput {
  slug?: string;
  namespace?: string;
  statement: string;
  rationale?: string;
  status?: CandidateInvariantStatus;
  dependsOn?: string[];
  sourceNote?: string;
}

export async function listCandidateInvariants(): Promise<CandidateInvariant[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from(TABLE_BY_KIND.invariant)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list-invariants', error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      ...toRow(r),
      namespace: (r.namespace as string | null) ?? null,
      statement: String(r.statement),
      rationale: (r.rationale as string | null) ?? null,
      status: String(r.status) as CandidateInvariantStatus,
      promotedInvariantId: (r.promoted_invariant_id as string | null) ?? null,
    }));
  } catch (e) {
    softFail('list-invariants', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function createCandidateInvariant(
  input: CreateCandidateInvariantInput,
): Promise<{ ok: true; item: CandidateInvariant } | { ok: false; reason: string }> {
  if (!input.statement?.trim()) return { ok: false, reason: 'statement required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  try {
    const slug = input.slug?.trim() || slugify(input.statement, 'cand-inv');
    const { data, error } = await admin
      .from(TABLE_BY_KIND.invariant)
      .insert({
        slug,
        namespace: input.namespace?.trim() || null,
        statement: input.statement.trim(),
        rationale: input.rationale?.trim() || null,
        status: input.status ?? 'candidate',
        depends_on: input.dependsOn ?? [],
        source_note: input.sourceNote?.trim() || null,
      })
      .select('*')
      .single();
    if (error) {
      softFail('create-invariant', error.message);
      return { ok: false, reason: error.message.includes('does not exist') ? 'research_candidate_invariants table missing — apply migration 20260820000000' : error.message };
    }
    return {
      ok: true,
      item: {
        ...toRow(data),
        namespace: (data.namespace as string | null) ?? null,
        statement: String(data.statement),
        rationale: (data.rationale as string | null) ?? null,
        status: String(data.status) as CandidateInvariantStatus,
        promotedInvariantId: (data.promoted_invariant_id as string | null) ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('create-invariant', msg);
    return { ok: false, reason: msg };
  }
}

// ─── Research Backlog ─────────────────────────────────────────────────────

export interface CreateBacklogItemInput {
  slug?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: BacklogStatus;
  linkedExperimentIds?: string[];
  linkedHypothesisIds?: string[];
  sourceNote?: string;
}

export async function listBacklogItems(): Promise<BacklogItem[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from(TABLE_BY_KIND.backlog)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list-backlog', error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      ...toRow(r),
      title: String(r.title),
      description: (r.description as string | null) ?? null,
      priority: String(r.priority) as BacklogItem['priority'],
      status: String(r.status) as BacklogStatus,
      linkedExperimentIds: Array.isArray(r.linked_experiment_ids) ? (r.linked_experiment_ids as string[]) : [],
      linkedHypothesisIds: Array.isArray(r.linked_hypothesis_ids) ? (r.linked_hypothesis_ids as string[]) : [],
    }));
  } catch (e) {
    softFail('list-backlog', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function createBacklogItem(
  input: CreateBacklogItemInput,
): Promise<{ ok: true; item: BacklogItem } | { ok: false; reason: string }> {
  if (!input.title?.trim()) return { ok: false, reason: 'title required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  try {
    const slug = input.slug?.trim() || slugify(input.title, 'backlog');
    const { data, error } = await admin
      .from(TABLE_BY_KIND.backlog)
      .insert({
        slug,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority ?? 'medium',
        status: input.status ?? 'backlog',
        linked_experiment_ids: input.linkedExperimentIds ?? [],
        linked_hypothesis_ids: input.linkedHypothesisIds ?? [],
        source_note: input.sourceNote?.trim() || null,
      })
      .select('*')
      .single();
    if (error) {
      softFail('create-backlog', error.message);
      return { ok: false, reason: error.message.includes('does not exist') ? 'research_backlog_items table missing — apply migration 20260820000000' : error.message };
    }
    return {
      ok: true,
      item: {
        ...toRow(data),
        title: String(data.title),
        description: (data.description as string | null) ?? null,
        priority: String(data.priority) as BacklogItem['priority'],
        status: String(data.status) as BacklogStatus,
        linkedExperimentIds: Array.isArray(data.linked_experiment_ids) ? (data.linked_experiment_ids as string[]) : [],
        linkedHypothesisIds: Array.isArray(data.linked_hypothesis_ids) ? (data.linked_hypothesis_ids as string[]) : [],
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('create-backlog', msg);
    return { ok: false, reason: msg };
  }
}

// ─── Generic status transition + review notes (all four kinds) ─────────

const STATUS_COLUMN = 'status';

export async function transitionRegistryStatus(
  kind: RegistryKind,
  id: string,
  status: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  try {
    const { error } = await admin
      .from(TABLE_BY_KIND[kind])
      .update({ [STATUS_COLUMN]: status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      softFail(`transition-${kind}`, error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail(`transition-${kind}`, msg);
    return { ok: false, reason: msg };
  }
}

/**
 * Append a review-history entry. `personaId` is used ONLY to derive the
 * T2-safe `reviewerRef` (personaPublicRef) — never stored raw.
 */
export async function addRegistryReviewNote(
  kind: RegistryKind,
  id: string,
  personaId: string,
  input: { note: string; disposition: string },
): Promise<{ ok: true; entry: RegistryReviewEntry } | { ok: false; reason: string }> {
  if (!input.note?.trim()) return { ok: false, reason: 'note required' };
  if (!input.disposition?.trim()) return { ok: false, reason: 'disposition required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  try {
    const table = TABLE_BY_KIND[kind];
    const { data: row, error: readErr } = await admin.from(table).select('review_history').eq('id', id).maybeSingle();
    if (readErr) {
      softFail(`add-review-${kind}`, readErr.message);
      return { ok: false, reason: readErr.message };
    }
    if (!row) return { ok: false, reason: `${kind} "${id}" not found` };

    const entry: RegistryReviewEntry = {
      reviewerRef: personaPublicRef(personaId),
      date: new Date().toISOString(),
      note: input.note.trim().slice(0, 1000),
      disposition: input.disposition.trim().slice(0, 60),
    };
    const existing = Array.isArray(row.review_history) ? (row.review_history as RegistryReviewEntry[]) : [];
    const { error: updErr } = await admin
      .from(table)
      .update({ review_history: [...existing, entry], updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) {
      softFail(`add-review-${kind}`, updErr.message);
      return { ok: false, reason: updErr.message };
    }
    return { ok: true, entry };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail(`add-review-${kind}`, msg);
    return { ok: false, reason: msg };
  }
}

/** Editable-field patch, restricted per kind to a safe allowlist (never
 *  slug/id/created_at/review_history — those have their own dedicated
 *  paths). Used by the API route's 'edit' action. */
const EDITABLE_FIELDS: Record<RegistryKind, string[]> = {
  experiment: ['title', 'family', 'layer', 'series_id', 'hypothesis', 'charter_ref', 'governing_invariants', 'depends_on', 'source_note'],
  principle: ['statement', 'rationale', 'depends_on', 'charter_ref', 'source_note'],
  invariant: ['namespace', 'statement', 'rationale', 'depends_on', 'promoted_invariant_id', 'source_note'],
  backlog: ['title', 'description', 'priority', 'linked_experiment_ids', 'linked_hypothesis_ids', 'source_note'],
};

export async function editRegistryItem(
  kind: RegistryKind,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };
  const allowed = EDITABLE_FIELDS[kind];
  const safePatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.includes(key)) safePatch[key] = value;
  }
  if (Object.keys(safePatch).length === 0) return { ok: false, reason: 'no editable fields provided' };
  try {
    const { error } = await admin
      .from(TABLE_BY_KIND[kind])
      .update({ ...safePatch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      softFail(`edit-${kind}`, error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail(`edit-${kind}`, msg);
    return { ok: false, reason: msg };
  }
}
