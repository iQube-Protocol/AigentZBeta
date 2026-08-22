/**
 * VELA-001 Slice 2B canaries — the constitutional seam.
 *
 * These prove the four standing operator rulings (2026-08-22) hold in code,
 * not just in prose:
 *   1. no new custody surface / five identity roles never collapse
 *   2. Vela confidentiality is bounded, not total transaction privacy
 *   3. local execution is never production TEE attestation
 *   4. the provider contributes projection evidence only, never authority
 *
 * Plus the full provider lifecycle across all three dispositions.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  VelaConfidentialProjectionProvider,
  parseConfidentialVerdict,
  provenStatesFor,
} from '@/services/vela/velaProjectionProvider';
import { VelaTestTransport } from '@/services/vela/velaTestTransport';
import { VELA_LOCAL_DEPLOYMENT } from '@/services/vela/velaConfig';
import type { VelaDeploymentDescriptor } from '@/services/vela/velaTypes';
import type {
  ConfidentialProjectionRequest,
  ConfidentialProjectionIdentitySet,
} from '@/types/confidentialProjection';

const SIGNER = '0x2a0fba02cee7fb70899648037c7E8203881e2D55';

/**
 * The five identity roles. In the first implementation several resolve to the
 * SAME address — that is the point of the ruling: technical reuse must not
 * become constitutional merger.
 */
