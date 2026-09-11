/**
 * VELA-001 Slice 2B — LIVE proof.
 *
 * Drives real confidential consequence projections through the
 * ConfidentialProjectionProvider seam against a running Vela deployment:
 *
 *   prepare → encrypt → submit → observe → retrieve → verify
 *
 * and asserts all three dispositions come back from the real enclave-executed
 * WASM: ACCEPTABLE, UNACCEPTABLE, UNRESOLVED.
 *
 * This is NOT the CI canary suite (tests/vela-confidential-projection-provider.test.ts
 * covers the provider's logic with a transport double). This script proves the
 * real wire protocol, the real ECDH/AES-GCM interop with the Go enclave, and
 * the real TEE-signature verification path.
 *
 * Usage — requires the local stack up and the projector deployed:
 *
 *   npx tsx scripts/vela-slice2b-live-projection.ts \
 *     --app <applicationId> \
 *     --evm-key <hex> \
 *     --p521-key <hex>
 *
 * Every value is supplied by the caller; nothing about the deployment is
 * guessed. Keys are dev-only Anvil/local material — never pass production keys.
 */

import { VelaConfidentialProjectionProvider } from '../services/vela/velaProjectionProvider';
import { VelaClientAdapter, velaCryptoSelfTest } from '../services/vela/velaClientAdapter';
import { VELA_LOCAL_DEPLOYMENT } from '../services/vela/velaConfig';
import type {
  ConfidentialProjectionDisposition,
  ConfidentialProjectionIdentitySet,
} from '../types/confidentialProjection';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) {
    throw new Error(`missing required argument --${name}`);
  }
  return process.argv[i + 1];
}

const APP_ID = arg('app');
const EVM_KEY = arg('evm-key');
const P521_KEY = arg('p521-key');

/**
 * The five roles. Three resolve to the same local dev address, which is
 * precisely the case the ruling covers: technical reuse, distinct roles.
 */
const IDENTITIES: ConfidentialProjectionIdentitySet = {
  authorityPrincipal: 'local-principal-ref',
  mandateSigner: 'local-principal-ref',
  confidentialRequester: 'local-agent-wallet',
  confidentialPrivacyIdentity: 'local-agent-wallet',
  executionSigner: 'local-agent-wallet',
};

interface Case {
  label: string;
  expect: ConfidentialProjectionDisposition;
  inputs: Record<string, number>;
  why: string;
}

const CASES: Case[] = [
  {
    label: 'ACCEPTABLE',
    expect: 'ACCEPTABLE',
    inputs: {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 500,
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    },
    why: 'spend 500 <= limit 1000, and exposure 2000 + 500 <= risk limit 5000',
  },
  {
    label: 'UNACCEPTABLE (spend limit)',
    expect: 'UNACCEPTABLE',
    inputs: {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 4_000,
      privateSpendLimit: 1_000,
      privateRiskLimit: 50_000,
    },
    why: 'spend 4000 > private spend limit 1000',
  },
  {
    label: 'UNACCEPTABLE (risk limit)',
    expect: 'UNACCEPTABLE',
    inputs: {
      currentBalance: 10_000,
      currentExposure: 4_800,
      proposedSpend: 500,
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    },
    why: 'spend within limit, but exposure 4800 + 500 > risk limit 5000',
  },
  {
    label: 'UNRESOLVED (missing limit)',
    expect: 'UNRESOLVED',
    inputs: {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 500,
      // privateSpendLimit deliberately absent — a missing limit must never
      // read as "no limit" and project ACCEPTABLE.
      privateRiskLimit: 5_000,
    },
    why: 'privateSpendLimit absent — cannot evaluate, must fail closed',
  },
];

/**
 * Fields that are opaque cryptographic material BY CONSTRUCTION — commitments,
 * state roots, signatures. A confidential value's decimal digits appearing as a
 * substring of a 64-char hex hash is coincidence, not disclosure, so scanning
 * them produces false positives (a naive `JSON.stringify().includes('500')`
 * flags any hash containing "500", and "500" is also a substring of "5000").
 */
const OPAQUE_FIELDS = new Set([
  'resultCommitment',
  'payloadCommitment',
  'stateRootHex',
  'teeSignatureHex',
  'executionProofRefs',
  'requestRef',
]);

/**
 * Walks the outward-facing records and reports a leak only where a confidential
 * value appears as an actual value, or a confidential input's NAME appears as a
 * key. Numeric leaves are compared exactly; string leaves are matched on token
 * boundaries so digits embedded in an opaque hash do not register.
 */
function findConfidentialLeaks(
  records: unknown,
  inputs: Record<string, number>,
): string[] {
  const leaks = new Set<string>();
  const names = Object.keys(inputs);

  const walk = (node: unknown, opaque: boolean) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'number') {
      for (const [label, value] of Object.entries(inputs)) {
        if (node === value) leaks.add(`${label} (numeric value ${value})`);
      }
      return;
    }
    if (typeof node === 'string') {
      if (opaque) return; // hashes/signatures — coincidental digits are not disclosure
      for (const name of names) {
        if (node.includes(name)) leaks.add(`${name} (name in string)`);
      }
      for (const [label, value] of Object.entries(inputs)) {
        if (new RegExp(`(^|\\D)${value}(\\D|$)`).test(node)) {
          leaks.add(`${label} (value ${value} in string)`);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, opaque);
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (names.includes(key)) leaks.add(`${key} (as a field name)`);
        walk(val, opaque || OPAQUE_FIELDS.has(key));
      }
    }
  };

  walk(records, false);
  return [...leaks];
}

