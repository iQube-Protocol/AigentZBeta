/**
 * capabilityEvidence — Capability Evidence as a CONSTITUTIONAL PRIMITIVE
 * (operator direction 2026-07-13, CFS-029): what began as `SessionFindings`
 * (a transport object from the dev-loop session into pack generation) is
 * re-homed here as first-class, PERSISTED evidence about the platform's
 * capability surface.
 *
 * The semantic shift: **evidence persists; sessions don't.** A dev-loop
 * session that inventoried what exists vs what's needed produces evidence
 * that outlives it — the next pack generation for the same goal reads the
 * persisted evidence even when no session is alive. A capability pipeline
 * must never "forget" constitutional state between stages.
 *
 * This is a LEAF module (no imports from the pack generator or the decision
 * stage — both import from here), holding:
 *   - the nine-mechanism vocabulary (moved from implementationPack; re-exported
 *     there for compatibility)
 *   - the CapabilityEvidence shape (+ the legacy SessionFindings alias)
 *   - the pure folding helpers (prompt block + deterministic areas seed)
 *   - the durable store (best-effort + soft-fail, the artifactRecordStore
 *     pattern; keyed by a one-way goal hash — T2-safe, no subject identifiers)
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { ConstitutionalObject } from '@/types/constitutionalObject';
import { standingBandFor } from '@/types/constitutionalObject';

// ---------------------------------------------------------------------------
// The mechanism vocabulary (CFS-015: code is one mechanism among nine)
// ---------------------------------------------------------------------------

export const IMPLEMENTATION_MECHANISMS = [
  'code',
  'configuration',
  'registry',
  'prompt',
  'policy',
  'schema',
  'knowledge',
  'automation',
  'documentation',
] as const;

export type ImplementationMechanism = (typeof IMPLEMENTATION_MECHANISMS)[number];

// ---------------------------------------------------------------------------
// The evidence primitive
// ---------------------------------------------------------------------------

/**
 * What the pipeline knows about the platform's capability surface for a goal:
 * the Context Pack's reuse signals + the Gap Analysis's existing/missing +
 * the Consequence Canvas's hard boundaries. Nothing here is ever invented by
 * a consumer — it only folds in what a stage actually recorded.
 */
export interface CapabilityEvidence {
  /** Capabilities to COMPOSE, never re-implement (gap analysis EXISTING). */
  existing?: { name: string; path?: string; disposition?: string }[];
  /** The genuinely new work (gap analysis MISSING). */
  missing?: { name: string; path?: string; complexity?: string; dependencies?: string[] }[];
  /** Context Pack items with their reuse signals. */
  contextAssets?: { title: string; path?: string; signal?: string }[];
  /** Gap analysis reuse ratio, as a percentage. */
  reusePercent?: number;
  /** Consequence Canvas should-never-happen entries — hard boundaries. */
  boundaries?: string[];
}

/** Legacy name (transport-object era) — same shape, kept so existing callers
 *  and canaries compile unchanged. */
export type SessionFindings = CapabilityEvidence;

// ---------------------------------------------------------------------------
// Pure folding helpers (canary-pinned in tests/implementation-pack-findings)
// ---------------------------------------------------------------------------

/** Fold the evidence into prompt lines. Pure; empty evidence → []. */
export function capabilityEvidenceBlock(evidence: CapabilityEvidence | undefined): string[] {
  if (!evidence) return [];
  const lines: string[] = [];
  const existing = evidence.existing ?? [];
  const missing = evidence.missing ?? [];
  const assets = evidence.contextAssets ?? [];
  const boundaries = evidence.boundaries ?? [];
  if (existing.length || missing.length || assets.length) {
    lines.push(
      `The pipeline holds CAPABILITY EVIDENCE for this goal${
        typeof evidence.reusePercent === 'number' ? ` (${evidence.reusePercent}% reuse)` : ''
      } — the plan MUST build on this inventory and never duplicate an existing capability:`,
    );
  }
  if (existing.length) {
    lines.push(
      'EXISTING capabilities (compose these — re-implementing one is a defect):',
      ...existing.map((e) => `- ${e.name}${e.path ? ` — ${e.path}` : ''}${e.disposition ? ` [${e.disposition}]` : ''}`),
    );
  }
  if (missing.length) {
    lines.push(
      'MISSING capabilities (the genuinely new work):',
      ...missing.map(
        (m) =>
          `- ${m.name}${m.path ? ` — ${m.path}` : ''}${m.complexity ? ` (${m.complexity})` : ''}${
            m.dependencies?.length ? ` deps: ${m.dependencies.join(', ')}` : ''
          }`,
      ),
    );
  }
  if (assets.length) {
    lines.push(
      'Context assets already assembled:',
      ...assets.map((a) => `- ${a.title}${a.path ? ` — ${a.path}` : ''}${a.signal ? ` [${a.signal}]` : ''}`),
    );
  }
  if (boundaries.length) {
    lines.push('Hard boundaries (must NEVER happen):', ...boundaries.map((b) => `- ${b}`));
  }
  if (lines.length) {
    lines.push(
      'areasToTouch MUST be drawn from these paths (existing extend/wrap/adapt targets + missing suggested locations) plus any glue their dependencies imply — never invented elsewhere.',
    );
  }
  return lines;
}

/** Legacy name — same function. */
export const sessionFindingsBlock = capabilityEvidenceBlock;

