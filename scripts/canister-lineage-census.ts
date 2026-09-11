/**
 * CANISTER LINEAGE CENSUS — read-only (operator directive, 2026-08-08).
 *
 * Establishes, for every historical proof_of_state / btc_signer identity, what
 * it actually IS: a local dfx canister, a live IC canister, or an id that was
 * promoted into mainnet configuration without ever being deployed there.
 *
 * WHY THIS IS NOT OPTIONAL. `proof_of_state::anchor()` hardcodes
 * `let btc_canister_id = "uxrrr-q7777-77774-qaaaq-cai";` and falls back to a
 * synthesised txid when that inter-canister call fails. If that principal does
 * not exist on the IC, the mock branch is not a lazy placeholder — it is the
 * ERROR PATH firing on every single anchor, forever. Which of those two stories
 * is true changes the repair entirely, and only the live network can settle it.
 *
 * MUTATES NOTHING. `read_state` for module hashes (a certified read) and one
 * query per canister for its Candid interface. No update calls.
 */

import { HttpAgent, Actor, CanisterStatus, type Agent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createHash } from 'crypto';

const IC_HOST = process.env.IC_HOST || 'https://icp-api.io';

interface Candidate {
  name: string;
  canisterId: string;
  /** What the repo history CLAIMS this id is. */
  claimed: string;
  /** Where that claim comes from. */
  claimSource: string;
}

/**
 * Every proof_of_state / btc_signer identity found in the two repos' history,
 * plus the sibling canisters needed to interpret them. Ids and their claimed
 * roles are quoted from the commits named in `claimSource` — none is inferred.
 */
const CANDIDATES: Candidate[] = [
  {
    name: 'proof_of_state',
    canisterId: 'n2hhv-aaaaa-aaaas-qccza-cai',
    claimed: 'IC mainnet — "Fresh IC Mainnet", deployed via GitHub Actions CI/CD',
    claimSource: 'iQubeBeta-Program cd7039b (2025-10-05) progress report',
  },
  {
    name: 'proof_of_state',
    canisterId: 'umunu-kh777-77774-qaaca-cai',
    claimed: 'LOCAL dfx replica',
    claimSource: 'iQubeBeta-Program .dfx/local/canister_ids.json @ cebf998 (2025-09-22)',
  },
  {
    name: 'btc_signer_psbt',
    canisterId: 'uxrrr-q7777-77774-qaaaq-cai',
    claimed:
      'CONTESTED: .dfx/local says LOCAL; env config at a88bc3a labels it "Bitcoin Signer - LIVE MAINNET"; ' +
      'proof_of_state::anchor() hardcodes it as its inter-canister callee',
    claimSource: 'iQubeBeta-Program cebf998 (.dfx local) vs a88bc3a (env "LIVE MAINNET")',
  },
  {
    name: 'cross_chain_service',
    canisterId: 'sp5ye-2qaaa-aaaao-qkqla-cai',
    claimed: 'IC mainnet — "NEW DVN, Live"; the only entry in canister_ids.json under "ic"',
    claimSource: 'iQubeBeta-Program canister_ids.json (HEAD) + cd7039b',
  },
  {
    name: 'cross_chain_service',
    canisterId: 'u6s2n-gx777-77774-qaaba-cai',
    claimed: 'LOCAL dfx replica',
    claimSource: 'iQubeBeta-Program .dfx/local/canister_ids.json @ cebf998',
  },
  {
    name: 'evm_rpc',
    canisterId: 'uzt4z-lp777-77774-qaabq-cai',
    claimed: 'CONTESTED: .dfx/local says LOCAL; env config at a88bc3a labels it "EVM RPC - LIVE MAINNET"',
    claimSource: 'iQubeBeta-Program cebf998 (.dfx local) vs a88bc3a (env "LIVE MAINNET")',
  },
  {
    name: 'evm_rpc',
    canisterId: '7hfb6-caaaa-aaaar-qadga-cai',
    claimed: 'IC mainnet (recorded in AigentZBeta canisterSourceManifest)',
    claimSource: 'AigentZBeta services/ops/canisterSourceManifest.ts',
  },
  {
    name: 'solana_signer_ed25519',
    canisterId: 'ulvla-h7777-77774-qaacq-cai',
    claimed: 'LOCAL dfx replica (was __Candid_UI at 7ad1683, solana_signer at cebf998)',
    claimSource: 'iQubeBeta-Program .dfx/local/canister_ids.json',
  },
];

/**
 * A local dfx principal is structurally recognisable: the local replica mints
 * ids from a small fixed range, which render with the `-77774-` group. This is
 * a HEURISTIC used only to explain a result, never to decide one — reachability
 * on the IC is the actual test below.
 */
function looksLocalDfx(id: string): boolean {
  return id.includes('-77774-');
}

