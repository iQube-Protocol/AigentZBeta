/**
 * GET /api/crm/personas/[id]/nakamoto
 *
 * Enriches a CRM persona with all historical data from the Nakamoto import:
 * - knytPersona: investment history, asset ownership, OM membership, social handles,
 *   wallet keys, web3 interests (from nakamoto_knyt_personas)
 * - blakQube: supplementary profile data (from nakamoto_blak_qubes)
 * - interactions: full interaction history (from nakamoto_user_interactions)
 *
 * Join chain: personas.id → crm_personas.identity_persona_id → crm_personas.email
 *             → nakamoto_knyt_personas."Email"
 *
 * crm_personas.email holds the real email address; personas.fio_handle is a FIO
 * name-service handle (@knyt, @qripto) and does NOT match nakamoto records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = params.id;
  const client = getCrmClient();

  // 1. Resolve real email via crm_personas (joined by identity_persona_id)
  //    Fall back to querying personas.fio_handle if no crm link exists.
  let email: string | null = null;

  const { data: crmPersona } = await client
    .from('crm_personas')
    .select('email')
    .eq('identity_persona_id', personaId)
    .maybeSingle();

  if (crmPersona?.email) {
    email = crmPersona.email;
  } else {
    // Fallback: try treating fio_handle as email (legacy / directly-imported records)
    const { data: identityPersona } = await client
      .from('personas')
      .select('fio_handle')
      .eq('id', personaId)
      .maybeSingle();
    email = identityPersona?.fio_handle ?? null;
  }

  if (!email) {
    return NextResponse.json({ success: true, data: null, message: 'No email — cannot link Nakamoto records' });
  }

  // 2. Fetch knyt persona (investment, assets, OM, socials, wallets)
  const { data: knytPersona } = await client
    .from('nakamoto_knyt_personas')
    .select('*')
    .ilike('Email', email)
    .maybeSingle();

  // 3. Fetch blakQube (supplementary social/web3 profile)
  const { data: blakQube } = await client
    .from('nakamoto_blak_qubes')
    .select('*')
    .ilike('Email', email)
    .maybeSingle();

  // 4. Fetch interaction history via user_id (prefer knyt, fall back to blakQube)
  const nakamotoUserId = knytPersona?.user_id ?? blakQube?.user_id ?? null;
  let interactions: unknown[] = [];

  if (nakamotoUserId) {
    const { data: interactionRows } = await client
      .from('nakamoto_user_interactions')
      .select('id, query, response, interaction_type, metadata, created_at')
      .eq('user_id', nakamotoUserId)
      .order('created_at', { ascending: false })
      .limit(25);
    interactions = interactionRows ?? [];
  }

  // 5. Fetch reward record if available
  let rewardRecord: unknown = null;
  if (nakamotoUserId) {
    const { data: reward } = await client
      .from('nakamoto_knyt_persona_rewards')
      .select('linkedin_connected, metamask_connected, data_completed, reward_claimed, reward_amount, created_at')
      .eq('user_id', nakamotoUserId)
      .maybeSingle();
    rewardRecord = reward;
  }

  return NextResponse.json({
    success: true,
    data: {
      knytPersona,
      blakQube,
      interactions,
      rewardRecord,
    },
  });
}
