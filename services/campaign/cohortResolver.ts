/**
 * Cohort Resolver
 *
 * Maps a cohort_id (e.g. 'crm-investors') to a count + recipient list. Used by
 * the operator propose-campaign surface to preview reach and (later) drive the
 * actual send pipeline.
 *
 * Each cohort lives behind a function so resolution logic stays close to the
 * source-of-truth table. Adding a new cohort: add an entry to COHORT_REGISTRY.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Cohort {
  id: string;
  label: string;
  description: string;
}

export interface CohortPreview {
  count: number;
  /**
   * Up to 200 sample persona ids — used to confirm the cohort has data before
   * the operator triggers a send. Full resolution at send time is the
   * sender pipeline's responsibility.
   */
  samplePersonaIds: string[];
}

export const COHORT_REGISTRY: Cohort[] = [
  { id: 'crm-investors',         label: 'CRM Investors',         description: 'Every persona flagged as an investor in the CRM.' },
  { id: 'zero-knyt-holders',     label: 'Zero KNYT holders',     description: 'Personas owning a Zero KNYT entitlement.' },
  { id: 'ks-backers',            label: 'Kickstarter backers',   description: 'Personas matched to imported KS backer rows.' },
  { id: 'all-active-personas',   label: 'All active personas',   description: 'Every persona that has signed in or been seeded.' },
];

let _client: SupabaseClient | null = null;
function supa(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return _client;
}

export async function resolveCohort(cohortId: string): Promise<CohortPreview> {
  switch (cohortId) {
    case 'crm-investors': return resolveCrmInvestors();
    case 'zero-knyt-holders': return resolveZeroKnytHolders();
    case 'ks-backers': return resolveKsBackers();
    case 'all-active-personas': return resolveAllActivePersonas();
    default: return { count: 0, samplePersonaIds: [] };
  }
}

async function resolveCrmInvestors(): Promise<CohortPreview> {
  // CRM investor table — soft signal: any persona row with crm_status indicating
  // investor. The CRM table is `nakamoto_knyt_personas` — fall through to
  // personas if that lookup fails.
  try {
    const { data, count } = await supa()
      .from('nakamoto_knyt_personas')
      .select('persona_id', { count: 'exact' })
      .eq('is_investor', true)
      .limit(200);
    if (data) {
      return {
        count: count ?? data.length,
        samplePersonaIds: data.map((r) => r.persona_id as string).filter(Boolean),
      };
    }
  } catch {
    // Fall through
  }
  return { count: 0, samplePersonaIds: [] };
}

async function resolveZeroKnytHolders(): Promise<CohortPreview> {
  // Anyone whose user_entitlements contains a Zero KNYT bundle id.
  const { data, count } = await supa()
    .from('user_entitlements')
    .select('persona_id', { count: 'exact' })
    .eq('asset_id', 'zero-knyt-investor')
    .limit(200);
  return {
    count: count ?? (data?.length ?? 0),
    samplePersonaIds: (data ?? []).map((r) => r.persona_id as string).filter(Boolean),
  };
}

async function resolveKsBackers(): Promise<CohortPreview> {
  // Kickstarter backers table — schema may vary; gracefully return 0 if absent.
  try {
    const { data, count } = await supa()
      .from('kickstarter_backers')
      .select('persona_id', { count: 'exact' })
      .not('persona_id', 'is', null)
      .limit(200);
    return {
      count: count ?? (data?.length ?? 0),
      samplePersonaIds: (data ?? []).map((r) => r.persona_id as string).filter(Boolean),
    };
  } catch {
    return { count: 0, samplePersonaIds: [] };
  }
}

async function resolveAllActivePersonas(): Promise<CohortPreview> {
  const { data, count } = await supa()
    .from('personas')
    .select('id', { count: 'exact' })
    .limit(200);
  return {
    count: count ?? (data?.length ?? 0),
    samplePersonaIds: (data ?? []).map((r) => r.id as string).filter(Boolean),
  };
}
