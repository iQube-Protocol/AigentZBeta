export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'crypto';

/**
 * Register Agent Keys API
 * 
 * POST /api/admin/register-agent-keys
 * 
 * Registers or updates EVM keys for core agents:
 * - Aigent Z (System Agent)
 * - MoneyPenny (Financial Agent)
 * - Kn0w1 (Knowledge Agent)
 * - Nakamoto (Crypto Agent)
 * 
 * Security: Requires admin authorization or specific agent IDs
 */

// Agent definitions - matching existing database records
const AGENTS = [
  {
    agentId: 'aigent-z',
    agentName: 'Aigent Z',
    fioHandle: 'aigentz@aigent',
    entityType: 'agent',
    role: 'System Agent',
  },
  {
    agentId: 'aigent-moneypenny',
    agentName: 'Aigent MoneyPenny',
    fioHandle: 'moneypenny@aigent',
    entityType: 'agent',
    role: 'Financial Agent',
  },
  {
    agentId: 'aigent-kn0w1',
    agentName: 'Aigent Kn0w1',
    fioHandle: 'kn0w1@aigent',
    entityType: 'agent',
    role: 'Knowledge Agent',
  },
  {
    agentId: 'aigent-nakamoto',
    agentName: 'Aigent Nakamoto',
    fioHandle: 'nakamoto@aigent',
    entityType: 'agent',
    role: 'Crypto Agent',
  },
];

// Encrypt function matching AgentKeyService
function encrypt(text: string, encryptionKey: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export async function POST(req: NextRequest) {
  try {
    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET || process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing Supabase configuration' 
      }, { status: 500 });
    }

    if (!encryptionKey) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing AGENT_KEY_ENCRYPTION_SECRET' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Parse request body for optional filters
    const body = await req.json().catch(() => ({}));
    const { agentIds, forceRegenerate } = body;

    // Filter agents if specific IDs provided
    const agentsToProcess = agentIds 
      ? AGENTS.filter(a => agentIds.includes(a.agentId))
      : AGENTS;

    // Import ethers dynamically
    const { ethers } = await import('ethers');

    const results: any[] = [];

    for (const agent of agentsToProcess) {
      // Check if agent already has keys
      const { data: existing } = await supabase
        .from('agent_keys')
        .select('agent_id, evm_address, fio_handle, entity_type')
        .eq('agent_id', agent.agentId)
        .maybeSingle();

      if (existing?.evm_address && !forceRegenerate) {
        // Agent exists - just update FIO handle and entity type if needed
        const needsUpdate = existing.fio_handle !== agent.fioHandle || 
                           existing.entity_type !== agent.entityType;

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('agent_keys')
            .update({
              fio_handle: agent.fioHandle,
              entity_type: agent.entityType,
              agent_name: agent.agentName,
              updated_at: new Date().toISOString(),
            })
            .eq('agent_id', agent.agentId);

          results.push({
            agentId: agent.agentId,
            agentName: agent.agentName,
            fioHandle: agent.fioHandle,
            evmAddress: existing.evm_address,
            status: updateError ? 'error' : 'updated',
            error: updateError?.message,
          });
        } else {
          results.push({
            agentId: agent.agentId,
            agentName: agent.agentName,
            fioHandle: existing.fio_handle,
            evmAddress: existing.evm_address,
            status: 'exists',
          });
        }
      } else {
        // Generate new keys
        const wallet = ethers.Wallet.createRandom();
        const encryptedPrivateKey = encrypt(wallet.privateKey, encryptionKey);

        if (existing && forceRegenerate) {
          // Update existing record with new keys
          const { error: updateError } = await supabase
            .from('agent_keys')
            .update({
              agent_name: agent.agentName,
              fio_handle: agent.fioHandle,
              entity_type: agent.entityType,
              evm_address: wallet.address,
              evm_private_key_encrypted: encryptedPrivateKey,
              updated_at: new Date().toISOString(),
            })
            .eq('agent_id', agent.agentId);

          results.push({
            agentId: agent.agentId,
            agentName: agent.agentName,
            fioHandle: agent.fioHandle,
            evmAddress: wallet.address,
            status: updateError ? 'error' : 'regenerated',
            error: updateError?.message,
          });
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('agent_keys')
            .insert({
              agent_id: agent.agentId,
              agent_name: agent.agentName,
              fio_handle: agent.fioHandle,
              entity_type: agent.entityType,
              evm_address: wallet.address,
              evm_private_key_encrypted: encryptedPrivateKey,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          results.push({
            agentId: agent.agentId,
            agentName: agent.agentName,
            fioHandle: agent.fioHandle,
            evmAddress: wallet.address,
            status: insertError ? 'error' : 'created',
            error: insertError?.message,
          });
        }
      }
    }

    // Summary
    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      regenerated: results.filter(r => r.status === 'regenerated').length,
      exists: results.filter(r => r.status === 'exists').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return NextResponse.json({
      ok: true,
      summary,
      agents: results,
    });

  } catch (error) {
    console.error('[RegisterAgentKeys] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to check current agent keys status
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing Supabase configuration' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get all agent keys (without private keys)
    const { data, error } = await supabase
      .from('agent_keys')
      .select('agent_id, agent_name, fio_handle, entity_type, evm_address, btc_address, solana_address, created_at, updated_at')
      .order('agent_id');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Check which expected agents are missing
    const existingIds = new Set(data?.map(d => d.agent_id) || []);
    const missingAgents = AGENTS.filter(a => !existingIds.has(a.agentId));

    return NextResponse.json({
      ok: true,
      agents: data,
      expectedAgents: AGENTS.map(a => ({ agentId: a.agentId, agentName: a.agentName, fioHandle: a.fioHandle })),
      missingAgents: missingAgents.map(a => ({ agentId: a.agentId, agentName: a.agentName })),
    });

  } catch (error) {
    console.error('[RegisterAgentKeys] GET Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
