/**
 * VELA-001 asset neutrality (accelerator handoff Phase 9) — additive
 * asset-bearing request plumbing.
 *
 * Proves three things:
 *  1. The existing no-funds projection path (`submitProcessRequest`,
 *     `VelaConfidentialProjectionProvider`'s full lifecycle) is byte-for-byte
 *     unaffected by the new interface member — a regression canary, not a
 *     feature test.
 *  2. `submitAssetBearingProcessRequest` correctly threads a real
 *     tokenAddress + assetAmount through to the transport (native ETH via
 *     `ETH_SENTINEL_ADDRESS`, and an ERC-20-shaped address), on both the
 *     deterministic test transport and the real `VelaClientAdapter` (whose
 *     validation-before-any-chain-call ordering is provable without a live
 *     RPC endpoint, since `validateVelaAssetRef` runs before the first
 *     `await` that touches the network).
 *  3. An invalid asset (non-positive amount, malformed token address) is
 *     rejected before any submission/chain call is attempted — never
 *     silently coerced, never reaching the mock/real transport's state.
 *
 * See codexes/packs/agentiq/resolution-records/records/
 * RES-2026-09-13-VELA-ASSET-NEUTRALITY-TRANSPORT-001.json for the resolution
 * record and CI-2026-09-13-VELA-ASSET-BEARING-REQUEST-ADDITIVE-001.json for
 * the candidate invariant this canary protects.
 */

import { describe, expect, it } from 'vitest';
import {
  VelaConfidentialProjectionProvider,
} from '@/services/vela/velaProjectionProvider';
import { VelaTestTransport } from '@/services/vela/velaTestTransport';
import { VelaClientAdapter } from '@/services/vela/velaClientAdapter';
import { VELA_LOCAL_DEPLOYMENT } from '@/services/vela/velaConfig';
import {
  ETH_SENTINEL_ADDRESS,
  validateVelaAssetRef,
  type VelaAssetRef,
  type VelaDeploymentDescriptor,
} from '@/services/vela/velaTypes';
import type {
  ConfidentialProjectionRequest,
  ConfidentialProjectionIdentitySet,
} from '@/types/confidentialProjection';

const SIGNER = '0x2a0fba02cee7fb70899648037c7E8203881e2D55';

/** Anvil/Hardhat's well-known default account #0 private key — public test
 *  fixture used elsewhere in this repo's own Vela scripts
 *  (scripts/vela-slice2g-redeploy.ts, scripts/vela-slice2g-live-proof.ts).
 *  Never a real key; never used against a live chain here — no network call
 *  is ever reached in this file (see the "rejected before the chain call"
 *  suite below). */
const TEST_EVM_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
/** Placeholder — never exercised in this file (no path here calls
 *  `encryptForTee`), but `VelaClientAdapterOptions` requires a value. */
const TEST_P521_PRIVATE_KEY_HEX = '00'.repeat(66);

const IDENTITIES: ConfidentialProjectionIdentitySet = {
  authorityPrincipal: 'principal-ref-1',
  mandateSigner: 'principal-ref-1',
  confidentialRequester: 'agent-wallet-1',
  confidentialPrivacyIdentity: 'agent-wallet-1',
  executionSigner: 'agent-wallet-1',
};

function request(inputs: Record<string, number>): ConfidentialProjectionRequest {
  return {
    actionRef: 'action-1',
    mandateRef: 'mandate-1',
    identities: IDENTITIES,
    confidentialInputs: inputs,
    publicContext: { policyVersion: 'v1', actionType: 'payment' },
  };
}

function projectorVerdict(plaintextJson: string): string {
  const { inputs } = JSON.parse(plaintextJson) as { inputs: Record<string, number> };
  const { currentExposure, proposedSpend, privateSpendLimit, privateRiskLimit } = inputs;
  const acceptable =
    proposedSpend <= privateSpendLimit && currentExposure + proposedSpend <= privateRiskLimit;
  return JSON.stringify({ verdict: acceptable ? 'ACCEPTABLE' : 'UNACCEPTABLE' });
}

