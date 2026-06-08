export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import fetch from 'cross-fetch';
import { exec } from 'child_process';
import { normalizePem, isPemLike } from '@/services/ops/pemNormalizer';

/**
 * Check ICP canister cycles balance via IC Management Canister
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const canisterId = searchParams.get('canisterId');
  
  // Map canister IDs to friendly names (defined outside try/catch for access in both)
  const canisterNames: Record<string, string> = {
    'sp5ye-2qaaa-aaaao-qkqla-cai': 'DVN',
    'zdjf3-2qaaa-aaaas-qck4q-cai': 'RQH',
    'lvo2w-jqaaa-aaaas-qc2wa-cai': 'RewardHub',
    'n2hhv-aaaaa-aaaas-qccza-cai': 'PoS',
    'ulvla-h7777-77774-qaacq-cai': 'PoS (Old)',
    'u6s2n-gx777-77774-qaaba-cai': 'Cross-Chain',
    'uzt4z-lp777-77774-qaabq-cai': 'EVM RPC',
    'uxrrr-q7777-77774-qaaaq-cai': 'BTC Signer'
  };
  
  const proxyUrl = process.env.CYCLES_PROXY_URL;
  const proxyKey = process.env.CYCLES_PROXY_KEY;
  
  // Helper: parse dfx canister status output to extract cycles
  const getCyclesFromDfx = async (id: string) => {
    return await new Promise<{
      cyclesNum: number;
      cyclesDisplay: string;
      status: 'good' | 'low' | 'critical';
    }>((resolve, reject) => {
      exec(`DFX_WARNING=-mainnet_plaintext_identity dfx canister status ${id} --network ic`,
        { timeout: 15_000 },
        (error, stdout) => {
          if (error) return reject(error);

          const balanceLine = stdout
            .split('\n')
            .find(line => line.trim().startsWith('Balance:'));

          if (!balanceLine) return reject(new Error('No Balance line in dfx output'));

          // Example: "Balance: 5_006_597_943_131 Cycles"
          const parts = balanceLine.replace('Balance:', '').trim().split(' ');
          const numeric = (parts[0] || '').replace(/_/g, '');
          const cyclesNum = Number(numeric);
          if (!Number.isFinite(cyclesNum)) return reject(new Error('Failed to parse cycles from dfx'));

          const trillion = 1_000_000_000_000;
          const cyclesInTrillions = cyclesNum / trillion;

          let status: 'good' | 'low' | 'critical';
          if (cyclesInTrillions >= 2) status = 'good';
          else if (cyclesInTrillions >= 0.5) status = 'low';
          else status = 'critical';

          const cyclesDisplay = cyclesInTrillions >= 1
            ? `${cyclesInTrillions.toFixed(2)}T cycles`
            : `${(cyclesNum / 1_000_000_000).toFixed(2)}B cycles`;

          resolve({ cyclesNum, cyclesDisplay, status });
        });
    });
  };

  try {
    if (!canisterId) {
      return new Response(JSON.stringify({
        ok: false,
        error: "canisterId parameter required"
      }), { status: 400 });
    }
    
    // 1) Try external dfx proxy if configured (used in Amplify/cloud)
    if (proxyUrl && proxyKey) {
      try {
        const url = `${proxyUrl.replace(/\/$/, '')}/ic/cycles?canisterId=${encodeURIComponent(canisterId)}`;
        const resp = await fetch(url, {
          headers: {
            'x-api-key': proxyKey
          }
        });
        if (resp.ok) {
          const data: any = await resp.json();
          if (data?.ok && typeof data.cyclesRaw === 'number') {
            const canisterName = canisterNames[canisterId] || 'Unknown';
            return new Response(JSON.stringify({
              ok: true,
              canisterId,
              name: canisterName,
              cycles: data.cycles,
              cyclesRaw: data.cyclesRaw,
              status: data.status || 'good',
              canisterStatus: data.canisterStatus || 'running',
              memorySize: data.memorySize ?? null,
              lastChecked: new Date().toISOString(),
              source: 'dfx-proxy'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch {
        // ignore proxy failures and fall back to local logic
      }
    }

    // 2) Try local dfx canister status (controller identity, used on dev laptop)
    try {
      const { cyclesNum, cyclesDisplay, status } = await getCyclesFromDfx(canisterId);
      const canisterName = canisterNames[canisterId] || 'Unknown';

      return new Response(JSON.stringify({
        ok: true,
        canisterId,
        name: canisterName,
        cycles: cyclesDisplay,
        cyclesRaw: cyclesNum,
        status,
        canisterStatus: 'running',
        memorySize: null,
        lastChecked: new Date().toISOString(),
        source: 'dfx'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // If local dfx fails (not installed / not on this host), fall back to management canister
    }

    // 3) IC Management Canister interface for canister_status (last resort)
    const managementCanisterIdl = ({ IDL }: any) => {
      const CanisterId = IDL.Principal;
      const CanisterStatusResult = IDL.Record({
        status: IDL.Variant({
          running: IDL.Null,
          stopping: IDL.Null,
          stopped: IDL.Null,
        }),
        settings: IDL.Record({
          controllers: IDL.Vec(IDL.Principal),
          compute_allocation: IDL.Nat,
          memory_allocation: IDL.Nat,
          freezing_threshold: IDL.Nat,
        }),
        module_hash: IDL.Opt(IDL.Vec(IDL.Nat8)),
        memory_size: IDL.Nat,
        cycles: IDL.Nat,
        idle_cycles_burned_per_day: IDL.Nat,
      });
      return IDL.Service({
        canister_status: IDL.Func(
          [IDL.Record({ canister_id: CanisterId })],
          [CanisterStatusResult],
          [],
        ),
      });
    };

    // Create agent with identity if available
    const isLocal = (process.env.DFX_NETWORK || '').toLowerCase() === 'local';
    const isMainnet = (process.env.DFX_NETWORK || 'ic').toLowerCase() === 'ic';
    let host = isLocal ? 'http://127.0.0.1:4943' : (isMainnet ? 'https://ic0.app' : 'https://icp-api.io');

    let identity: any = undefined;
    let pem: string | null = normalizePem(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM);
    const pemPath = process.env.DFX_IDENTITY_PEM_PATH;
    if (!pem && pemPath) {
      try {
        const { readFileSync } = await import('fs');
        pem = normalizePem(readFileSync(pemPath, 'utf8'));
      } catch {
        // ignore file read errors and fall back to anonymous
      }
    }
    if (isPemLike(pem)) {
      try {
        const idMod: any = await import('@dfinity/identity');
        if (idMod?.Ed25519KeyIdentity?.fromPem) {
          try { identity = idMod.Ed25519KeyIdentity.fromPem(pem); } catch {}
        }
        if (!identity && idMod?.Secp256k1KeyIdentity?.fromPem) {
          try { identity = idMod.Secp256k1KeyIdentity.fromPem(pem); } catch {}
        }
      } catch {
        // identity module not available; continue anonymously
      }
    }

    const agent = new HttpAgent({ host, ...(identity ? { identity } : {}), fetch: fetch as any });

    if (host.includes('127.0.0.1') || host.includes('localhost')) {
      try {
        await agent.fetchRootKey();
      } catch (e) {
        console.warn('Failed to fetch root key:', e);
      }
    }

    // Create management canister actor
    const managementCanister = Actor.createActor(managementCanisterIdl, {
      agent,
      canisterId: 'aaaaa-aa', // IC Management Canister ID
    });

    // Call canister_status
    const statusResult: any = await managementCanister.canister_status({
      canister_id: Principal.fromText(canisterId)
    });

    // Convert cycles to human-readable format
    const cyclesNum = Number(statusResult.cycles);
    const trillion = 1_000_000_000_000;
    const cyclesInTrillions = cyclesNum / trillion;
    
    // Determine status based on cycles
    let cyclesStatus: 'good' | 'low' | 'critical';
    if (cyclesInTrillions >= 2) {
      cyclesStatus = 'good';
    } else if (cyclesInTrillions >= 0.5) {
      cyclesStatus = 'low';
    } else {
      cyclesStatus = 'critical';
    }

    const canisterName = canisterNames[canisterId] || 'Unknown';

    return new Response(JSON.stringify({
      ok: true,
      canisterId,
      name: canisterName,
      cycles: cyclesInTrillions >= 1 
        ? `${cyclesInTrillions.toFixed(2)}T cycles` 
        : `${(cyclesNum / 1_000_000_000).toFixed(2)}B cycles`,
      cyclesRaw: cyclesNum,
      status: cyclesStatus,
      canisterStatus: Object.keys(statusResult.status || {})[0] || 'unknown', // running, stopping, stopped
      memorySize: Number(statusResult.memory_size || 0),
      lastChecked: new Date().toISOString()
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Check Canister Cycles] Error:', error);
    
    const errorMessage = error.message || 'Failed to check canister cycles';
    
    // If we don't have controller permissions, provide helpful fallback
    if (canisterId && (errorMessage.includes('canister_not_found') || errorMessage.includes('not authorized'))) {
      const canisterName = canisterNames[canisterId] || 'Unknown';
      
      // Check if we have an identity configured
      const hasIdentity = !!(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM);
      const identityNote = hasIdentity 
        ? 'Identity configured but not a controller. Run: dfx canister info ' + canisterId + ' --network ic'
        : 'No identity configured. Set DFX_IDENTITY_PEM in .env.local';
      
      return new Response(JSON.stringify({
        ok: true,
        canisterId,
        name: canisterName,
        cycles: 'Unable to verify',
        status: 'unknown',
        canisterStatus: 'unknown',
        lastChecked: new Date().toISOString(),
        note: `Cycle balance cannot be read — ${identityNote}. The canister may be running but update calls (DVN submissions) require cycles. Use dfx canister status ${canisterId} --network ic from a controller identity to check.`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      ok: false,
      error: errorMessage,
      canisterId
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
