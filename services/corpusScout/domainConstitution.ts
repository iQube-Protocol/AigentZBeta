/**
 * Corpus Scout — Constitutional Discovery amendment (PRD-ICA-001 amendment,
 * RATIFIED 2026-07-23), Phase 1: the constitutional substrate Agent 0 (Domain
 * Architect) produces ahead of any acquisition. See
 * `codexes/packs/agentiq/updates/2026-07-23_prd-ica-001-amendment-constitutional-discovery-domain-architect.md`.
 *
 * Four artifacts, one shared propose→ratify lifecycle (no auto-ratification):
 *   Domain Definition (§2.1), Constitutional Coverage Model (§2.2, pillars
 *   that CONSTITUTE the domain — Law I, §2.0), Constitutional Dependency
 *   Registry (§2.3, external domains that CONSTRAIN it), Institutional
 *   Registry (§3, generated FROM a ratified pillar).
 *
 * This module owns the substrate; it does NOT touch `corpus_candidate_sources`
 * or the Discovery Engine — Gap Detection's consumption of a ratified pillar
 * list lives in `intelligence.ts`'s `assessLaneCoverage()` extension, which
 * imports the pillar keys this module resolves, never the other way round.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DomainConstitution,
  DomainDefinitionRow,
  CoveragePillarRow,
  DependencyRegistryRow,
  InstitutionalRegistryRow,
  RatificationStatus,
} from './types';

type Result<T> = { ok: true } & T | { ok: false; error: string };

function toDefinitionRow(r: Record<string, unknown>): DomainDefinitionRow {
  return {
    id: String(r.id),
    domain: String(r.domain),
    purpose: String(r.purpose ?? ''),
    status: r.status as RatificationStatus,
    ratifiedBy: (r.ratified_by as string | null) ?? null,
    ratifiedAt: (r.ratified_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toPillarRow(r: Record<string, unknown>): CoveragePillarRow {
  return {
    id: String(r.id),
    domain: String(r.domain),
    pillarKey: String(r.pillar_key),
    pillarLabel: String(r.pillar_label ?? ''),
    completenessDefinition: String(r.completeness_definition ?? ''),
    status: r.status as RatificationStatus,
    ratifiedBy: (r.ratified_by as string | null) ?? null,
    ratifiedAt: (r.ratified_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toDependencyRow(r: Record<string, unknown>): DependencyRegistryRow {
  return {
    id: String(r.id),
    domain: String(r.domain),
    dependencyName: String(r.dependency_name),
    relationship: String(r.relationship ?? ''),
    status: r.status as RatificationStatus,
    ratifiedBy: (r.ratified_by as string | null) ?? null,
    ratifiedAt: (r.ratified_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toInstitutionRow(r: Record<string, unknown>): InstitutionalRegistryRow {
  return {
    id: String(r.id),
    domain: String(r.domain),
    pillarKey: String(r.pillar_key),
    institutionName: String(r.institution_name),
    status: r.status as RatificationStatus,
    ratifiedBy: (r.ratified_by as string | null) ?? null,
    ratifiedAt: (r.ratified_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/** The full constitutional substrate for one domain. */
export async function getDomainConstitution(
  admin: SupabaseClient,
  domain: string,
): Promise<DomainConstitution> {
  const [definitionRes, pillarsRes, dependenciesRes, institutionsRes] = await Promise.all([
    admin.from('corpus_domain_definitions').select('*').eq('domain', domain).maybeSingle(),
    admin.from('corpus_coverage_pillars').select('*').eq('domain', domain).order('pillar_label', { ascending: true }),
    admin.from('corpus_dependency_registry').select('*').eq('domain', domain).order('dependency_name', { ascending: true }),
    admin.from('corpus_institutional_registry').select('*').eq('domain', domain).order('institution_name', { ascending: true }),
  ]);

  return {
    domain,
    definition: definitionRes.data ? toDefinitionRow(definitionRes.data as Record<string, unknown>) : null,
    pillars: ((pillarsRes.data ?? []) as Record<string, unknown>[]).map(toPillarRow),
    dependencies: ((dependenciesRes.data ?? []) as Record<string, unknown>[]).map(toDependencyRow),
    institutions: ((institutionsRes.data ?? []) as Record<string, unknown>[]).map(toInstitutionRow),
  };
}

/** §2.1 — propose or edit the Domain Definition. Editing an already-ratified
 *  definition resets it to `proposed` — a steward must re-ratify (mirrors the
 *  "steward re-ratifies under their own id" note in the seed migration). */
export async function upsertDomainDefinition(
  admin: SupabaseClient,
  input: { domain: string; purpose: string },
): Promise<Result<{ definition: DomainDefinitionRow }>> {
  const { data, error } = await admin
    .from('corpus_domain_definitions')
    .upsert(
      { domain: input.domain, purpose: input.purpose, status: 'proposed', ratified_by: null, ratified_at: null, updated_at: new Date().toISOString() },
      { onConflict: 'domain' },
    )
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'upsert failed' };
  return { ok: true, definition: toDefinitionRow(data as Record<string, unknown>) };
}

export async function ratifyDomainDefinition(
  admin: SupabaseClient,
  domain: string,
  stewardPersonaId: string,
): Promise<Result<{ definition: DomainDefinitionRow }>> {
  const { data, error } = await admin
    .from('corpus_domain_definitions')
    .update({ status: 'ratified', ratified_by: stewardPersonaId, ratified_at: new Date().toISOString() })
    .eq('domain', domain)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? `no Domain Definition found for '${domain}'` };
  return { ok: true, definition: toDefinitionRow(data as Record<string, unknown>) };
}

