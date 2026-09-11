/**
 * Canonical Plate Registry — plates as registered constitutional objects
 * (operator + Aletheon design, 2026-07-20). EXTENDS the existing CP system
 * (CFS-027, services/artifact/canonicalPlates.ts) — never forks it:
 *
 *   • The SEVEN v1 plates stay code-resident (CANONICAL_PLATES_V1) — they are
 *     the ratified seed canon (CFS-027, ratified 2026-07-12) and read as
 *     status 'published' here. "No new diagrams, only new compositions"
 *     still governs publications; this registry governs NEW canonical plates
 *     entering the discipline (CP-008+) through the constitutional lifecycle.
 *   • Lifecycle: draft → candidate → ratified (CANONISATION — the
 *     constitutional decision) → published (EXPOSURE on the public IRL OS
 *     registry). Distinct acts, per the operator's ratified distinction.
 *   • The machine representation (structure/plate.json) IS the plate; the
 *     live SVG renderer (CanonicalPlateFigure) draws it, and uploaded
 *     SVG/PNG/PDF assets are alternative renderings stored as refs.
 *   • Internal IRL (laboratory) sees every status; IRL OS (publishing layer)
 *     sees 'published' only.
 *
 * T0/T2 discipline: composer identity enters only as a T2-safe commitment.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  CANONICAL_PLATES_V1,
  type CanonicalPlate,
  type PlateForm,
} from '@/services/artifact/canonicalPlates';

export type PlateStatus = 'draft' | 'candidate' | 'ratified' | 'published';

export interface RegisteredPlate {
  cpNumber: string;
  title: string;
  version: string;
  status: PlateStatus;
  form: PlateForm;
  kind: string;
  structure: Record<string, unknown>;
  message: string;
  assets: { svg?: string; png?: string; pdf?: string };
  constitutionalRefs: string[];
  dependencies: string[];
  machineTags: string[];
  knowledgeQubeRef: string | null;
  /** True for the seven code-resident v1 plates (immutable seed canon). */
  seed: boolean;
  createdAt: string | null;
  ratifiedAt: string | null;
  publishedAt: string | null;
}

const PLATE_FORMS: readonly PlateForm[] = ['branch', 'radial', 'circle', 'stack', 'flow'];

/** Legal lifecycle transitions — canonise and publish are separate acts. */
const TRANSITIONS: Record<string, { from: PlateStatus[]; to: PlateStatus }> = {
  submit: { from: ['draft'], to: 'candidate' },
  canonise: { from: ['candidate'], to: 'ratified' },
  publish: { from: ['ratified'], to: 'published' },
  // Withdraw returns to draft from any pre-published state (a published
  // plate is withdrawn by a separate deliberate act, not provided here).
  withdraw: { from: ['candidate', 'ratified'], to: 'draft' },
};
export type PlateTransition = keyof typeof TRANSITIONS;

function seedPlateToRegistered(p: CanonicalPlate): RegisteredPlate {
  return {
    cpNumber: p.number,
    title: p.title,
    version: '1.0',
    status: 'published', // CFS-027 ratified the v1 canon; the gallery is public.
    form: p.form,
    kind: p.kind,
    structure: p.structure as Record<string, unknown>,
    message: p.message,
    assets: {},
    constitutionalRefs: ['CFS-027'],
    dependencies: [],
    machineTags: p.signature ? ['signature'] : [],
    knowledgeQubeRef: null,
    seed: true,
    createdAt: null,
    ratifiedAt: null,
    publishedAt: null,
  };
}

