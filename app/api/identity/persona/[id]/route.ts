import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPersonaFioService } from '@/services/wallet/personaFioService';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { getActiveUserIQube, hasActivePersonaGrant } from '@/services/wallet/userIQubeAccess';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function toIdentitySafePersona(record: any, fioVisible: boolean) {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    display_name: record.display_name,
    avatar_uri: record.avatar_uri ?? null,
    fio_handle: fioVisible ? record.fio_handle : null,
    fio_domain: record.fio_domain ?? null,
    default_identity_state: record.default_identity_state ?? null,
    world_id_status: record.world_id_status ?? null,
    app_origin: record.app_origin ?? null,
    discoverable_within_tenant: !!record.discoverable_within_tenant,
    evm_address: record.evm_address ?? null,
    btc_address: record.btc_address ?? null,
    sol_address: record.sol_address ?? null,
    bio: record.bio ?? null,
    fio_public_key: record.fio_public_key ?? null,
    fio_tx_id: record.fio_tx_id ?? null,
    fio_handle_expiration: record.fio_handle_expiration ?? null,
    fio_registration_status: record.fio_registration_status ?? null,
    fio_registered_at: record.fio_registered_at ?? null,
    referred_by_persona_id: record.referred_by_persona_id ?? null,
    referrer_persona_id: record.referrer_persona_id ?? null,
    ref_campaign_id: record.ref_campaign_id ?? null,
    first_paid_purchase_at: record.first_paid_purchase_at ?? null,
    referral_locked_at: record.referral_locked_at ?? null,
    referral_method: record.referral_method ?? null,
    referral_identifier: record.referral_identifier ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * GET /api/identity/persona/[id]
 * Fetch a single persona by ID or FIO handle
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const callerAuthProfileId = await getCallerAuthProfileId(req);

    // Check if id looks like a UUID or a FIO handle
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isFioHandle = id.includes('@');

    // Canonical: personas table (plural)
    let fallbackQuery = supabase.from('personas').select(
      'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,default_identity_state,world_id_status,app_origin,discoverable_within_tenant,evm_address,btc_address,sol_address,bio,fio_public_key,fio_tx_id,fio_handle_expiration,fio_registration_status,fio_registered_at,referred_by_persona_id,referrer_persona_id,ref_campaign_id,first_paid_purchase_at,referral_locked_at,referral_method,referral_identifier,created_at,updated_at'
    );
    if (isUuid) {
      fallbackQuery = fallbackQuery.eq('id', id);
    } else if (isFioHandle) {
      fallbackQuery = fallbackQuery.ilike('fio_handle', id.toLowerCase());
    } else {
      fallbackQuery = fallbackQuery.or(`id.eq.${id},fio_handle.ilike.%${id}%`);
    }

    const { data: persona, error } = await fallbackQuery.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Persona not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const isOwner = !!callerAuthProfileId && persona?.auth_profile_id === callerAuthProfileId;
    const iqube = callerAuthProfileId ? await getActiveUserIQube(callerAuthProfileId) : null;
    const isGranted =
      !!callerAuthProfileId &&
      !!persona?.id &&
      hasActivePersonaGrant(iqube, String(persona.id), persona?.tenant_id || null);
    const isDiscoverable =
      !!tenantId && tenantId === persona?.tenant_id && persona?.discoverable_within_tenant === true;
    if (!isOwner && !isGranted && !isDiscoverable) {
      return NextResponse.json(
        { ok: false, error: 'Persona not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: toIdentitySafePersona(persona, isOwner || isGranted || isDiscoverable) });
  } catch (e: any) {
    console.error('[GET /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/identity/persona/[id]
 * Update a persona by ID or FIO handle.
 *
 * NOTE — plaintext wallet address writes are deprecated. The columns
 * `evm_address`, `btc_address`, `sol_address` violate the iQube identity
 * sovereignty model (linkage attack surface across personas). Writes to
 * these fields are blocked by default. To replace them, see:
 *   codexes/packs/agentiq/updates/2026-04-29_plaintext-wallet-address-deprecation.md
 * Escape hatch (legacy admin sync only): set
 *   ALLOW_LEGACY_PLAINTEXT_WALLET_WRITE=true
 */
const PLAINTEXT_WALLET_FIELDS = ['evm_address', 'btc_address', 'sol_address'] as const;
const allowLegacyPlaintextWalletWrite = () =>
  (process.env.ALLOW_LEGACY_PLAINTEXT_WALLET_WRITE || '').toLowerCase() === 'true';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    // Guard: plaintext wallet address writes are deprecated and blocked
    const attemptedPlaintextFields = PLAINTEXT_WALLET_FIELDS.filter(
      (f) => body[f] !== undefined && body[f] !== null && body[f] !== ''
    );
    if (attemptedPlaintextFields.length > 0 && !allowLegacyPlaintextWalletWrite()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'plaintext_wallet_write_disabled',
          message:
            'Direct plaintext writes to evm_address, btc_address, sol_address are deprecated. Wallet linkages must go through the Escrow alias commitment scheme (pending). See 2026-04-29_plaintext-wallet-address-deprecation.md.',
          attempted: attemptedPlaintextFields,
        },
        { status: 410 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const callerAuthProfileId = await getCallerAuthProfileId(req);

    // Check if id looks like a UUID or a FIO handle
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isFioHandle = id.includes('@');

    const personaTableUpdates: Record<string, any> = {};
    if (allowLegacyPlaintextWalletWrite()) {
      if (body.evm_address !== undefined) personaTableUpdates.evm_address = body.evm_address;
      if (body.btc_address !== undefined) personaTableUpdates.btc_address = body.btc_address;
      if (body.sol_address !== undefined) personaTableUpdates.sol_address = body.sol_address;
    }
    if (body.bio !== undefined) personaTableUpdates.bio = body.bio;
    if (body.fio_handle !== undefined) personaTableUpdates.fio_handle = body.fio_handle;
    if (body.display_name !== undefined) personaTableUpdates.display_name = body.display_name;
    if (body.avatar_uri !== undefined) personaTableUpdates.avatar_uri = body.avatar_uri;
    if (body.discoverable_within_tenant !== undefined) {
      personaTableUpdates.discoverable_within_tenant = !!body.discoverable_within_tenant;
    }

    if (Object.keys(personaTableUpdates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    // Enforce owner check for identity updates when auth is present
    if (callerAuthProfileId) {
      const { data: existing } = await supabase
        .from('personas')
        .select('id,auth_profile_id')
        .eq(isUuid ? 'id' : 'fio_handle', id)
        .maybeSingle();
      if (existing?.auth_profile_id && existing.auth_profile_id !== callerAuthProfileId) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    let query = supabase.from('personas').update(personaTableUpdates);
    if (isUuid) {
      query = query.eq('id', id);
    } else if (isFioHandle) {
      query = query.ilike('fio_handle', id.toLowerCase());
    } else {
      query = query.eq('id', id);
    }

    const { data, error } = await query
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,default_identity_state,world_id_status,app_origin,discoverable_within_tenant,evm_address,btc_address,sol_address,bio,fio_public_key,fio_tx_id,fio_handle_expiration,fio_registration_status,fio_registered_at,referred_by_persona_id,referrer_persona_id,ref_campaign_id,first_paid_purchase_at,referral_locked_at,referral_method,referral_identifier,created_at,updated_at'
      )
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Persona not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    // Sync wallet addresses to FIO network if evm_address, btc_address, or sol_address changed
    // This calls FIO addpubaddress action to register chain mappings on-chain
    const fioHandle = data?.fio_handle;
    if (fioHandle && (body.evm_address || body.btc_address || body.sol_address)) {
      console.log('[PATCH persona] Syncing wallet addresses to FIO network:', {
        fioHandle,
        evm_address: body.evm_address,
        btc_address: body.btc_address,
        sol_address: body.sol_address,
      });
      
      const fioSyncResults: { chain: string; success: boolean; error?: string }[] = [];
      
      try {
        const fioService = getPersonaFioService();
        
        // Sync EVM address (ETH chain code covers all EVM chains in FIO)
        if (body.evm_address) {
          const result = await fioService.mapWalletAddress(fioHandle, 'ETH', body.evm_address);
          fioSyncResults.push({ chain: 'ETH', ...result });
        }
        
        // Sync BTC address
        if (body.btc_address) {
          const result = await fioService.mapWalletAddress(fioHandle, 'BTC', body.btc_address);
          fioSyncResults.push({ chain: 'BTC', ...result });
        }
        
        // Sync SOL address
        if (body.sol_address) {
          const result = await fioService.mapWalletAddress(fioHandle, 'SOL', body.sol_address);
          fioSyncResults.push({ chain: 'SOL', ...result });
        }
        
        console.log('[PATCH persona] FIO sync results:', fioSyncResults);
      } catch (fioError) {
        console.error('[PATCH persona] FIO sync error:', fioError);
        // Don't fail the request if FIO sync fails - Supabase update succeeded
        fioSyncResults.push({ chain: 'ALL', success: false, error: (fioError as Error).message });
      }
      
      // Include FIO sync status in response
      return NextResponse.json({ 
        ok: true, 
        data: toIdentitySafePersona(data, true),
        fioSync: {
          attempted: true,
          results: fioSyncResults,
        }
      });
    }

    return NextResponse.json({ ok: true, data: toIdentitySafePersona(data, true) });
  } catch (e: any) {
    console.error('[PATCH /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to update persona' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/identity/persona/[id]
 * Delete a persona
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('personas')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, message: 'Persona deleted successfully' });
  } catch (e: any) {
    console.error('[DELETE /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to delete persona' },
      { status: 500 }
    );
  }
}