const IDENTITIES: ConfidentialProjectionIdentitySet = {
  authorityPrincipal: 'principal-ref-1',
  mandateSigner: 'principal-ref-1', // same as principal today
  confidentialRequester: 'agent-wallet-1', // MoneyPenny's existing wallet key
  confidentialPrivacyIdentity: 'agent-wallet-1', // derived from the same key
  executionSigner: 'agent-wallet-1', // same key again
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

/**
 * Models the Slice 2D projector's logic: a real confidential limit comparison
 * that returns ONLY the coarse verdict.
 */
function projectorVerdict(plaintextJson: string): string {
  const { inputs } = JSON.parse(plaintextJson) as { inputs: Record<string, number> };
  const { currentExposure, proposedSpend, privateSpendLimit, privateRiskLimit } = inputs;
  if (
    [currentExposure, proposedSpend, privateSpendLimit, privateRiskLimit].some(
      (v) => typeof v !== 'number',
    )
  ) {
    return JSON.stringify({ verdict: 'UNRESOLVED' });
  }
  const acceptable =
    proposedSpend <= privateSpendLimit &&
    currentExposure + proposedSpend <= privateRiskLimit;
  return JSON.stringify({ verdict: acceptable ? 'ACCEPTABLE' : 'UNACCEPTABLE' });
}

function makeProvider(overrides: Partial<{
  deployment: VelaDeploymentDescriptor;
  registeredTeeSigner: string;
  signingTeeSigner: string;
  verdictFor: (p: string) => string | null;
  errorCode: number;
  pendingPolls: number;
}> = {}) {
  const transport = new VelaTestTransport({
    deployment: overrides.deployment ?? VELA_LOCAL_DEPLOYMENT,
    registeredTeeSigner: overrides.registeredTeeSigner ?? SIGNER,
    signingTeeSigner: overrides.signingTeeSigner,
    verdictFor: overrides.verdictFor ?? projectorVerdict,
    errorCode: overrides.errorCode,
    pendingPolls: overrides.pendingPolls,
  });
  return {
    transport,
    provider: new VelaConfidentialProjectionProvider(transport, 'test-app'),
  };
}

/** Runs the full lifecycle: prepare → submit → observe → retrieve → verify. */
async function runLifecycle(
  provider: VelaConfidentialProjectionProvider,
  inputs: Record<string, number>,
) {
  const prepared = await provider.prepareProjection(request(inputs));
  const submission = await provider.submitProjection(prepared);
  let status = await provider.getProjectionStatus(submission.requestRef);
  for (let i = 0; i < 10 && status.state === 'OBSERVING'; i++) {
    status = await provider.getProjectionStatus(submission.requestRef);
  }
  const evidence = await provider.getProjectionEvidence(submission.requestRef);
  const verification = await provider.verifyProjectionEvidence(evidence);
  return { prepared, submission, status, evidence, verification };
}

describe('VELA-001 Slice 2B — full provider lifecycle, all three dispositions', () => {
  it('ACCEPTABLE: spend within both private limits', async () => {
    const { provider } = makeProvider();
    const { status, evidence, verification } = await runLifecycle(provider, {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 500,
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    });
    expect(status.state).toBe('PROJECTION_ACCEPTABLE');
    expect(evidence.disposition).toBe('ACCEPTABLE');
    expect(verification.protocolExecutionVerified).toBe(true);
  });

  it('UNACCEPTABLE: spend exceeds the private spend limit', async () => {
    const { provider } = makeProvider();
    const { status, evidence } = await runLifecycle(provider, {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 4_000, // > privateSpendLimit
      privateSpendLimit: 1_000,
      privateRiskLimit: 50_000,
    });
    expect(status.state).toBe('PROJECTION_UNACCEPTABLE');
    expect(evidence.disposition).toBe('UNACCEPTABLE');
  });

  it('UNACCEPTABLE: exposure + spend exceeds the private risk limit', async () => {
    const { provider } = makeProvider();
    const { evidence } = await runLifecycle(provider, {
      currentBalance: 10_000,
      currentExposure: 4_800,
      proposedSpend: 500, // within spend limit, but breaches risk limit
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    });
    expect(evidence.disposition).toBe('UNACCEPTABLE');
  });

  it('UNRESOLVED: confidential app emitted no result event', async () => {
    const { provider } = makeProvider({ verdictFor: () => null });
    const { status, evidence } = await runLifecycle(provider, { proposedSpend: 1 });
    expect(status.state).toBe('PROJECTION_UNRESOLVED');
    expect(evidence.disposition).toBe('UNRESOLVED');
  });

  it('observes asynchronously — OBSERVING until the result lands', async () => {
    const { provider } = makeProvider({ pendingPolls: 3 });
    const prepared = await provider.prepareProjection(request({ proposedSpend: 1 }));
    const { requestRef } = await provider.submitProjection(prepared);
    expect((await provider.getProjectionStatus(requestRef)).state).toBe('OBSERVING');
    expect((await provider.getProjectionStatus(requestRef)).state).toBe('OBSERVING');
  });
});

describe('Ruling 3 — local execution is never production TEE attestation', () => {
  it('local deployment reports protocol proven, attestation NOT proven', async () => {
    const { provider } = makeProvider();
    const { verification } = await runLifecycle(provider, {
      currentExposure: 0,
      proposedSpend: 1,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    expect(verification.protocolExecutionVerified).toBe(true);
    expect(verification.teeAttestationVerified).toBe(false);
    expect(verification.attestationMode).toBe('NO_ATTESTATION_LOCAL');
  });

  it('a successful execution never promotes PRODUCTION_TEE_ATTESTATION_PROVEN', async () => {
    const { provider } = makeProvider();
    const { verification } = await runLifecycle(provider, {
      currentExposure: 0,
      proposedSpend: 1,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    expect(verification.provenStates).toEqual([
      'LOCAL_PROTOCOL_PROVEN',
      'LOCAL_EXECUTION_PROVEN',
    ]);
    expect(verification.provenStates).not.toContain('PRODUCTION_TEE_ATTESTATION_PROVEN');
  });

  it('the third proof state is reachable only from a NITRO_ATTESTED deployment', () => {
    expect(provenStatesFor('NO_ATTESTATION_LOCAL')).not.toContain(
      'PRODUCTION_TEE_ATTESTATION_PROVEN',
    );
    expect(provenStatesFor('NITRO_ATTESTED')).toContain('PRODUCTION_TEE_ATTESTATION_PROVEN');
  });

  it('capabilities never advertise attestation the deployment cannot provide', async () => {
    const { provider } = makeProvider();
    const caps = await provider.getCapabilities();
    expect(caps.attestationMode).toBe('NO_ATTESTATION_LOCAL');
    expect(caps.provenStates).not.toContain('PRODUCTION_TEE_ATTESTATION_PROVEN');
  });

  it('attestation is read from the deployment, NOT inferred from a matching signature', async () => {
    // Signature matches (protocol verified) on a NITRO_ATTESTED deployment ⇒
    // attested. Same matching signature on a local deployment ⇒ NOT attested.
    // Proves the two booleans are independent rather than one gating the other.
    const attested = makeProvider({
      deployment: { ...VELA_LOCAL_DEPLOYMENT, attestationMode: 'nitro_attested' },
    });
    const local = makeProvider();
    const a = await runLifecycle(attested.provider, { proposedSpend: 1 });
    const l = await runLifecycle(local.provider, { proposedSpend: 1 });
    expect(a.verification.protocolExecutionVerified).toBe(
      l.verification.protocolExecutionVerified,
    );
    expect(a.verification.teeAttestationVerified).toBe(true);
    expect(l.verification.teeAttestationVerified).toBe(false);
  });
});

describe('Fail-closed paths', () => {
  it('an Executor-side failure is UNRESOLVED, never UNACCEPTABLE', async () => {
    // Critical distinction: a failed request must not read as "the confidential
    // conditions were evaluated and rejected".
    const { provider } = makeProvider({ errorCode: 7 });
    const { status, evidence } = await runLifecycle(provider, { proposedSpend: 1 });
    expect(status.state).toBe('FAILED');
    expect(status.disposition).toBe('UNRESOLVED');
    expect(evidence.disposition).toBe('UNRESOLVED');
  });

  it('malformed, unknown and absent verdicts all fail closed to UNRESOLVED', () => {
    expect(parseConfidentialVerdict(null)).toBe('UNRESOLVED');
    expect(parseConfidentialVerdict('not json')).toBe('UNRESOLVED');
    expect(parseConfidentialVerdict('{}')).toBe('UNRESOLVED');
    expect(parseConfidentialVerdict('{"verdict":"AUTHORISED"}')).toBe('UNRESOLVED');
    expect(parseConfidentialVerdict('{"verdict":"acceptable"}')).toBe('UNRESOLVED');
    expect(parseConfidentialVerdict('null')).toBe('UNRESOLVED');
  });

  it('a result signed by an unregistered signer is not protocol-verified', async () => {
    const { provider } = makeProvider({
      signingTeeSigner: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    const { verification } = await runLifecycle(provider, { proposedSpend: 1 });
    expect(verification.protocolExecutionVerified).toBe(false);
  });

  it('evidence cannot be retrieved before a result exists', async () => {
    const { provider } = makeProvider({ pendingPolls: 99 });
    const prepared = await provider.prepareProjection(request({ proposedSpend: 1 }));
    const { requestRef } = await provider.submitProjection(prepared);
    await expect(provider.getProjectionEvidence(requestRef)).rejects.toThrow(/no completed result/);
  });
});

describe('Ruling 2 — bounded confidentiality: no confidential value ever leaks outward', () => {
  const SECRETS = {
    currentBalance: 987_654,
    currentExposure: 4_800,
    proposedSpend: 500,
    privateSpendLimit: 1_000,
    privateRiskLimit: 5_000,
  };

  it('the prepared projection carries no plaintext field at all', async () => {
    const { provider } = makeProvider();
    const prepared = await provider.prepareProjection(request(SECRETS));
    // Type-level guarantee, asserted at runtime too.
    expect('confidentialInputs' in prepared).toBe(false);
    expect(Object.keys(prepared).sort()).toEqual(
      [
        'actionRef',
        'applicationRef',
        'encryptedPayload',
        'identities',
        'mandateRef',
        'payloadCommitment',
      ].sort(),
    );
  });

  it('evidence contains no confidential value and no failing-condition name', async () => {
    const { provider } = makeProvider();
    const { evidence } = await runLifecycle(provider, SECRETS);
    expect(evidence.disposition).toBe('UNACCEPTABLE');
    const serialised = JSON.stringify(evidence);
    for (const [label, value] of Object.entries(SECRETS)) {
      expect(serialised).not.toContain(String(value));
      expect(serialised).not.toContain(label);
    }
    // Nor the reason it failed.
    expect(serialised).not.toMatch(/risk|exposure|limit|balance|spend/i);
  });

  it('the verification reason explains the ATTESTATION basis, never the verdict basis', async () => {
    const { provider } = makeProvider();
    const { verification } = await runLifecycle(provider, SECRETS);
    for (const value of Object.values(SECRETS)) {
      expect(verification.reason).not.toContain(String(value));
    }
    expect(verification.reason).toMatch(/signer|attestation/i);
  });

  it('evidence commits to the result rather than carrying it', async () => {
    const { provider } = makeProvider();
    const { evidence } = await runLifecycle(provider, SECRETS);
    expect(evidence.resultCommitment).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.payloadCommitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the payload commitment ties evidence to the exact ciphertext submitted', async () => {
    const { provider } = makeProvider();
    const prepared = await provider.prepareProjection(request(SECRETS));
    const { requestRef } = await provider.submitProjection(prepared);
    const evidence = await provider.getProjectionEvidence(requestRef);
    expect(evidence.payloadCommitment).toBe(prepared.payloadCommitment);
  });

  it('distinct confidential inputs produce distinct commitments', async () => {
    const { provider } = makeProvider();
    const a = await provider.prepareProjection(request({ ...SECRETS, proposedSpend: 1 }));
    const b = await provider.prepareProjection(request({ ...SECRETS, proposedSpend: 2 }));
    expect(a.payloadCommitment).not.toBe(b.payloadCommitment);
  });
});

describe('Ruling 4 — the provider contributes evidence, never authority', () => {
  it('the provider exposes no method that could return an authorisation', () => {
    const { provider } = makeProvider();
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(provider),
    ).filter((m) => m !== 'constructor');
    expect(methods.sort()).toEqual(
      [
        'attestationMode', // private getter
        'evidenceFrom', // private
        'getCapabilities',
        'getProjectionEvidence',
        'getProjectionStatus',
        'prepareProjection',
        'submitProjection',
        'verifyProjectionEvidence',
      ].sort(),
    );
    for (const m of methods) {
      expect(m).not.toMatch(/authori[sz]|mandate|delegat|permit|approve/i);
    }
  });

  it('no returned value can express AUTHORISED / AUTHORITY_VALID / MANDATE_VALID', async () => {
    const { provider } = makeProvider();
    const { status, evidence, verification } = await runLifecycle(provider, {
      currentExposure: 0,
      proposedSpend: 1,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    const all = JSON.stringify({
      status,
      evidence,
      verification,
      caps: await provider.getCapabilities(),
    });
    for (const forbidden of [
      'AUTHORISED',
      'AUTHORIZED',
      'AUTHORITY_VALID',
      'MANDATE_VALID',
      'ACTION_AUTHORISED',
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('an ACCEPTABLE verdict yields a disposition only — never an authorisation', async () => {
    const { provider } = makeProvider();
    const { evidence } = await runLifecycle(provider, {
      currentExposure: 0,
      proposedSpend: 1,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    expect(evidence.disposition).toBe('ACCEPTABLE');
    expect(evidence).not.toHaveProperty('authorisationRef');
    expect(evidence).not.toHaveProperty('status');
  });

  it('the provider module never imports the authorisation type', () => {
    const src = readFileSync(
      join(process.cwd(), 'services/vela/velaProjectionProvider.ts'),
      'utf8',
    );
    // Check IMPORTS, not prose — the module's own doc comment legitimately
    // explains that it must not import this, and an all-text grep would fail
    // on the very sentence documenting the rule.
    const importBlocks = src.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
    expect(importBlocks.length).toBeGreaterThan(0);
    for (const block of importBlocks) {
      expect(block).not.toMatch(/ActionAuthorisation|constitutionalCommerce/);
    }
  });
});

describe('Ruling 1 — five identity roles survive technical key reuse', () => {
  it('all five roles are carried through prepare, even when they share an address', async () => {
    const { provider } = makeProvider();
    const prepared = await provider.prepareProjection(request({ proposedSpend: 1 }));
    expect(Object.keys(prepared.identities).sort()).toEqual([
      'authorityPrincipal',
      'confidentialPrivacyIdentity',
      'confidentialRequester',
      'executionSigner',
      'mandateSigner',
    ]);
    // Three of them resolve to the same key today — the distinction is retained anyway.
    expect(prepared.identities.confidentialRequester).toBe(
      prepared.identities.executionSigner,
    );
    expect(prepared.identities.authorityPrincipal).not.toBe(
      prepared.identities.confidentialRequester,
    );
  });

  it('the domain seam declares five distinct identity roles', () => {
    const src = readFileSync(
      join(process.cwd(), 'types/confidentialProjection.ts'),
      'utf8',
    );
    for (const field of [
      'authorityPrincipal',
      'mandateSigner',
      'confidentialRequester',
      'confidentialPrivacyIdentity',
      'executionSigner',
    ]) {
      expect(src).toContain(field);
    }
  });
});

describe('Layering — Vela internals stop at the provider boundary', () => {
  it('the domain seam names no Vela-specific concept', () => {
    const src = readFileSync(
      join(process.cwd(), 'types/confidentialProjection.ts'),
      'utf8',
    );
    // Prose references in doc comments are fine; type/field names are not.
    const declarations = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'));
    for (const banned of [
      'ProcessorEndpoint',
      'P521',
      'P-521',
      'subgraph',
      'WASM',
      'RequestType',
      'TeeAuthenticator',
    ]) {
      expect(declarations.join('\n')).not.toContain(banned);
    }
  });

  it('the provider-contract types live in the domain layer, not in velaTypes', () => {
    const wire = readFileSync(join(process.cwd(), 'services/vela/velaTypes.ts'), 'utf8');
    // These moved to types/confidentialProjection.ts — a duplicate here would be
    // exactly the source-of-truth parity defect inv.engineering.037 forbids.
    expect(wire).not.toMatch(/export interface ConfidentialProjectionRequest/);
    expect(wire).not.toMatch(/export interface ConfidentialEvidenceVerification/);
    expect(wire).not.toMatch(/export interface ConfidentialProjectionEvidence/);
  });
});
