/**
 * POST /api/admin/identity/sync-persona-evm-addresses
 *
 * Populates personas.evm_address from agent_keys for all agent personas,
 * and from personas.evm_key for human personas that have an encrypted key pair.
 *
 * This establishes the FIO handle → EVM address canonical mapping within
 * the platform. Once set, SmartWalletDrawer uses this address for on-chain
 * balance queries (so the persona's EVM wallet shows its real Q¢ balance).
 *
 * Also sets root_did from agent_keys or existing persona data if missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export async function GET() {
  // Dry-run: show current state without writing
  const supabase = getSupabase();

  const { data: agentKeys } = await supabase
    .from('agent_keys')
    .select('agent_id, fio_handle, evm_address, persona_id');

  const { data: personas } = await supabase
    .from('personas')
    .select('id, fio_handle, evm_address, evm_key')
    .in('fio_handle', (agentKeys || []).map((k: any) => k.fio_handle).filter(Boolean));

  const gaps = (agentKeys || []).map((k: any) => {
    const persona = (personas || []).find((p: any) => p.fio_handle === k.fio_handle);
    return {
      agentId: k.agent_id,
      fioHandle: k.fio_handle,
      personaId: k.persona_id || persona?.id,
      agentKeyEvmAddress: k.evm_address,
      personaEvmAddress: persona?.evm_address,
      personaEvmKeyAddress: persona?.evm_key?.address || persona?.evm_key?.evmAddress,
      needsSync: persona && !persona.evm_address && !!k.evm_address,
    };
  });

  return Response.json({ ok: true, gaps });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  // 1. Sync agent personas: evm_address from agent_keys → personas
  const { data: agentKeys, error: keysError } = await supabase
    .from('agent_keys')
    .select('agent_id, fio_handle, evm_address, persona_id');

  if (keysError) return Response.json({ ok: false, error: keysError.message }, { status: 500 });

  const results: any[] = [];

  for (const key of agentKeys || []) {
    if (!key.fio_handle || !key.evm_address) continue;

    // Find the persona by fio_handle
    const { data: persona } = await supabase
      .from('personas')
      .select('id, fio_handle, evm_address, evm_key, root_did')
      .ilike('fio_handle', key.fio_handle)
      .maybeSingle();

    if (!persona) {
      results.push({ fioHandle: key.fio_handle, status: 'no_persona', action: 'skipped' });
      continue;
    }

    const updates: Record<string, any> = {};

    // Set evm_address if missing or different
    if (!persona.evm_address || persona.evm_address !== key.evm_address) {
      updates.evm_address = key.evm_address;
    }

    // Set root_did from DID pattern if missing
    if (!persona.root_did) {
      updates.root_did = `did:fio:${key.fio_handle}`;
    }

    if (Object.keys(updates).length === 0) {
      results.push({ fioHandle: key.fio_handle, personaId: persona.id, status: 'already_synced' });
      continue;
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('personas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', persona.id);

      if (updateError) {
        results.push({ fioHandle: key.fio_handle, personaId: persona.id, status: 'error', error: updateError.message });
        continue;
      }

      // Also update agent_keys.persona_id if not set
      if (!key.persona_id) {
        await supabase.from('agent_keys')
          .update({ persona_id: persona.id })
          .eq('agent_id', key.agent_id);
      }
    }

    results.push({
      fioHandle: key.fio_handle,
      personaId: persona.id,
      status: dryRun ? 'would_update' : 'updated',
      updates,
    });
  }

  // 2. Sync human personas: evm_address from evm_key JSONB if evm_address column is empty
  const { data: humanPersonas } = await supabase
    .from('personas')
    .select('id, fio_handle, evm_address, evm_key')
    .is('evm_address', null)
    .not('evm_key', 'is', null);

  for (const persona of humanPersonas || []) {
    const addr = persona.evm_key?.address || persona.evm_key?.evmAddress;
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) continue;

    if (!dryRun) {
      await supabase.from('personas')
        .update({ evm_address: addr, updated_at: new Date().toISOString() })
        .eq('id', persona.id);
    }

    results.push({
      fioHandle: persona.fio_handle,
      personaId: persona.id,
      status: dryRun ? 'would_update' : 'updated',
      updates: { evm_address: addr, source: 'evm_key' },
    });
  }

  return Response.json({ ok: true, dryRun, count: results.length, results });
}
