/**
 * GET /api/ops/canisters/cycles-status
 *
 * Returns cycle balances + alert thresholds for all monitored ICP canisters.
 * Also returns the server identity principal and ICP ledger balance so the
 * operator knows if top-ups are possible from the web UI.
 *
 * Admin-gated via getActivePersona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import fetch from 'cross-fetch';
import { normalizePem, isPemLike } from '@/services/ops/pemNormalizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONITORED_CANISTERS = [
  { id: 'sp5ye-2qaaa-aaaao-qkqla-cai', name: 'DVN', role: 'DVN anchoring' },
  { id: 'zdjf3-2qaaa-aaaas-qck4q-cai', name: 'RQH', role: 'Reputation Hub' },
  { id: 'lvo2w-jqaaa-aaaas-qc2wa-cai', name: 'RewardHub', role: 'Reward Hub' },
];

const THRESHOLDS = {
  critical: 0.5e12,
  low: 2e12,
  healthy: 5e12,
};

interface CanisterCyclesInfo {
  canisterId: string;
  name: string;
  role: string;
  cycles: number | null;
  cyclesDisplay: string;
  status: 'good' | 'low' | 'critical' | 'unknown';
  alert: string | null;
}

interface CyclesStatusResponse {
  ok: boolean;
  canisters: CanisterCyclesInfo[];
  identity: {
    configured: boolean;
    type: 'ed25519' | 'secp256k1' | 'anonymous';
    principal: string | null;
  };
  walletCanisterId: string | null;
  thresholds: typeof THRESHOLDS;
  at: string;
}

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

function formatCycles(cycles: number): string {
  if (cycles >= 1e12) return `${(cycles / 1e12).toFixed(2)}T`;
  return `${(cycles / 1e9).toFixed(2)}B`;
}

function cycleStatus(cycles: number): 'good' | 'low' | 'critical' {
  if (cycles >= THRESHOLDS.low) return 'good';
  if (cycles >= THRESHOLDS.critical) return 'low';
  return 'critical';
}

function cycleAlert(name: string, display: string, status: 'good' | 'low' | 'critical'): string | null {
  if (status === 'critical') return `CRITICAL: ${name} has ${display} — update calls will fail`;
  if (status === 'low') return `LOW: ${name} has ${display} — top up soon`;
  return null;
}

async function detectIdentity(): Promise<CyclesStatusResponse['identity']> {
  const pem = normalizePem(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM);
  if (!isPemLike(pem)) {
    return { configured: false, type: 'anonymous', principal: null };
  }
  try {
    const idMod = await import('@dfinity/identity');
    const ed = idMod.Ed25519KeyIdentity?.fromPem;
    if (ed) {
      try {
        const id = ed(pem);
        const principal = id.getPrincipal().toText();
        return { configured: true, type: 'ed25519', principal };
      } catch { /* try next */ }
    }
    const sk = idMod.Secp256k1KeyIdentity?.fromPem;
    if (sk) {
      try {
        const id = sk(pem);
        const principal = id.getPrincipal().toText();
        return { configured: true, type: 'secp256k1', principal };
      } catch { /* fallthrough */ }
    }
  } catch {
    /* identity module unavailable */
  }
  return { configured: false, type: 'anonymous', principal: null };
}

async function buildAgent(): Promise<{ agent: HttpAgent; identity: any }> {
  const isLocal = (process.env.DFX_NETWORK || '').toLowerCase() === 'local';
  const isMainnet = (process.env.DFX_NETWORK || 'ic').toLowerCase() === 'ic';
  let host = isLocal ? 'http://127.0.0.1:4943' : (isMainnet ? 'https://ic0.app' : 'https://icp-api.io');

  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const resp = await (fetch as any)(`${host}/api/v2/status`, { method: 'GET', cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!resp?.ok) throw new Error('Local replica status not OK');
    } catch {
      host = isMainnet ? 'https://ic0.app' : 'https://icp-api.io';
    }
  }

  let identity: any = undefined;
  let pem: string | null = normalizePem(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM);
  const pemPath = process.env.DFX_IDENTITY_PEM_PATH;
  if (!pem && pemPath && typeof window === 'undefined') {
    try {
      const { readFileSync } = await import('fs');
      pem = normalizePem(readFileSync(pemPath, 'utf8'));
    } catch { /* ignore */ }
  }
  if (isPemLike(pem)) {
    try {
      const idMod: any = await import('@dfinity/identity');
      if (idMod?.Ed25519KeyIdentity?.fromPem) {
        try { identity = idMod.Ed25519KeyIdentity.fromPem(pem); } catch { /* try next */ }
      }
      if (!identity && idMod?.Secp256k1KeyIdentity?.fromPem) {
        try { identity = idMod.Secp256k1KeyIdentity.fromPem(pem); } catch { /* fallthrough */ }
      }
    } catch { /* identity module not available */ }
  }

  const agent = new HttpAgent({ host, ...(identity ? { identity } : {}), fetch: fetch as any });

  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    try {
      await agent.fetchRootKey();
    } catch { /* ignore */ }
  }

  return { agent, identity };
}

const CANISTER_STATUS_TIMEOUT_MS = 15_000;

async function queryCycles(
  agent: HttpAgent,
  canisterId: string,
): Promise<{ cycles: number } | { error: string }> {
  try {
    const mgmt = Actor.createActor(managementCanisterIdl, {
      agent,
      canisterId: 'aaaaa-aa',
    });

    const result: any = await Promise.race([
      (mgmt as any).canister_status({ canister_id: Principal.fromText(canisterId) }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`canister_status timed out after ${CANISTER_STATUS_TIMEOUT_MS}ms`)),
          CANISTER_STATUS_TIMEOUT_MS,
        ),
      ),
    ]);

    const raw = result?.cycles;
    const cycles = typeof raw === 'bigint' ? Number(raw) : (typeof raw === 'number' ? raw : null);
    if (cycles === null) {
      return { error: `Unexpected cycles type: ${typeof raw}` };
    }
    return { cycles };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<CyclesStatusResponse | { error: string; detail?: string }>> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!context.cartridgeFlags?.isAdmin) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'Admin-only diagnostic.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [identityInfo, agentResult] = await Promise.all([
    detectIdentity(),
    buildAgent(),
  ]);

  const { agent } = agentResult;

  const canisterResults = await Promise.all(
    MONITORED_CANISTERS.map(async (c): Promise<CanisterCyclesInfo> => {
      const result = await queryCycles(agent, c.id);

      if ('error' in result) {
        return {
          canisterId: c.id,
          name: c.name,
          role: c.role,
          cycles: null,
          cyclesDisplay: 'unknown',
          status: 'unknown',
          alert: `${c.name}: cycle balance could not be verified`,
        };
      }

      const status = cycleStatus(result.cycles);
      const display = formatCycles(result.cycles);
      return {
        canisterId: c.id,
        name: c.name,
        role: c.role,
        cycles: result.cycles,
        cyclesDisplay: display,
        status,
        alert: cycleAlert(c.name, display, status),
      };
    }),
  );

  const walletCanisterId =
    process.env.WALLET_CANISTER_ID ||
    process.env.NEXT_PUBLIC_WALLET_CANISTER_ID ||
    null;

  const allOk = canisterResults.every((c) => c.status === 'good');

  const response: CyclesStatusResponse = {
    ok: allOk,
    canisters: canisterResults,
    identity: identityInfo,
    walletCanisterId,
    thresholds: THRESHOLDS,
    at: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