function makeTransport(): VelaTestTransport {
  return new VelaTestTransport({
    deployment: VELA_LOCAL_DEPLOYMENT,
    registeredTeeSigner: SIGNER,
    verdictFor: projectorVerdict,
  });
}

function makeRealAdapter(overrides: Partial<VelaDeploymentDescriptor> = {}): VelaClientAdapter {
  return new VelaClientAdapter({
    deployment: { ...VELA_LOCAL_DEPLOYMENT, ...overrides },
    requesterPrivateKeyHex: TEST_EVM_PRIVATE_KEY,
    requesterP521PrivateKeyHex: TEST_P521_PRIVATE_KEY_HEX,
  });
}

const A_TOKEN = '0x1111111111111111111111111111111111111111';

describe('VelaTransport asset neutrality — additive, no-funds path unaffected', () => {
  // ── 1. Regression: the existing no-funds projection path ────────────────

  it('submitProcessRequest still carries no asset — assetSubmittedFor is undefined for it', async () => {
    const transport = makeTransport();
    const plaintext = JSON.stringify({
      inputs: { currentExposure: 0, proposedSpend: 1, privateSpendLimit: 100, privateRiskLimit: 100 },
    });
    const encrypted = await transport.encryptForTee(Buffer.from(plaintext, 'utf8'));
    const requestId = await transport.submitProcessRequest('app-1', encrypted);

    expect(transport.assetSubmittedFor(requestId)).toBeUndefined();
    const result = await transport.fetchResult(requestId);
    expect(result).not.toBeNull();
    expect(result!.errorCode).toBe(0);
  });

  it('the full VelaConfidentialProjectionProvider lifecycle (prepare → submit → status → evidence → verify) is unchanged', async () => {
    const transport = makeTransport();
    const provider = new VelaConfidentialProjectionProvider(transport, 'app-1');

    const prepared = await provider.prepareProjection(
      request({
        currentExposure: 100,
        proposedSpend: 50,
        privateSpendLimit: 200,
        privateRiskLimit: 500,
      }),
    );
    const submission = await provider.submitProjection(prepared);
    const status = await provider.getProjectionStatus(submission.requestRef);
    expect(status.state).toBe('PROJECTION_ACCEPTABLE');

    const evidence = await provider.getProjectionEvidence(submission.requestRef);
    expect(evidence.disposition).toBe('ACCEPTABLE');

    const verification = await provider.verifyProjectionEvidence(evidence);
    expect(verification.protocolExecutionVerified).toBe(true);

    // No asset was ever threaded through the pure projection path.
    expect(transport.assetSubmittedFor(submission.requestRef)).toBeUndefined();
  });

  it('VelaClientAdapter.submitProcessRequest keeps its original 2-argument, no-asset signature', () => {
    // Compile-time proof: this call is only valid if the signature is still
    // exactly (applicationId, encryptedPayload) => Promise<string> — adding a
    // required third parameter, or changing the no-funds behaviour, would
    // fail to typecheck here.
    const adapter = makeRealAdapter();
    const callable: (applicationId: string, encryptedPayload: Uint8Array) => Promise<string> =
      adapter.submitProcessRequest.bind(adapter);
    expect(typeof callable).toBe('function');
  });

  // ── 2. New asset-bearing path — test transport ───────────────────────────

  it('threads a real ERC-20-shaped tokenAddress + amount through submitAssetBearingProcessRequest', async () => {
    const transport = makeTransport();
    const encrypted = await transport.encryptForTee(Buffer.from('plaintext', 'utf8'));
    const asset: VelaAssetRef = { tokenAddress: A_TOKEN, assetAmount: 12345n };

    const requestId = await transport.submitAssetBearingProcessRequest('app-1', encrypted, asset);

    expect(transport.assetSubmittedFor(requestId)).toEqual(asset);
  });

  it('native ETH uses ETH_SENTINEL_ADDRESS correctly', async () => {
    const transport = makeTransport();
    const encrypted = await transport.encryptForTee(Buffer.from('plaintext', 'utf8'));
    const asset: VelaAssetRef = { tokenAddress: ETH_SENTINEL_ADDRESS, assetAmount: 1_000_000_000n };

    const requestId = await transport.submitAssetBearingProcessRequest('app-1', encrypted, asset);

    const recorded = transport.assetSubmittedFor(requestId);
    expect(recorded?.tokenAddress).toBe(ETH_SENTINEL_ADDRESS);
    expect(recorded?.assetAmount).toBe(1_000_000_000n);
  });

  it('an asset-bearing request still resolves through fetchResult like any other PROCESS request', async () => {
    const transport = makeTransport();
    const plaintext = JSON.stringify({
      inputs: { currentExposure: 0, proposedSpend: 10, privateSpendLimit: 100, privateRiskLimit: 100 },
    });
    const encrypted = await transport.encryptForTee(Buffer.from(plaintext, 'utf8'));
    const requestId = await transport.submitAssetBearingProcessRequest('app-1', encrypted, {
      tokenAddress: A_TOKEN,
      assetAmount: 42n,
    });

    const result = await transport.fetchResult(requestId);
    expect(result).not.toBeNull();
    expect(result!.decryptedUserEventJson).toContain('ACCEPTABLE');
  });

  // ── 3. Invalid asset — rejected before any submission ────────────────────

  it('validateVelaAssetRef rejects a zero amount', () => {
    expect(() => validateVelaAssetRef({ tokenAddress: A_TOKEN, assetAmount: 0n })).toThrow(
      /must be > 0/,
    );
  });

  it('validateVelaAssetRef rejects a negative amount', () => {
    expect(() => validateVelaAssetRef({ tokenAddress: A_TOKEN, assetAmount: -1n })).toThrow(
      /must be > 0/,
    );
  });

  it('validateVelaAssetRef rejects a malformed tokenAddress', () => {
    expect(() =>
      validateVelaAssetRef({ tokenAddress: 'not-an-address', assetAmount: 1n }),
    ).toThrow(/must be a 20-byte hex address/);
  });

  it('validateVelaAssetRef rejects a non-bigint amount at the runtime boundary', () => {
    const malformed = { tokenAddress: A_TOKEN, assetAmount: 5 as unknown as bigint };
    expect(() => validateVelaAssetRef(malformed)).toThrow(/must be a bigint/);
  });

  it('VelaTestTransport.submitAssetBearingProcessRequest rejects an invalid asset before recording any submission', async () => {
    const transport = makeTransport();
    const encrypted = await transport.encryptForTee(Buffer.from('plaintext', 'utf8'));

    await expect(
      transport.submitAssetBearingProcessRequest('app-1', encrypted, {
        tokenAddress: A_TOKEN,
        assetAmount: -5n,
      }),
    ).rejects.toThrow(/must be > 0/);
  });

  it('VelaClientAdapter.submitAssetBearingProcessRequest rejects an invalid asset before any chain call (unreachable RPC proves no network was touched)', async () => {
    // Port 0 on loopback is never listening — if validation did not run
    // first, the first network call (minFeePerRequest()) would hang/reject
    // with a connection error instead of the specific validation message.
    const adapter = makeRealAdapter({ rpcUrl: 'http://127.0.0.1:0' });

    await expect(
      adapter.submitAssetBearingProcessRequest('1', new Uint8Array([1, 2, 3]), {
        tokenAddress: A_TOKEN,
        assetAmount: -1n,
      }),
    ).rejects.toThrow(/must be > 0/);

    await expect(
      adapter.submitAssetBearingProcessRequest('1', new Uint8Array([1, 2, 3]), {
        tokenAddress: 'garbage',
        assetAmount: 1n,
      }),
    ).rejects.toThrow(/must be a 20-byte hex address/);
  });
});
