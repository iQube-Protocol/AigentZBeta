/**
 * services/vela/velaApplicationDeploymentReceipt.ts — Vela/Horizen v0.2.0
 * feedback (2026-09-16): applicationId alone does not prove which WASM was
 * deployed; canonical identity is reconstructed by correlating the deploy
 * transaction input, DeployRequestSubmitted, and a successful
 * DeployRequestCompleted.
 */
import { describe, expect, it } from 'vitest';
import {
  assembleVelaApplicationDeploymentReceipt,
  verifyVelaApplicationDeploymentReceipt,
  VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION,
  type RawVelaApplicationDeploymentEvidence,
  type VelaApplicationDeploymentReceipt,
} from '@/services/vela/velaApplicationDeploymentReceipt';

const WASM_SHA256 = 'a'.repeat(64);

function validEvidence(): RawVelaApplicationDeploymentEvidence {
  return {
    network: { chainId: 31337, processorEndpointAddress: '0xProcessor', protocolVersion: 0 },
    localWasmSha256: WASM_SHA256,
    deployTransaction: {
      hash: '0xdeploytx',
      blockNumber: 100,
      inputWasmSha256: WASM_SHA256,
      inputArtifactId: `sha256:${WASM_SHA256}`,
      inputMode: 'artifact_ref',
    },
    deployRequestSubmitted: { requestId: '0xreq1', applicationId: '42' },
    deployRequestCompleted: { requestId: '0xreq1', applicationId: '42', status: 0, errorCode: 0, errorMessage: '' },
    attestationMode: 'no_attestation',
    ephemeral: true,
    authorityServiceUrl: 'https://devnet-authority.synsema.app',
    artifactId: `sha256:${WASM_SHA256}`,
    observedAt: '2026-09-16T00:00:00.000Z',
  };
}

describe('assembleVelaApplicationDeploymentReceipt — valid case', () => {
  it('creates a valid deployment receipt from a fully-correlated deploy', () => {
    const receipt = assembleVelaApplicationDeploymentReceipt(validEvidence());
    expect(receipt.applicationId).toBe('42');
    expect(receipt.schemaVersion).toBe(VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION);
    expect(receipt.wasm.sha256).toBe(WASM_SHA256);
    expect(receipt.ephemeral).toBe(true);
  });
});

describe('assembleVelaApplicationDeploymentReceipt — WASM-hash mismatch refuses', () => {
  it('throws when the tx input hash differs from the claimed WASM hash', () => {
    const evidence = validEvidence();
    evidence.deployTransaction!.inputWasmSha256 = 'b'.repeat(64);
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/WASM hash mismatch/);
  });
});

describe('assembleVelaApplicationDeploymentReceipt — request/application ID mismatch refuses', () => {
  it('throws when DeployRequestSubmitted and DeployRequestCompleted requestIds disagree', () => {
    const evidence = validEvidence();
    evidence.deployRequestCompleted!.requestId = '0xDIFFERENT';
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/request ID mismatch/);
  });

  it('throws when DeployRequestSubmitted and DeployRequestCompleted applicationIds disagree', () => {
    const evidence = validEvidence();
    evidence.deployRequestCompleted!.applicationId = '99';
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/applicationId mismatch/);
  });
});

describe('assembleVelaApplicationDeploymentReceipt — failed deployment refuses', () => {
  it('throws when DeployRequestCompleted.status !== 0', () => {
    const evidence = validEvidence();
    evidence.deployRequestCompleted = { ...evidence.deployRequestCompleted!, status: 1, errorCode: 7, errorMessage: 'deploy failed' };
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/did not complete successfully/);
  });

  it('throws when DeployRequestCompleted.errorCode !== 0 even if status looks like 0', () => {
    const evidence = validEvidence();
    evidence.deployRequestCompleted = { ...evidence.deployRequestCompleted!, status: 0, errorCode: 5, errorMessage: 'partial failure' };
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/did not complete successfully/);
  });
});

describe('assembleVelaApplicationDeploymentReceipt — malformed/incomplete evidence refuses', () => {
  it('throws when the deploy transaction is missing', () => {
    const evidence = { ...validEvidence(), deployTransaction: null };
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/missing deploy transaction input/);
  });

  it('throws when DeployRequestSubmitted is missing', () => {
    const evidence = { ...validEvidence(), deployRequestSubmitted: null };
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/missing DeployRequestSubmitted/);
  });

  it('throws when DeployRequestCompleted is missing', () => {
    const evidence = { ...validEvidence(), deployRequestCompleted: null };
    expect(() => assembleVelaApplicationDeploymentReceipt(evidence)).toThrow(/missing DeployRequestCompleted/);
  });
});

describe('verifyVelaApplicationDeploymentReceipt — re-verifying a persisted receipt', () => {
  it('accepts a well-formed, internally-consistent receipt (round-trips through JSON)', () => {
    const built = assembleVelaApplicationDeploymentReceipt(validEvidence());
    const roundTripped = JSON.parse(JSON.stringify(built)) as unknown;
    const verified = verifyVelaApplicationDeploymentReceipt(roundTripped);
    expect(verified.applicationId).toBe('42');
  });

  it('refuses a receipt with the wrong/missing schemaVersion', () => {
    const built = assembleVelaApplicationDeploymentReceipt(validEvidence());
    const tampered = { ...built, schemaVersion: 'some-other-schema/v1' };
    expect(() => verifyVelaApplicationDeploymentReceipt(tampered)).toThrow(/schemaVersion/);
  });

  it('refuses a receipt missing a required field entirely', () => {
    const built = assembleVelaApplicationDeploymentReceipt(validEvidence()) as unknown as Record<string, unknown>;
    const { deployRequestCompleted: _omitted, ...incomplete } = built;
    expect(() => verifyVelaApplicationDeploymentReceipt(incomplete)).toThrow(/missing or malformed field: deployRequestCompleted/);
  });

  it('refuses a tampered receipt whose embedded WASM hash was edited post-hoc', () => {
    const built = assembleVelaApplicationDeploymentReceipt(validEvidence());
    const tampered: VelaApplicationDeploymentReceipt = { ...built, wasm: { sha256: 'c'.repeat(64) } };
    expect(() => verifyVelaApplicationDeploymentReceipt(tampered)).toThrow(/WASM hash mismatch/);
  });

  it('refuses a non-object input', () => {
    expect(() => verifyVelaApplicationDeploymentReceipt('not an object')).toThrow(/must be a JSON object/);
    expect(() => verifyVelaApplicationDeploymentReceipt(null)).toThrow(/must be a JSON object/);
  });

  it('never requires or exposes a secret field — no token/private-key field exists on the schema', () => {
    const built = assembleVelaApplicationDeploymentReceipt(validEvidence());
    const serialized = JSON.stringify(built);
    expect(serialized).not.toMatch(/token|privateKey|secret/i);
  });
});
