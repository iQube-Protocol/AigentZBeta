/**
 * Generic CRM contact resolution/dedupe — tenant-agnostic, no product-
 * specific tagging or investor lookups.
 *
 * Extracted from campaignContactResolver.ts (the KNYTS Bridge resolver) per
 * operator instruction (Homecoming Closeout CI item, 2026-08-17): reuse
 * resolveCampaignContact()/normalizeEmail() only where genuinely generic;
 * resolveCampaignContact() itself is NOT — it hardcodes KNYT_TENANT_ID,
 * looks up `nakamoto_knyt_personas` (the KNYT investor table) by email, and
 * appends KNYTS_BRIDGE_REQUIRED_INVESTOR_TAGS to any match it finds. Those
 * are real KNYTS product semantics that must not leak into an unrelated
 * campaign/journey (e.g. the Constitutional Internet bridge).
 *
 * This module keeps only the minimum generic layer — precedence steps 1, 2,
 * and 4 of resolveCampaignContact's four-step dedupe (authenticated linkage
 * > normalized email match, respecting the same cross-persona guard > new
 * prospect) — with no investor step and no tag append. Any caller needing
 * product-specific tagging/investor recognition should build (or reuse) a
 * dedicated resolver the same way campaignContactResolver.ts does for
 * KNYTS, not extend this one.
 */

import { getCrmClient, createPersona } from './crmDataAccess';

export interface GenericContactResolution {
  crmPersonaId: string;
  isNewProspect: boolean;
}

export async function resolveGenericContact(params: {
  tenantId: string;
  normalizedEmail: string;
  activePersonaId?: string | null;
}): Promise<GenericContactResolution> {
  const { tenantId, normalizedEmail, activePersonaId } = params;
  const client = getCrmClient();

  // 1. Authenticated linkage — same convention as resolveCampaignContact.
  if (activePersonaId) {
    const { data: byId } = await client
      .from('crm_personas')
      .select('id')
      .eq('id', activePersonaId)
      .maybeSingle();
    if (byId?.id) return { crmPersonaId: byId.id, isNewProspect: false };

    const { data: byLink } = await client
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', activePersonaId)
      .maybeSingle();
    if (byLink?.id) return { crmPersonaId: byLink.id, isNewProspect: false };
  }

  // 2. Normalized email match (case-insensitive), with the same
  // cross-persona guard as resolveCampaignContact: never hand an
  // authenticated caller a row already bound to a DIFFERENT persona.
  const { data: byEmail } = await client
    .from('crm_personas')
    .select('id, identity_persona_id')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle();
  if (byEmail?.id) {
    const boundToOtherPersona =
      Boolean(activePersonaId) &&
      Boolean((byEmail as { identity_persona_id?: string | null }).identity_persona_id) &&
      (byEmail as { identity_persona_id?: string | null }).identity_persona_id !== activePersonaId;

    if (!boundToOtherPersona) {
      if (activePersonaId) {
        await client
          .from('crm_personas')
          .update({ identity_persona_id: activePersonaId, updated_at: new Date().toISOString() })
          .eq('id', byEmail.id)
          .is('identity_persona_id', null);
      }
      return { crmPersonaId: byEmail.id, isNewProspect: false };
    }
    // Falls through to create a row scoped to this activePersonaId, same
    // reasoning as resolveCampaignContact's cross-persona guard.
  }

  // 3. Genuinely new prospect. No investor step — this resolver has no
  // concept of "investor," by design.
  const created = await createPersona({
    tenantId,
    personaState: activePersonaId ? 'pseudonymous' : 'anonymous',
    email: normalizedEmail,
  });
  if (activePersonaId) {
    await client
      .from('crm_personas')
      .update({ identity_persona_id: activePersonaId })
      .eq('id', created.id);
  }
  return { crmPersonaId: created.id, isNewProspect: true };
}
