/**
 * GET /api/crm/personas/[id]/nakamoto
 *
 * Enriches a CRM persona with all historical data from the Nakamoto import:
 * - knytPersona: investment history, asset ownership, OM membership, social handles,
 *   wallet keys, web3 interests (from nakamoto_knyt_personas)
 * - blakQube: supplementary profile data (from nakamoto_blak_qubes)
 * - interactions: full interaction history (from nakamoto_user_interactions)
 *
 * Joins are made by email (personas.fio_handle → nakamoto_knyt_personas."Email").
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = params.id;
  const client = getCrmClient();

  // 1. Resolve persona email from the personas table
  const { data: persona, error: personaError } = await client
    .from('personas')
    .select('id, fio_handle, display_name')
    .eq('id', personaId)
    .maybeSingle();

  if (personaError) {
    return NextResponse.json({ error: personaError.message }, { status: 500 });
  }
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  const email = persona.fio_handle;
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
