export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'crypto';

/**
 * Register Multi-Chain Keys API
 * 
 * POST /api/admin/register-multichain-keys
 * 
 * Generates and registers BTC and Solana addresses for existing agents.
 * Uses deterministic derivation from EVM private key for consistency.
 * 
 * BTC: Uses testnet addresses (tb1... for SegWit)
 * SOL: Uses testnet addresses
 */

// Core agents that need multi-chain keys
const CORE_AGENTS = [
  'aigent-z',
  'aigent-moneypenny', 
  'aigent-kn0w1',
  'aigent-nakamoto',
];

// Encrypt function matching AgentKeyService
function encrypt(text: string, encryptionKey: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt function
function decrypt(encrypted: string, encryptionKey: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const { createDecipheriv } = require('crypto');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Generate BTC testnet address from seed
function generateBtcTestnetAddress(seed: string): { address: string; privateKey: string } {
  // Use the seed to create a deterministic BTC-like address
  // For testnet, we'll use a simplified approach
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(seed + '_btc').digest('hex');
  
  // Generate a testnet address format (tb1... for native SegWit)
  const addressHash = crypto.createHash('ripemd160')
    .update(crypto.createHash('sha256').update(hash).digest())
    .digest('hex');
  
  // Simplified testnet address (in production, use proper BIP84 derivation)
  const address = `tb1q${addressHash.slice(0, 38)}`;
  
  return {
    address,
    privateKey: hash, // WIF format would be used in production
  };
}

// Generate Solana testnet address from seed
function generateSolanaAddress(seed: string): { address: string; privateKey: string } {
  const crypto = require('crypto');
  
  // Generate a 32-byte seed for Solana keypair
  const hash = crypto.createHash('sha256').update(seed + '_sol').digest();
  
  // Base58 encode for Solana address format
  const bs58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let address = '';
  let num = BigInt('0x' + hash.toString('hex'));
  
  while (num > 0n) {
    const remainder = Number(num % 58n);
    address = bs58Chars[remainder] + address;
    num = num / 58n;
  }
  
  // Pad to typical Solana address length (32-44 chars)
  while (address.length < 43) {
    address = '1' + address;
  }
  
  return {
    address: address.slice(0, 44),
    privateKey: hash.toString('hex'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET || process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Missing Supabase configuration' }, { status: 500 });
    }

    if (!encryptionKey) {
      return NextResponse.json({ ok: false, error: 'Missing AGENT_KEY_ENCRYPTION_SECRET' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { agentIds, forceRegenerate } = body;

    // Filter agents if specific IDs provided
    const agentsToProcess = agentIds || CORE_AGENTS;

    const results: any[] = [];

    for (const agentId of agentsToProcess) {
      // Get existing agent record
      const { data: existing, error: fetchError } = await supabase
        .from('agent_keys')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (fetchError || !existing) {
        results.push({
          agentId,
          status: 'error',
          error: fetchError?.message || 'Agent not found',
        });
        continue;
      }

      // Check if already has BTC/SOL addresses
      if (existing.btc_address && existing.solana_address && !forceRegenerate) {
        results.push({
          agentId,
          agentName: existing.agent_name,
          fioHandle: existing.fio_handle,
          evmAddress: existing.evm_address,
          btcAddress: existing.btc_address,
          solanaAddress: existing.solana_address,
          status: 'exists',
        });
        continue;
      }

      // Get EVM private key to derive other keys deterministically
      let evmPrivateKey: string;
      try {
        evmPrivateKey = decrypt(existing.evm_private_key_encrypted, encryptionKey);
      } catch (e) {
        results.push({
          agentId,
          status: 'error',
          error: 'Failed to decrypt EVM private key',
        });
        continue;
      }

      // Generate BTC and Solana addresses deterministically from EVM key
      const btcKeys = generateBtcTestnetAddress(evmPrivateKey);
      const solKeys = generateSolanaAddress(evmPrivateKey);

      // Encrypt the new private keys
      const btcPrivateKeyEncrypted = encrypt(btcKeys.privateKey, encryptionKey);
      const solPrivateKeyEncrypted = encrypt(solKeys.privateKey, encryptionKey);

      // Update the agent record
      const { error: updateError } = await supabase
        .from('agent_keys')
        .update({
          btc_address: btcKeys.address,
          btc_private_key_encrypted: btcPrivateKeyEncrypted,
          solana_address: solKeys.address,
          solana_private_key_encrypted: solPrivateKeyEncrypted,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', agentId);

      if (updateError) {
        results.push({
          agentId,
          status: 'error',
          error: updateError.message,
        });
      } else {
        results.push({
          agentId,
          agentName: existing.agent_name,
          fioHandle: existing.fio_handle,
          evmAddress: existing.evm_address,
          btcAddress: btcKeys.address,
          solanaAddress: solKeys.address,
          status: 'updated',
        });
      }
    }

    // Summary
    const summary = {
      total: results.length,
      updated: results.filter(r => r.status === 'updated').length,
      exists: results.filter(r => r.status === 'exists').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return NextResponse.json({
      ok: true,
      summary,
      agents: results,
    });

  } catch (error) {
    console.error('[RegisterMultiChainKeys] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to check multi-chain key status
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get core agents with their chain addresses
    const { data, error } = await supabase
      .from('agent_keys')
      .select('agent_id, agent_name, fio_handle, evm_address, btc_address, solana_address')
      .in('agent_id', CORE_AGENTS)
      .order('agent_id');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Check which agents are missing multi-chain addresses
    const missingBtc = data?.filter(a => !a.btc_address) || [];
    const missingSol = data?.filter(a => !a.solana_address) || [];

    return NextResponse.json({
      ok: true,
      agents: data,
      missingBtc: missingBtc.map(a => a.agent_id),
      missingSol: missingSol.map(a => a.agent_id),
      allComplete: missingBtc.length === 0 && missingSol.length === 0,
    });

  } catch (error) {
    console.error('[RegisterMultiChainKeys] GET Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