/** §2.2 — propose or edit a Constitutional Coverage Model pillar. */
export async function upsertCoveragePillar(
  admin: SupabaseClient,
  input: { domain: string; pillarKey: string; pillarLabel: string; completenessDefinition: string },
): Promise<Result<{ pillar: CoveragePillarRow }>> {
  const { data, error } = await admin
    .from('corpus_coverage_pillars')
    .upsert(
      {
        domain: input.domain,
        pillar_key: input.pillarKey,
        pillar_label: input.pillarLabel,
        completeness_definition: input.completenessDefinition,
        status: 'proposed',
        ratified_by: null,
        ratified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'domain,pillar_key' },
    )
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'upsert failed' };
  return { ok: true, pillar: toPillarRow(data as Record<string, unknown>) };
}

export async function ratifyCoveragePillar(
  admin: SupabaseClient,
  domain: string,
  pillarKey: string,
  stewardPersonaId: string,
): Promise<Result<{ pillar: CoveragePillarRow }>> {
  const { data, error } = await admin
    .from('corpus_coverage_pillars')
    .update({ status: 'ratified', ratified_by: stewardPersonaId, ratified_at: new Date().toISOString() })
    .eq('domain', domain)
    .eq('pillar_key', pillarKey)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? `no pillar '${pillarKey}' found for '${domain}'` };
  return { ok: true, pillar: toPillarRow(data as Record<string, unknown>) };
}

/** §2.3 — propose or edit a Constitutional Dependency Registry entry. The
 *  relationship label is required (Law I, §2.0 — the edge is the point). */
export async function upsertDependencyEntry(
  admin: SupabaseClient,
  input: { domain: string; dependencyName: string; relationship: string },
): Promise<Result<{ dependency: DependencyRegistryRow }>> {
  if (!input.relationship.trim()) return { ok: false, error: 'relationship is required (Law I — the edge is the point)' };
  const { data, error } = await admin
    .from('corpus_dependency_registry')
    .upsert(
      {
        domain: input.domain,
        dependency_name: input.dependencyName,
        relationship: input.relationship,
        status: 'proposed',
        ratified_by: null,
        ratified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'domain,dependency_name' },
    )
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'upsert failed' };
  return { ok: true, dependency: toDependencyRow(data as Record<string, unknown>) };
}

export async function ratifyDependencyEntry(
  admin: SupabaseClient,
  domain: string,
  dependencyName: string,
  stewardPersonaId: string,
): Promise<Result<{ dependency: DependencyRegistryRow }>> {
  const { data, error } = await admin
    .from('corpus_dependency_registry')
    .update({ status: 'ratified', ratified_by: stewardPersonaId, ratified_at: new Date().toISOString() })
    .eq('domain', domain)
    .eq('dependency_name', dependencyName)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? `no dependency '${dependencyName}' found for '${domain}'` };
  return { ok: true, dependency: toDependencyRow(data as Record<string, unknown>) };
}

/** §3 — propose an Institutional Registry entry, generated FROM (i.e.
 *  requiring) an existing Coverage Model pillar. Refuses to attach an
 *  institution to a pillar_key that hasn't been proposed for this domain at
 *  all — enforced here, not by a DB foreign key (natural-key relationship
 *  across two tables). */
export async function upsertInstitutionEntry(
  admin: SupabaseClient,
  input: { domain: string; pillarKey: string; institutionName: string },
): Promise<Result<{ institution: InstitutionalRegistryRow }>> {
  const { data: pillar } = await admin
    .from('corpus_coverage_pillars')
    .select('pillar_key')
    .eq('domain', input.domain)
    .eq('pillar_key', input.pillarKey)
    .maybeSingle();
  if (!pillar) {
    return { ok: false, error: `pillar '${input.pillarKey}' does not exist in the Coverage Model for '${input.domain}' — propose the pillar first` };
  }

  const { data, error } = await admin
    .from('corpus_institutional_registry')
    .upsert(
      {
        domain: input.domain,
        pillar_key: input.pillarKey,
        institution_name: input.institutionName,
        status: 'proposed',
        ratified_by: null,
        ratified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'domain,pillar_key,institution_name' },
    )
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'upsert failed' };
  return { ok: true, institution: toInstitutionRow(data as Record<string, unknown>) };
}

export async function ratifyInstitutionEntry(
  admin: SupabaseClient,
  domain: string,
  pillarKey: string,
  institutionName: string,
  stewardPersonaId: string,
): Promise<Result<{ institution: InstitutionalRegistryRow }>> {
  const { data, error } = await admin
    .from('corpus_institutional_registry')
    .update({ status: 'ratified', ratified_by: stewardPersonaId, ratified_at: new Date().toISOString() })
    .eq('domain', domain)
    .eq('pillar_key', pillarKey)
    .eq('institution_name', institutionName)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? `no institution '${institutionName}' found for pillar '${pillarKey}'` };
  return { ok: true, institution: toInstitutionRow(data as Record<string, unknown>) };
}

/** Gap Detection's input (§6): the ratified pillar keys for a domain — the
 *  "required lanes" `assessLaneCoverage()` checks candidates against. Only
 *  RATIFIED pillars count as required; a merely-proposed pillar isn't yet a
 *  constitutional obligation. */
export function ratifiedPillarKeys(pillars: readonly CoveragePillarRow[]): string[] {
  return pillars.filter((p) => p.status === 'ratified').map((p) => p.pillarKey);
}
