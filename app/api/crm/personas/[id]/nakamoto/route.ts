/**
 * GET /api/crm/personas/[id]/nakamoto
 *
 * Enriches a persona with Nakamoto investor data (investment history, asset
 * ownership, OM membership, social handles, wallet keys, web3 interests).
 *
 * Identity resolution — five strategies tried in order:
 *  1. crm_personas.email via identity_persona_id  (personas.id case)
 *  2. crm_personas.email via direct id match       (crm_personas.id case)
 *  3. FIO-handle prefix as email username          (e.g. "kdjazz8@gmail.com")
 *  4. KNYT-ID match for @knyt FIO handles
 *  5. Qrypto-ID match for @qripto FIO handles
 *
 * The blakQube payload is the canonical multi-identifier CRM record: it can
 * carry email, phone, KNYT-ID, Qrypto-ID, and all social/wallet identifiers.
 * Future: add phone-number and OAuth-cert resolution via crm_personas columns
 * as those fields are added.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = params.id;
  const client = getCrmClient();

  // ── Identity resolution ─────────────────────────────────────────────────────
  let email: string | null = null;

  // Strategy 1: crm_personas.email via identity_persona_id (personas.id path)
  const { data: crmByIdentity } = await client
    .from('crm_personas')
    .select('email')
    .eq('identity_persona_id', personaId)
    .not('email', 'is', null)
    .maybeSingle();
  if (crmByIdentity?.email) email = crmByIdentity.email;

  // Strategy 2: crm_personas.email via direct id (crm_personas.id path)
  if (!email) {
    const { data: crmById } = await client
      .from('crm_personas')
      .select('email')
      .eq('id', personaId)
      .not('email', 'is', null)
      .maybeSingle();
    if (crmById?.email) email = crmById.email;
  }

  // Strategies 3–5 need the FIO handle from the identity layer
  let fioPrefix = '';
  let fioDomain = '';

  if (!email) {
    const { data: identityPersona } = await client
      .from('personas')
      .select('fio_handle, display_name')
      .eq('id', personaId)
      .maybeSingle();

    if (identityPersona?.fio_handle) {
      const atIdx = identityPersona.fio_handle.lastIndexOf('@');
      fioPrefix = atIdx > -1 ? identityPersona.fio_handle.slice(0, atIdx) : identityPersona.fio_handle;
      fioDomain = atIdx > -1 ? identityPersona.fio_handle.slice(atIdx + 1) : '';
    }

    // Strategy 3: FIO prefix as email username (kdjazz8 → kdjazz8@*)
    if (fioPrefix) {
      const { data: byEmailPrefix } = await client
        .from('nakamoto_knyt_personas')
        .select('Email')
        .ilike('Email', `${fioPrefix}@%`)
        .maybeSingle();
      if (byEmailPrefix?.Email) email = byEmailPrefix.Email;

      if (!email) {
        const { data: byEmailPrefixBq } = await client
          .from('nakamoto_blak_qubes')
          .select('Email')
          .ilike('Email', `${fioPrefix}@%`)
          .maybeSingle();
        if (byEmailPrefixBq?.Email) email = byEmailPrefixBq.Email;
      }
    }

    // Strategy 4: @knyt FIO handle prefix → KNYT-ID
    if (!email && fioDomain === 'knyt' && fioPrefix) {
      const { data: byKnytId } = await client
        .from('nakamoto_knyt_personas')
        .select('Email')
        .ilike('KNYT-ID', fioPrefix)
        .maybeSingle();
      if (byKnytId?.Email) email = byKnytId.Email;

      if (!email) {
        const { data: byKnytIdBq } = await client
          .from('nakamoto_blak_qubes')
          .select('Email')
          .ilike('KNYT-ID', fioPrefix)
          .maybeSingle();
        if (byKnytIdBq?.Email) email = byKnytIdBq.Email;
      }
    }

    // Strategy 5: @qripto FIO handle prefix → Qrypto-ID
    if (!email && fioDomain === 'qripto' && fioPrefix) {
      const { data: byQryptoId } = await client
        .from('nakamoto_blak_qubes')
        .select('Email')
        .ilike('Qrypto-ID', fioPrefix)
        .maybeSingle();
      if (byQryptoId?.Email) email = byQryptoId.Email;
    }
  }

  if (!email) {
    return NextResponse.json({
      success: true,
      data: null,
      message: 'No identifier could be resolved to a Nakamoto record',
      debug: { fioPrefix, fioDomain },
    });
  }

  // ── Fetch nakamoto records by resolved email ────────────────────────────────
  const [knytResult, blakResult] = await Promise.all([
    client.from('nakamoto_knyt_personas').select('*').ilike('Email', email).maybeSingle(),
    client.from('nakamoto_blak_qubes').select('*').ilike('Email', email).maybeSingle(),
  ]);

  const knytPersona = knytResult.data;
  const blakQube = blakResult.data;
  const nakamotoUserId = knytPersona?.user_id ?? blakQube?.user_id ?? null;

  let interactions: unknown[] = [];
  let rewardRecord: unknown = null;

  if (nakamotoUserId) {
    const [interactionResult, rewardResult] = await Promise.all([
      client
        .from('nakamoto_user_interactions')
        .select('id, query, response, interaction_type, metadata, created_at')
        .eq('user_id', nakamotoUserId)
        .order('created_at', { ascending: false })
        .limit(25),
      client
        .from('nakamoto_knyt_persona_rewards')
        .select('linkedin_connected, metamask_connected, data_completed, reward_claimed, reward_amount, created_at')
        .eq('user_id', nakamotoUserId)
        .maybeSingle(),
    ]);
    interactions = interactionResult.data ?? [];
    rewardRecord = rewardResult.data;
  }

  return NextResponse.json({
    success: true,
    data: { knytPersona, blakQube, interactions, rewardRecord },
  });
}