async function moduleHash(agent: Agent, canisterId: string): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  try {
    // `CanisterStatus.request` is the supported certified-read path. A
    // hand-rolled readState + Certificate.lookup was tried first and failed
    // with "cert.lookup is not a function" on this agent version — reported
    // here rather than left as a silent gap, because the module hash IS the
    // A4 activation gate.
    const status = await CanisterStatus.request({
      canisterId: Principal.fromText(canisterId),
      agent,
      paths: ['module_hash'],
    });
    const raw = status.get('module_hash');
    if (raw === null || raw === undefined) {
      return { ok: false, error: 'module_hash absent — canister exists but holds no wasm (empty/stopped)' };
    }
    // Already a hex STRING on this agent version. An earlier version ran
    // Buffer.from(raw).toString('hex') on it and produced '' — printing an
    // empty hash for three live canisters while reporting ok:true. Exactly the
    // read-failure-as-empty-result defect this whole investigation exists to
    // eliminate, reproduced in the tool doing the investigating.
    if (typeof raw === 'string') {
      return /^[0-9a-f]{64}$/.test(raw)
        ? { ok: true, hash: raw }
        : { ok: false, error: `module_hash was a string but not 64-hex: ${JSON.stringify(raw).slice(0, 80)}` };
    }
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
    const hex = Buffer.from(bytes).toString('hex');
    return hex.length === 64 ? { ok: true, hash: hex } : { ok: false, error: `decoded module_hash was ${hex.length} chars, expected 64` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: /canister_not_found/.test(msg) ? 'canister_not_found' : msg.split('\n')[0].slice(0, 120) };
  }
}

async function liveCandid(agent: Agent, canisterId: string): Promise<{ ok: true; sha256: string; methods: number } | { ok: false; error: string }> {
  try {
    const actor = Actor.createActor<{ __get_candid_interface_tmp_hack: () => Promise<string> }>(
      ({ IDL }) => IDL.Service({ __get_candid_interface_tmp_hack: IDL.Func([], [IDL.Text], ['query']) }),
      { agent, canisterId },
    );
    const did = await actor.__get_candid_interface_tmp_hack();
    return {
      ok: true,
      sha256: createHash('sha256').update(did, 'utf8').digest('hex'),
      methods: (did.match(/^\s*\w+\s*:\s*\(/gm) ?? []).length,
    };
  } catch (err) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 160) };
  }
}

async function main() {
  console.log(`IC host: ${IC_HOST}\n`);
  const agent = await HttpAgent.create({ host: IC_HOST });

  const rows: Array<Record<string, string>> = [];

  for (const c of CANDIDATES) {
    process.stdout.write(`probing ${c.name} ${c.canisterId} … `);
    const [mh, cd] = await Promise.all([moduleHash(agent, c.canisterId), liveCandid(agent, c.canisterId)]);
    const reachable = mh.ok || cd.ok;
    console.log(reachable ? 'REACHABLE' : 'unreachable');

    rows.push({
      name: c.name,
      canisterId: c.canisterId,
      classification: reachable
        ? 'LIVE on IC'
        : looksLocalDfx(c.canisterId)
          ? 'NOT ON IC — local-dfx-shaped principal'
          : 'NOT ON IC — unknown',
      moduleHash: mh.ok ? mh.hash : `— (${mh.error})`,
      candidSha256: cd.ok ? `${cd.sha256.slice(0, 16)}… (${cd.methods} methods)` : `— (${cd.error})`,
      claimed: c.claimed,
      claimSource: c.claimSource,
    });
  }

  console.log('\n\n════════ CANISTER LINEAGE CENSUS ════════\n');
  for (const r of rows) {
    console.log(`── ${r.name} · ${r.canisterId}`);
    console.log(`   classification : ${r.classification}`);
    console.log(`   module hash    : ${r.moduleHash}`);
    console.log(`   live candid    : ${r.candidSha256}`);
    console.log(`   repo claims    : ${r.claimed}`);
    console.log(`   claim source   : ${r.claimSource}\n`);
  }

  const contested = rows.filter((r) => r.claimed.startsWith('CONTESTED'));
  console.log('════════ CONTESTED IDENTITIES ════════\n');
  for (const r of contested) {
    const promoted = r.classification.startsWith('NOT ON IC');
    console.log(
      `${r.canisterId} (${r.name}): ${
        promoted
          ? 'CONFIRMED PROMOTION DEFECT — labelled "LIVE MAINNET" in env config but NOT REACHABLE on the IC. ' +
            'Every call to it from a mainnet canister fails.'
          : 'reachable on the IC — the "LIVE MAINNET" label is corroborated; no promotion defect.'
      }`,
    );
  }

  console.log('\nCensus complete. read_state + query calls only — nothing was mutated.');
}

main().catch((err) => {
  console.error('census failed:', err);
  process.exit(1);
});
