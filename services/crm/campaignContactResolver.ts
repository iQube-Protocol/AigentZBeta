/**
 * Campaign contact resolution/dedupe for the KNYTS Bridge activation
 * (`KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md` §4).
 *
 * A dedicated concern, not folded into `crmDataAccess.ts`'s general typed
 * CRUD surface — this module owns the dedupe HIERARCHY (authenticated
 * linkage > normalized email > existing investor record > new prospect),
 * calling `crmDataAccess.ts`'s existing primitives rather than duplicating
 * `crm_personas` read/write logic.
 *
 * No unique constraint exists on `crm_personas.email` (confirmed: base
 * migration `20251128165800_agentiq_crm.sql`), so dedupe is done here at the
 * application layer, same as the campaign contacts upload route already
 * does for `nakamoto_knyt_personas`/`ks_backers_staging`.
 *
 * Investor preservation: real investor identity/campaign-state lives on
 * `nakamoto_knyt_personas` (`campaign_tags TEXT[]`, `campaign_state`,
 * `kickstarter_clicked_at`/`kickstarter_backed_at` — added by
 * `20260411000000_nakamoto_knyt_campaign_fields.sql`). `campaign_state` on
 * that table is the live email-send funnel status
 * (`unsent|sent|opened|clicked|backed|opted_out`), owned by the campaign
 * send/tracking pipeline — this resolver deliberately never writes it, to
 * avoid colliding with that pipeline. It only appends campaign tags
 * (additive, deduped) and never touches `campaign_state`,
 * `kickstarter_clicked_at`, or `kickstarter_backed_at`.
 */

import { getCrmClient, createPersona } from './crmDataAccess';

const KNYT_TENANT_ID = 'knyt';