function rowToRegistered(r: Record<string, unknown>): RegisteredPlate {
  return {
    cpNumber: String(r.cp_number),
    title: String(r.title),
    version: String(r.version ?? '1.0'),
    status: String(r.status) as PlateStatus,
    form: (PLATE_FORMS.includes(r.form as PlateForm) ? r.form : 'branch') as PlateForm,
    kind: String(r.kind ?? 'ontology'),
    structure: (r.structure as Record<string, unknown>) ?? {},
    message: String(r.message ?? ''),
    assets: (r.assets as RegisteredPlate['assets']) ?? {},
    constitutionalRefs: (r.constitutional_refs as string[]) ?? [],
    dependencies: (r.dependencies as string[]) ?? [],
    machineTags: (r.machine_tags as string[]) ?? [],
    knowledgeQubeRef: (r.knowledge_qube_ref as string | null) ?? null,
    seed: false,
    createdAt: (r.created_at as string | null) ?? null,
    ratifiedAt: (r.ratified_at as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

/**
 * List the full registry — seed canon first (CP-001..007), then composed
 * plates in cp_number order. `edition: 'public'` returns only published
 * plates (the IRL OS view); 'internal' returns every status (the lab view).
 */
export async function listPlates(
  admin: SupabaseClient,
  edition: 'public' | 'internal',
): Promise<RegisteredPlate[]> {
  const seed = CANONICAL_PLATES_V1.map(seedPlateToRegistered);
  let q = admin.from('canonical_plate_registry').select('*').order('cp_number');
  if (edition === 'public') q = q.eq('status', 'published');
  const { data, error } = await q;
  // Pre-migration installs degrade to the seed canon alone.
  const composed = error ? [] : (data ?? []).map(rowToRegistered);
  return [...seed, ...composed];
}

/** Validation — schema + graph checks before a plate may advance. */
export function validatePlate(
  input: Partial<RegisteredPlate>,
  knownCpNumbers: Set<string>,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  if (!input.title?.trim()) violations.push('title is required');
  if (!input.message?.trim()) violations.push('message (the one-line reading) is required — a plate MEANS something');
  if (!input.structure || Object.keys(input.structure).length === 0) {
    violations.push('structure (plate.json) is required — the machine representation IS the plate');
  }
  if (input.form && !PLATE_FORMS.includes(input.form)) {
    violations.push(`form must be one of: ${PLATE_FORMS.join(', ')}`);
  }
  for (const dep of input.dependencies ?? []) {
    if (!knownCpNumbers.has(dep)) violations.push(`dependency ${dep} is not a registered plate`);
  }
  if ((input.constitutionalRefs ?? []).length === 0) {
    violations.push('at least one constitutional reference (CFS id / Law / invariant seed id) is required');
  }
  return { valid: violations.length === 0, violations };
}

/** Next CP number after the seed canon + existing composed plates. */
export async function nextCpNumber(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from('canonical_plate_registry')
    .select('cp_number')
    .order('cp_number', { ascending: false })
    .limit(1);
  const maxSeed = CANONICAL_PLATES_V1.length; // 7
  const maxComposed = data?.[0]?.cp_number
    ? parseInt(String(data[0].cp_number).replace('CP-', ''), 10)
    : 0;
  const next = Math.max(maxSeed, isNaN(maxComposed) ? 0 : maxComposed) + 1;
  return `CP-${String(next).padStart(3, '0')}`;
}

/** T2-safe composer commitment (assetCommitment pattern — one-way). */
export function composerCommitment(personaId: string): string {
  return createHash('sha256').update(`plate-composer:${personaId}`).digest('hex').slice(0, 16);
}

/** Compose a new draft plate (validation must have passed). */
export async function composePlate(
  admin: SupabaseClient,
  input: {
    title: string;
    form: PlateForm;
    kind: string;
    structure: Record<string, unknown>;
    message: string;
    assets?: RegisteredPlate['assets'];
    constitutionalRefs: string[];
    dependencies?: string[];
    machineTags?: string[];
    knowledgeQubeRef?: string | null;
    composerPersonaId: string;
  },
): Promise<{ ok: true; cpNumber: string } | { ok: false; error: string }> {
  const cpNumber = await nextCpNumber(admin);
  const { error } = await admin.from('canonical_plate_registry').insert({
    cp_number: cpNumber,
    title: input.title.trim(),
    form: input.form,
    kind: input.kind,
    structure: input.structure,
    message: input.message.trim(),
    assets: input.assets ?? {},
    constitutional_refs: input.constitutionalRefs,
    dependencies: input.dependencies ?? [],
    machine_tags: input.machineTags ?? [],
    knowledge_qube_ref: input.knowledgeQubeRef ?? null,
    composed_by_commitment: composerCommitment(input.composerPersonaId),
    status: 'draft',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, cpNumber };
}

/** Advance a plate through the lifecycle. Illegal transitions are refused. */
export async function transitionPlate(
  admin: SupabaseClient,
  cpNumber: string,
  transition: PlateTransition,
): Promise<{ ok: true; status: PlateStatus } | { ok: false; error: string }> {
  const rule = TRANSITIONS[transition];
  if (!rule) return { ok: false, error: `Unknown transition '${transition}'` };
  if (CANONICAL_PLATES_V1.some((p) => p.number === cpNumber)) {
    return { ok: false, error: 'The v1 seed canon (CP-001..007) is immutable — compose a new version as a new plate' };
  }
  const { data: row, error: readErr } = await admin
    .from('canonical_plate_registry')
    .select('status')
    .eq('cp_number', cpNumber)
    .maybeSingle();
  if (readErr || !row) return { ok: false, error: readErr?.message ?? 'Plate not found' };
  const current = String(row.status) as PlateStatus;
  if (!rule.from.includes(current)) {
    return { ok: false, error: `Cannot ${transition} from '${current}' (legal from: ${rule.from.join(', ')})` };
  }
  const patch: Record<string, unknown> = { status: rule.to, updated_at: new Date().toISOString() };
  if (transition === 'canonise') patch.ratified_at = new Date().toISOString();
  if (transition === 'publish') patch.published_at = new Date().toISOString();
  const { error } = await admin
    .from('canonical_plate_registry')
    .update(patch)
    .eq('cp_number', cpNumber)
    .eq('status', current); // optimistic — a concurrent transition loses
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: rule.to };
}
