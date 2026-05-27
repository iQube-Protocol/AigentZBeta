/**
 * services/marketa/cohortExpansion.ts
 *
 * Resolves a Marketa (campaign, cohort) tuple to the full recipient
 * list — every CRM contact in the cohort with the data Mailjet's batch
 * send needs (email + first/last name for variable substitution +
 * stable id for CustomID attribution in the webhook handler).
 *
 * Three cohort namespaces are supported, mirroring
 * `/api/marketa/campaigns`:
 *
 *   - `knyt_codex` + cohort ∈ {top_shelf, zero_knyt, reactivation, general}
 *       → nakamoto_knyt_personas filtered on campaign_cohort
 *   - `knyt_partners` + cohort ∈ {wave_1, wave_2}
 *       → avl_partner_contacts filtered on wave
 *   - `ks_prospects` (cohort optional — full active list)
 *       → ks_backers_staging filtered on suppression_status='active'
 *
 * No persona scoping at this layer — the calling route enforces
 * persona auth + cartridge access. The CRM is the seed list shared
 * across the metaMe suite (operator: "the Seed CRM of the metaMe
 * suite as a whole").
 *
 * Privacy: emails surface to the server only. The expansion result
 * is consumed by the Mailjet send + an aggregate receipt — no
 * per-recipient T0 identifier leaks to the browser.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export interface CohortRecipient {
  /** Stable row id, used as the prefix of Mailjet's CustomID for
   *  webhook attribution. Persona-internal; never serialised to the
   *  browser. */
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** Display string for receipt + UI summaries. */
  fullName: string;
}

export interface CohortExpansion {
  ok: true;
  campaignId: string;
  campaignLabel: string;
  cohortId: string | null;
  cohortLabel: string;
  recipients: CohortRecipient[];
  /** Count after de-dup on email. */
  totalRecipients: number;
}

export type CohortExpansionResult =
  | CohortExpansion
  | { ok: false; reason: string };

const CAMPAIGN_LABELS: Record<string, string> = {
  knyt_codex: 'KNYT Codex Investors',
  knyt_partners: 'KNYT Partners',
  ks_prospects: 'KS Prospects',
};

function humaniseCohortId(id: string): string {
  return id.replace(/_/g, ' ');
}

function dedupByEmail(rows: CohortRecipient[]): CohortRecipient[] {
  const seen = new Set<string>();
  const out: CohortRecipient[] = [];
  for (const r of rows) {
    const key = r.email.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function expandCohortToRecipients(
  campaignId: string,
  cohortId: string | null,
): Promise<CohortExpansionResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'supabase-unavailable' };

  const campaignLabel = CAMPAIGN_LABELS[campaignId] ?? campaignId;
  const cohortLabel = cohortId ? humaniseCohortId(cohortId) : 'all';

  if (campaignId === 'knyt_codex') {
    if (!cohortId) return { ok: false, reason: 'knyt_codex requires a cohort id' };
    const { data, error } = await admin
      .from('nakamoto_knyt_personas')
      .select('id, "Email", "First-Name", "Last-Name", campaign_cohort')
      .eq('campaign_cohort', cohortId)
      .not('Email', 'is', null);
    if (error) return { ok: false, reason: `knyt_codex query failed: ${error.message}` };
    const rows = (data ?? []) as Array<{
      id: string;
      Email: string | null;
      'First-Name': string | null;
      'Last-Name': string | null;
    }>;
    const recipients = dedupByEmail(
      rows
        .filter((r) => typeof r.Email === 'string' && r.Email.length > 0)
        .map((r) => {
          const first = r['First-Name'] ?? null;
          const last = r['Last-Name'] ?? null;
          return {
            id: r.id,
            email: r.Email as string,
            firstName: first,
            lastName: last,
            fullName: [first, last].filter(Boolean).join(' ').trim() || (r.Email as string),
          };
        }),
    );
    return {
      ok: true,
      campaignId,
      campaignLabel,
      cohortId,
      cohortLabel,
      recipients,
      totalRecipients: recipients.length,
    };
  }

  if (campaignId === 'knyt_partners') {
    if (!cohortId) return { ok: false, reason: 'knyt_partners requires a wave id' };
    const waveNum = cohortId === 'wave_1' ? 1 : cohortId === 'wave_2' ? 2 : null;
    if (waveNum === null) return { ok: false, reason: `unknown wave: ${cohortId}` };
    const { data, error } = await admin
      .from('avl_partner_contacts')
      .select('id, email, first_name, last_name, wave')
      .eq('wave', waveNum)
      .not('email', 'is', null);
    if (error) return { ok: false, reason: `knyt_partners query failed: ${error.message}` };
    const rows = (data ?? []) as Array<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }>;
    const recipients = dedupByEmail(
      rows
        .filter((r) => typeof r.email === 'string' && r.email.length > 0)
        .map((r) => ({
          id: r.id,
          email: r.email as string,
          firstName: r.first_name,
          lastName: r.last_name,
          fullName: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || (r.email as string),
        })),
    );
    return {
      ok: true,
      campaignId,
      campaignLabel,
      cohortId,
      cohortLabel,
      recipients,
      totalRecipients: recipients.length,
    };
  }

  if (campaignId === 'ks_prospects') {
    const { data, error } = await admin
      .from('ks_backers_staging')
      .select('id, email, first_name, last_name, suppression_status')
      .eq('suppression_status', 'active')
      .not('email', 'is', null);
    if (error) return { ok: false, reason: `ks_prospects query failed: ${error.message}` };
    const rows = (data ?? []) as Array<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }>;
    const recipients = dedupByEmail(
      rows
        .filter((r) => typeof r.email === 'string' && r.email.length > 0)
        .map((r) => ({
          id: r.id,
          email: r.email as string,
          firstName: r.first_name,
          lastName: r.last_name,
          fullName: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || (r.email as string),
        })),
    );
    return {
      ok: true,
      campaignId,
      campaignLabel,
      cohortId: null,
      cohortLabel: 'active',
      recipients,
      totalRecipients: recipients.length,
    };
  }

  return { ok: false, reason: `unknown campaign id: ${campaignId}` };
}