async function main() {
  console.log('— Vela crypto self-test (ECDH P-521 → HKDF-SHA256 → AES-256-GCM)');
  velaCryptoSelfTest();
  console.log('  ✓ round trip + key symmetry\n');

  const transport = new VelaClientAdapter({
    deployment: VELA_LOCAL_DEPLOYMENT,
    requesterPrivateKeyHex: EVM_KEY,
    requesterP521PrivateKeyHex: P521_KEY,
    // Must cover the app's declared Fuel × weiPerFuelUnit, not just
    // minFeePerRequest. The projector declares Fuel=25, and a fee below that
    // fails the request with "insufficient fuel" — which the provider then
    // correctly reports as UNRESOLVED rather than UNACCEPTABLE. Headroom here
    // keeps the run measuring the projection rather than the fee.
    maxFeeValueWei: 1_000_000n,
  });
  const provider = new VelaConfidentialProjectionProvider(transport, APP_ID);

  const caps = await provider.getCapabilities();
  console.log('— Provider capabilities');
  console.log(`  provider          ${caps.provider}`);
  console.log(`  applicationRef    ${caps.applicationRef}`);
  console.log(`  attestationMode   ${caps.attestationMode}`);
  console.log(`  provenStates      ${caps.provenStates.join(', ')}`);
  console.log(`  registered signer ${await transport.readRegisteredTeeSigner()}\n`);

  let failures = 0;

  for (const c of CASES) {
    console.log(`— ${c.label}`);
    console.log(`  rationale: ${c.why}`);

    const prepared = await provider.prepareProjection({
      actionRef: `live-action-${c.label.replace(/\W+/g, '-').toLowerCase()}`,
      mandateRef: 'live-mandate-1',
      identities: IDENTITIES,
      confidentialInputs: c.inputs,
      publicContext: { policyVersion: 'v1', actionType: 'payment' },
    });
    console.log(`  prepared     payloadCommitment ${prepared.payloadCommitment.slice(0, 16)}…`);
    console.log(`               ciphertext ${prepared.encryptedPayload.length} bytes`);

    const submission = await provider.submitProjection(prepared);
    console.log(`  submitted    requestId ${submission.requestRef}`);

    // Observe until the enclave result lands. Browser/session lifetime is
    // irrelevant here — the observation is chain state.
    let status = await provider.getProjectionStatus(submission.requestRef);
    for (let i = 0; i < 60 && status.state === 'OBSERVING'; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      status = await provider.getProjectionStatus(submission.requestRef);
    }
    console.log(`  observed     state ${status.state}`);

    const evidence = await provider.getProjectionEvidence(submission.requestRef);
    const verification = await provider.verifyProjectionEvidence(evidence);

    console.log(`  disposition  ${evidence.disposition}  (expected ${c.expect})`);
    console.log(`  stateRoot    ${evidence.executionProofRefs[0]}`);
    console.log(
      `  verified     protocolExecutionVerified=${verification.protocolExecutionVerified} ` +
        `teeAttestationVerified=${verification.teeAttestationVerified} ` +
        `mode=${verification.attestationMode}`,
    );

    const leaked = findConfidentialLeaks({ evidence, verification, status }, c.inputs);

    const ok =
      evidence.disposition === c.expect &&
      verification.protocolExecutionVerified &&
      !verification.teeAttestationVerified && // local deployment
      evidence.payloadCommitment === prepared.payloadCommitment &&
      leaked.length === 0;

    if (!ok) {
      failures++;
      console.log('  ✗ FAILED');
      if (evidence.disposition !== c.expect) {
        console.log(`    disposition mismatch: got ${evidence.disposition}, expected ${c.expect}`);
      }
      if (!verification.protocolExecutionVerified) {
        console.log(`    protocol not verified: ${verification.reason}`);
      }
      if (verification.teeAttestationVerified) {
        console.log('    attestation reported verified on a NO_ATTESTATION_LOCAL deployment');
      }
      if (evidence.payloadCommitment !== prepared.payloadCommitment) {
        console.log('    payload commitment does not tie evidence to the submission');
      }
      if (leaked.length > 0) {
        console.log(`    CONFIDENTIAL LEAK: ${leaked.join(', ')}`);
      }
    } else {
      console.log('  ✓ PASS — disposition correct, protocol verified, attestation honestly false, no leak');
    }
    console.log();
  }

  console.log(`— Result: ${CASES.length - failures}/${CASES.length} passed`);
  if (failures > 0) process.exit(1);
  console.log('\nLIVE PROOF COMPLETE');
  console.log('  LOCAL_PROTOCOL_PROVEN      ✓');
  console.log('  LOCAL_EXECUTION_PROVEN     ✓');
  console.log('  PRODUCTION_TEE_ATTESTATION_PROVEN  ✗ — requires a Nitro-attested deployment');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
