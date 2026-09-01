/**
 * Implementation singularity / bypass protection for `ctp.wallet.asset.convert`
 * (2026-09-01, CTP Slice C, delivery amendment §2.5) — the same source-level
 * canary convention as tests/ctp-channel-singularity.test.ts, adapted for
 * this primitive's ONE permitted channel (web).
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/wallet/qct/convert/usdc-to-qc/route.ts';
const PRIMITIVE = 'services/ctp/primitives/walletAssetConvert.ts';
const LEDGER_SERVICE = 'services/wallet/qctLedgerService.ts';

describe('the web route invokes the Constitutional Runtime — never a direct wallet mutation', () => {
  const src = stripComments(readSource(ROUTE));

  it('imports constitutionalRuntime and the primitive registration side-effect', () => {
    expect(src).toMatch(/from '@\/services\/ctp\/constitutionalRuntime'/);
    expect(src).toMatch(/import '@\/services\/ctp\/primitives\/walletAssetConvert'/);
  });

  it('does NOT import debitWalletAsset/creditWalletAsset/convertWalletAsset directly', () => {
    expect(src).not.toMatch(/debitWalletAsset/);
    expect(src).not.toMatch(/creditWalletAsset/);
    expect(src).not.toMatch(/convertWalletAsset/);
  });

  it("dispatches through constitutionalRuntime.execute with primitiveId 'ctp.wallet.asset.convert' and channel 'web'", () => {
    expect(src).toMatch(/constitutionalRuntime\.execute\(/);
    expect(src).toMatch(/'ctp\.wallet\.asset\.convert'/);
    expect(src).toMatch(/channel:\s*'web'/);
  });

  it('resolves the wallet subject exclusively from getActivePersona — never a body-supplied personaId', () => {
    expect(src).toMatch(/getActivePersona\(request\)/);
    expect(src).not.toMatch(/body\.personaId/);
    expect(src).not.toMatch(/\{\s*personaId\s*,/); // no destructured body personaId anywhere
  });
});

describe('exactly ONE canonical implementation binding exists for ctp.wallet.asset.convert', () => {
  it('the primitive module is the ONLY place registerPrimitive is called for this primitive, and it binds the real ledger service function', () => {
    const src = stripComments(readSource(PRIMITIVE));
    const registerCalls = (src.match(/registerPrimitive\(/g) ?? []).length;
    expect(registerCalls).toBe(1);
    expect(src).toMatch(/implementationRef:\s*IMPLEMENTATION_REF/);
    expect(src).toMatch(/const IMPLEMENTATION_REF = 'services\/wallet\/qctLedgerService\.ts#convertWalletAsset'/);
  });

  it('convertWalletAsset itself is exported exactly once from qctLedgerService.ts — no sibling reimplementation, and it calls the atomic RPC exactly once, never separate debit/credit', () => {
    const src = stripComments(readSource(LEDGER_SERVICE));
    const defs = (src.match(/export async function convertWalletAsset\(/g) ?? []).length;
    expect(defs).toBe(1);
    const fnStart = src.indexOf('export async function convertWalletAsset(');
    const fnEnd = src.indexOf('\nexport async function debitWalletAsset(', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    const rpcCalls = (fnBody.match(/supabase\.rpc\(/g) ?? []).length;
    expect(rpcCalls).toBe(1);
    expect(fnBody).toMatch(/supabase\.rpc\('convert_wallet_asset'/);
    expect(fnBody).not.toMatch(/debitWalletAsset\(/);
    expect(fnBody).not.toMatch(/creditWalletAsset\(/);
  });
});

describe('the primitive is principal-only — structurally, not by convention', () => {
  it('delegability is false and actorRequirement excludes AUTHORIZED_DELEGATE', () => {
    const src = stripComments(readSource(PRIMITIVE));
    expect(src).toMatch(/delegability:\s*false/);
    expect(src).not.toMatch(/AUTHORIZED_DELEGATE/);
  });
});