/** Deterministic areasToTouch seed from the evidence — the paths the pipeline
 *  itself named (extend/wrap/adapt targets + missing locations). Pure. */
export function areasFromEvidence(evidence: CapabilityEvidence | undefined): string[] {
  if (!evidence) return [];
  const out: string[] = [];
  for (const e of evidence.existing ?? []) {
    if (e.path && e.disposition && e.disposition !== 'use_directly') out.push(e.path);
  }
  for (const m of evidence.missing ?? []) {
    if (m.path) out.push(m.path);
  }
  return [...new Set(out)];
}

/** Legacy name — same function. */
export const areasFromFindings = areasFromEvidence;

// ---------------------------------------------------------------------------
// The durable store — evidence persists; sessions don't
// ---------------------------------------------------------------------------

const MISSING = 'capability_evidence';

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[capability evidence] migration 20260713010000 not applied; ${scope} skipped`);
  } else {
    console.error(`[capability evidence] ${scope} failed:`, message);
  }
}

/** One-way goal key — deterministic, T2-safe (never a subject identifier). */
export function goalHashFor(goal: string): string {
  return createHash('sha256').update(`capability:goal:${goal.trim()}`).digest('hex').slice(0, 16);
}

/** Persist evidence for a goal. Returns the row id, or null (soft-fail). */
export async function saveCapabilityEvidence(input: {
  goal: string;
  intentRef?: string | null;
  evidence: CapabilityEvidence;
  source?: string;
}): Promise<string | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('capability_evidence')
      .insert({
        goal_hash: goalHashFor(input.goal),
        intent_ref: input.intentRef ?? null,
        evidence: input.evidence,
        source: input.source ?? 'dev-loop-session',
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

/** Read the LATEST persisted evidence for a goal, or null. This is the
 *  "evidence outlives the session" read — pack generation calls it whenever
 *  no live evidence was supplied. Carries created_at for the freshness policy. */
export async function readLatestCapabilityEvidence(
  goal: string,
): Promise<{ id: string; evidence: CapabilityEvidence; createdAt: string } | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('capability_evidence')
      .select('id, evidence, created_at')
      .eq('goal_hash', goalHashFor(goal))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      softFail('read', error.message);
      return null;
    }
    return data
      ? { id: String(data.id), evidence: (data.evidence ?? {}) as CapabilityEvidence, createdAt: String(data.created_at) }
      : null;
  } catch (e) {
    softFail('read', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Attach the provenance receipt to a persisted evidence row (CFS-029 §7.2 —
 *  evidence as a constitutional object carries its receipt). Best-effort. */
export async function attachReceiptToEvidence(id: string, receiptId: string): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;
  try {
    const { error } = await admin.from('capability_evidence').update({ receipt_id: receiptId }).eq('id', id);
    if (error) {
      softFail('attach-receipt', error.message);
      return false;
    }
    return true;
  } catch (e) {
    softFail('attach-receipt', e instanceof Error ? e.message : String(e));
    return false;
  }
}

// ---------------------------------------------------------------------------
// Freshness policy (CFS-029 §7.3) — never ground on stale evidence silently
// ---------------------------------------------------------------------------

/** Design value (v1): persisted evidence older than this is flagged STALE and
 *  a re-inventory is recommended — grounding proceeds, loudly, never silently. */
export const EVIDENCE_FRESHNESS_WINDOW_DAYS = 7;

export type EvidenceFreshness = 'supplied' | 'persisted-fresh' | 'persisted-stale' | 'none';

/** Classify persisted-evidence freshness. Pure — caller supplies `now`. */
export function evidenceFreshnessFor(createdAt: string, now: string): 'persisted-fresh' | 'persisted-stale' {
  const ageMs = new Date(now).getTime() - new Date(createdAt).getTime();
  return ageMs > EVIDENCE_FRESHNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000 ? 'persisted-stale' : 'persisted-fresh';
}

// ---------------------------------------------------------------------------
// The evidence as a ConstitutionalObject (CFS-029 §7.2) — pure projection
// ---------------------------------------------------------------------------

/**
 * Compose the persisted evidence as a well-formed ConstitutionalObject (the
 * P0 object model): identity ref is the T2-safe goal-hash commitment;
 * provenance carries the persistence receipt; standing is a documented v1
 * DESIGN VALUE (0.5 'validated' band floor — evidence is validated by the
 * session that produced it, canonical only by future ratification). Pure.
 */
export function buildCapabilityEvidenceObject(input: {
  goal: string;
  evidence: CapabilityEvidence;
  evidenceRowId: string | null;
  receiptId: string | null;
  createdAt: string;
}): ConstitutionalObject<CapabilityEvidence> {
  const hash = goalHashFor(input.goal);
  const standing = 0.5; // v1 design value — session-validated, not canonized
  return {
    identity: {
      id: `capability-evidence-${hash}`,
      kind: 'knowledge',
      ref: `capability-evidence:${hash}`,
      displayLabel: `Capability Evidence — ${input.goal.trim().slice(0, 80)}`,
    },
    version: { version: 1, status: 'active' },
    standing: { standing, band: standingBandFor(standing), reach: 0 },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: false,
      governingInvariants: [],
    },
    ownership: { ownerCommitment: 'platform-steward' },
    provenance: {
      receiptIds: input.receiptId ? [input.receiptId] : [],
      source: 'authored',
    },
    lifecycle: { state: 'active', order: ['draft', 'active', 'deprecated', 'archived'] },
    dependencies: [],
    payload: input.evidence,
  };
}