export const KNYTS_BRIDGE_REQUIRED_INVESTOR_TAGS = [
  'knyt_bridge_2026',
  'kickstarter_prelaunch',
  'prelaunch_registered',
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CampaignContactResolution {
  crmPersonaId: string;
  isNewProspect: boolean;
  investorKnown: boolean;
  nakamotoPersonaId: string | null;
}

/**
 * Resolve (or create) the CRM contact for a campaign pre-registration.
 *
 * Precedence, per spec §4.2:
 *   1. authenticated persona already linked to a crm_personas row
 *   2. normalized email match on crm_personas.email
 *   3. existing metaKnyt investor record (nakamoto_knyt_personas by email) —
 *      NOT itself a crm_personas row; if found and no crm_personas row
 *      exists yet, create one carrying the email so future dedupe resolves
 *      by identifier (2) above, and tag the investor row.
 *   4. new prospect
 */
export async function resolveCampaignContact(params: {
  normalizedEmail: string;
  activePersonaId?: string | null;
}): Promise<CampaignContactResolution> {
  const { normalizedEmail, activePersonaId } = params;
  const client = getCrmClient();

  // 1. Authenticated linkage — mirrors the convention already used by
  //    services/rewards/grantToCrmRewardsBridge.ts::resolveCrmPersonaId
  //    (crm_personas.id === identity personas.id for synced rows), falling
  //    back to identity_persona_id for rows linked the other way.
  if (activePersonaId) {
    const { data: byId } = await client
      .from('crm_personas')
      .select('id')
      .eq('id', activePersonaId)
      .maybeSingle();
    if (byId?.id) {
      const investor = await findInvestorByEmail(client, normalizedEmail);
      if (investor) await appendInvestorCampaignTags(client, investor.id);
      return {
        crmPersonaId: byId.id,
        isNewProspect: false,
        investorKnown: Boolean(investor),
        nakamotoPersonaId: investor?.id ?? null,
      };
    }
    const { data: byLink } = await client
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', activePersonaId)
      .maybeSingle();
    if (byLink?.id) {
      const investor = await findInvestorByEmail(client, normalizedEmail);
      if (investor) await appendInvestorCampaignTags(client, investor.id);
      return {
        crmPersonaId: byLink.id,
        isNewProspect: false,
        investorKnown: Boolean(investor),
        nakamotoPersonaId: investor?.id ?? null,
      };
    }
  }

  // 2. Normalized email match on crm_personas (case-insensitive).
  const { data: byEmail } = await client
    .from('crm_personas')
    .select('id')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle();
  if (byEmail?.id) {
    if (activePersonaId) {
      // A later authenticated session proves this prospect belongs to a
      // known identity — link it (spec §4.2.7) rather than creating a
      // second CRM identity, but never overwrite an existing linkage.
      await client
        .from('crm_personas')
        .update({ identity_persona_id: activePersonaId, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id)
        .is('identity_persona_id', null);
    }
    const investor = await findInvestorByEmail(client, normalizedEmail);
    if (investor) await appendInvestorCampaignTags(client, investor.id);
    return {
      crmPersonaId: byEmail.id,
      isNewProspect: false,
      investorKnown: Boolean(investor),
      nakamotoPersonaId: investor?.id ?? null,
    };
  }

  // 3. Existing metaKnyt investor by email, no crm_personas row yet.
  const investor = await findInvestorByEmail(client, normalizedEmail);
  if (investor) {
    await appendInvestorCampaignTags(client, investor.id);
    const created = await createPersona({
      tenantId: KNYT_TENANT_ID,
      personaState: activePersonaId ? 'pseudonymous' : 'anonymous',
      email: normalizedEmail,
      displayName: investor.displayName ?? undefined,
    });
    if (activePersonaId) {
      await client
        .from('crm_personas')
        .update({ identity_persona_id: activePersonaId })
        .eq('id', created.id);
    }
    return {
      crmPersonaId: created.id,
      isNewProspect: false, // known investor — not a "new" relationship, even though this crm_personas row is new
      investorKnown: true,
      nakamotoPersonaId: investor.id,
    };
  }

  // 4. Genuinely new prospect.
  const created = await createPersona({
    tenantId: KNYT_TENANT_ID,
    personaState: activePersonaId ? 'pseudonymous' : 'anonymous',
    email: normalizedEmail,
  });
  if (activePersonaId) {
    await client
      .from('crm_personas')
      .update({ identity_persona_id: activePersonaId })
      .eq('id', created.id);
  }
  return {
    crmPersonaId: created.id,
    isNewProspect: true,
    investorKnown: false,
    nakamotoPersonaId: null,
  };
}

async function findInvestorByEmail(
  client: ReturnType<typeof getCrmClient>,
  normalizedEmail: string,
): Promise<{ id: string; displayName: string | null; campaignTags: string[] } | null> {
  const { data } = await client
    .from('nakamoto_knyt_personas')
    .select('id, "First-Name", "Last-Name", campaign_tags')
    .ilike('Email', normalizedEmail)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const first = (row['First-Name'] as string | null) ?? '';
  const last = (row['Last-Name'] as string | null) ?? '';
  const displayName = `${first} ${last}`.trim() || null;
  return {
    id: row.id as string,
    displayName,
    campaignTags: Array.isArray(row.campaign_tags) ? (row.campaign_tags as string[]) : [],
  };
}

/**
 * Additive, deduped tag append only. Deliberately never touches
 * `campaign_state`/`kickstarter_clicked_at`/`kickstarter_backed_at` — those
 * are owned by the live email-send/tracking pipeline.
 */
async function appendInvestorCampaignTags(
  client: ReturnType<typeof getCrmClient>,
  nakamotoPersonaId: string,
): Promise<void> {
  const { data } = await client
    .from('nakamoto_knyt_personas')
    .select('campaign_tags')
    .eq('id', nakamotoPersonaId)
    .maybeSingle();
  const existing = Array.isArray((data as Record<string, unknown> | null)?.campaign_tags)
    ? ((data as Record<string, unknown>).campaign_tags as string[])
    : [];
  const merged = Array.from(new Set([...existing, ...KNYTS_BRIDGE_REQUIRED_INVESTOR_TAGS]));
  if (merged.length === existing.length && existing.every((t) => merged.includes(t))) return;
  await client
    .from('nakamoto_knyt_personas')
    .update({ campaign_tags: merged })
    .eq('id', nakamotoPersonaId);
}
