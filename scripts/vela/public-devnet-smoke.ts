/**
 * Public Vela v0.2.0 devnet smoke proof — MoneyPenny Confidential Consequence
 * Projector, multi-party path.
 *
 * Runs the CURRENT guest (`services/vela/wasm/projector/app/app.go`, already
 * carrying the merged multi-party namespace/COMPUTE_WITH/DISCLOSE_TO/
 * non-transitivity/fail-closed-UNRESOLVED enforcement) through the standard
 * Vela v0.2.0 remote lifecycle against the PUBLIC Synsema devnet
 * (`https://devnet.synsema.app/`) instead of the local Docker Compose stack:
 *
 *   guest source (already built) -> real WASM artifact -> Authority Service
 *   upload -> submitDeployRequest -> applicationId -> register test users
 *   (ASSOCIATEKEY) -> submit real multi-party requests -> poll -> decode.
 *
 * This is NOT the managed Horizen/Vela Engineering Nitro-attested testnet,
 * NOT the seeded Use Case Zero product demo, and NOT a durable deployment.
 * The devnet is explicitly described by its own operator as "known keys, no
 * attestation, reset from time to time: a place to iterate, not to keep
 * value." Every result this script produces is EMULATED TEE evidence
 * (protocol/application execution proof), never hardware-attestation proof.
 *
 * SECURITY: this script never commits, logs in full, or persists outside
 * this process's own stdout-redacted summary any of: the devnet capability
 * token, the granted account's secp256k1 private key, or any derived/locally
 * generated party's private key. Credentials are read from
 * `VELA_PUBLIC_DEVNET_TOKEN_FILE` (a JSON file the operator points at — e.g.
 * the raw response saved from `POST https://devnet.synsema.app/token`) or
 * from individual `VELA_PUBLIC_DEVNET_*` / `VELA_PUBLIC_DEVNET_DEPLOYER_KEY`
 * env vars. Never hardcode a token, key, or Synsema URL in this file.
 *
 * Usage:
 *   VELA_PUBLIC_DEVNET_TOKEN_FILE=/path/to/token_response.json \
 *     npx tsx scripts/vela/public-devnet-smoke.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes, createECDH, randomUUID } from 'crypto';
import { JsonRpcProvider, Wallet, Contract, Interface } from 'ethers';
import { VelaClientAdapter, type VelaClientAdapterOptions } from '../../services/vela/velaClientAdapter';
import { deriveAgentP521KeyPair } from '../../services/vela/agentP521Derivation';
import type { VelaDeploymentDescriptor } from '../../services/vela/velaTypes';
import type { ConfidentialProjectionDisposition } from '../../types/confidentialProjection';
import {
  prepareVelaMultiPartyProjection,
  submitVelaMultiPartyProjection,
  getVelaMultiPartyProjectionOutcome,
  VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE,
  VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
  VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
  VELA_SCOPE_ACTION_COMPUTE_WITH,
  VELA_SCOPE_ACTION_DISCLOSE_TO,
  type VelaMultiPartyDisclosureScope,
  type VelaMultiPartyProjectionRequest,
} from '../../services/vela/velaMultiPartyProjection';
import { deriveVelaPartyNamespaceRef } from '../../services/vela/velaPartyNamespace';

// ── Config loading (never hardcode a Synsema URL/token/key) ────────────────

interface DevnetTokenResponse {
  token: string;
  host: string;
  address: string;
  env: Record<string, string>;
}

function loadTokenResponse(): DevnetTokenResponse {
  const path = process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
  if (!path) {
    throw new Error(
      'VELA_PUBLIC_DEVNET_TOKEN_FILE is required — point it at the JSON saved from ' +
        'POST https://devnet.synsema.app/token. This script never mints a token itself ' +
        'so the raw response never appears in process args or a second location.',
    );
  }
  return JSON.parse(readFileSync(path, 'utf8')) as DevnetTokenResponse;
}

function deploymentFromTokenResponse(t: DevnetTokenResponse): VelaDeploymentDescriptor {
  const env = t.env;
  const need = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`token response env.${k} missing`);
    return v;
  };
  return {
    chainId: 31337,
    rpcUrl: need('VELA_RPC_URL'),
    processorEndpointAddress: need('VELA_PROCESSOR'),
    teeAuthenticatorAddress: need('VELA_TEE_AUTHENTICATOR'),
    authorityServiceUrl: need('VELA_AUTHORITY_URL'),
    subgraphUrl: env.VELA_SUBGRAPH_URL ?? '',
    attestationMode: 'no_attestation',
  };
}

const WASM_PATH =
  process.env.VELA_GUEST_WASM_PATH ??
  `${process.cwd()}/services/vela/wasm/projector/production_build/moneypenny_projector.wasm`;

const OUT_PATH =
  process.env.VELA_DEVNET_SMOKE_OUT ??
  `${process.cwd()}/scripts/vela/.public-devnet-smoke-last-result.json`;

// ── Small helpers ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Bounded, timeout-aware, idempotent polling — never an infinite retry loop. */
async function pollUntil<T>(
  label: string,
  attempt: () => Promise<T | null>,
  { maxAttempts = 60, intervalMs = 3000 }: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await attempt();
    if (result !== null) return result;
    await sleep(intervalMs);
  }
  throw new Error(`pollUntil(${label}): timed out after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 1000}s)`);
}

/**
 * Polls to a terminal RESOLVED outcome and returns the genuine disposition —
 * throwing immediately, with the raw errorCode/errorMsg, if the outcome is
 * EXECUTION_FAILED. Hardened after this same run's own fuel-shortfall
 * incident (RES-2026-09-14-VELA-DEVNET-FUEL-ERRORCODE-MASKED-DISPOSITION-001):
 * a fee/fuel failure must never be silently reported as a genuine
 * UNRESOLVED disposition — see Execution Failure Non-Equivalence
 * (CI-2026-09-14-EXECUTION-FAILURE-NON-EQUIVALENCE-001).
 */
async function pollOutcome(
  label: string,
  adapter: Pick<VelaClientAdapter, 'fetchResult'>,
  onChainRequestId: string,
): Promise<ConfidentialProjectionDisposition> {
  const outcome = await pollUntil(label, async () => {
    const o = await getVelaMultiPartyProjectionOutcome(adapter, onChainRequestId);
    return o.status === 'PENDING' ? null : o;
  });
  if (outcome.status === 'EXECUTION_FAILED') {
    throw new Error(
      `${label}: request ${onChainRequestId} FAILED at the Vela execution layer ` +
        `(errorCode ${outcome.errorCode}: "${outcome.errorMsg}") — this is an execution/fee failure, ` +
        'never a constitutional disposition. Raise maxFeeValueWei and retry.',
    );
  }
  return outcome.disposition;
}

// ── Phase 3a: upload WASM to the Authority Service (real, source-verified
//    contract: POST {authorityServiceUrl}/deploy/upload, multipart field
//    "wasm", filename "app.wasm" — read directly from
//    github.com/HorizenOfficial/vela-nova wallet/cmd/deployapp.go, tag-pinned
//    v0.2.0's own reference CLI implementation, not guessed). ─────────────
interface DeployUploadResponse {
  artifactId: string;
  wasmSha256: string;
}

async function uploadWasmToAuthorityService(
  authorityServiceUrl: string,
  wasmBytes: Buffer,
): Promise<DeployUploadResponse> {
  const form = new FormData();
  form.append('wasm', new Blob([wasmBytes]), 'app.wasm');
  const res = await fetch(`${authorityServiceUrl.replace(/\/$/, '')}/deploy/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deploy/upload failed: HTTP ${res.status} — ${body.slice(0, 500)}`);
  }
  return (await res.json()) as DeployUploadResponse;
}

const DEPLOY_ABI = [
  'function submitDeployRequest(uint8 protocolVersion, bytes payload) payable returns (bytes32)',
  'event DeployRequestSubmitted(uint64 indexed applicationId, bytes32 requestId, address indexed sender)',
  'event DeployRequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
  'function minFeePerRequest() view returns (uint256)',
];

async function deployWasmToPublicDevnet(
  deployment: VelaDeploymentDescriptor,
  deployerKeyHex: string,
  wasmBytes: Buffer,
  localSha256: string,
): Promise<{ applicationId: string; deployTxHash: string; wasmSha256: string; artifactId: string }> {
  const uploadResp = await uploadWasmToAuthorityService(deployment.authorityServiceUrl, wasmBytes);
  if (uploadResp.wasmSha256 !== localSha256) {
    throw new Error(
      `deploy upload hash mismatch: local=${localSha256} remote=${uploadResp.wasmSha256} — refusing to deploy an artifact the Authority Service did not confirm receiving byte-identical.`,
    );
  }
  const expectedArtifactId = `sha256:${localSha256}`;
  if (uploadResp.artifactId !== expectedArtifactId) {
    throw new Error(`deploy upload artifactId mismatch: expected=${expectedArtifactId} remote=${uploadResp.artifactId}`);
  }

  const provider = new JsonRpcProvider(deployment.rpcUrl);
  const wallet = new Wallet(deployerKeyHex, provider);
  const processor = new Contract(deployment.processorEndpointAddress, DEPLOY_ABI, wallet);

  const deployPayload = Buffer.from(
    JSON.stringify({
      mode: 'artifact_ref',
      artifactId: uploadResp.artifactId,
      wasmSha256: uploadResp.wasmSha256,
      constructorParams: {},
    }),
    'utf8',
  );

  const minFee: bigint = await processor.minFeePerRequest();
  const tx = await processor.submitDeployRequest(0, deployPayload, {
    value: minFee > 0n ? minFee : 1_000_000n,
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('submitDeployRequest transaction reverted');

  const iface = new Interface(DEPLOY_ABI);
  let applicationId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'DeployRequestSubmitted') applicationId = parsed.args.applicationId as bigint;
    } catch {
      /* not ours */
    }
  }
  if (applicationId === null) throw new Error('DeployRequestSubmitted event not found in receipt logs');

  const filter = processor.filters.DeployRequestCompleted(applicationId);
  const completed = await pollUntil(
    'DeployRequestCompleted',
    async () => {
      const events = await processor.queryFilter(filter, receipt.blockNumber, 'latest');
      if (events.length === 0) return null;
      const ev = events[events.length - 1] as unknown as {
        args: { errorCode: bigint; errorMessage: string; status: bigint };
      };
      return { errorCode: Number(ev.args.errorCode), errorMessage: ev.args.errorMessage, status: Number(ev.args.status) };
    },
    { maxAttempts: 60, intervalMs: 3000 },
  );
  if (completed.errorCode !== 0) {
    throw new Error(`deploy failed on-chain: errorCode ${completed.errorCode} — ${completed.errorMessage}`);
  }

  return {
    applicationId: applicationId.toString(),
    deployTxHash: tx.hash,
    wasmSha256: uploadResp.wasmSha256,
    artifactId: uploadResp.artifactId,
  };
}

// ── Phase 4: fund a fresh local keypair + ASSOCIATEKEY registration ────────

const PROCESS_ABI = [
  'function submitRequest(uint8 protocolVersion, uint64 applicationId, uint8 requestType, bytes payload, address tokenAddress, uint256 assetAmount, uint256 maxFeeValue) payable returns (bytes32)',
  'function minFeePerRequest() view returns (uint256)',
  'event RequestSubmitted(uint64 indexed applicationId, bytes32 indexed requestId, address indexed sender, address facilitator)',
  'event RequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
];

async function fundAccount(
  deployment: VelaDeploymentDescriptor,
  funderKeyHex: string,
  toAddress: string,
  amountWei: bigint,
): Promise<void> {
  const provider = new JsonRpcProvider(deployment.rpcUrl);
  const funder = new Wallet(funderKeyHex, provider);
  const tx = await funder.sendTransaction({ to: toAddress, value: amountWei });
  await tx.wait();
}

async function associateKey(
  deployment: VelaDeploymentDescriptor,
  evmKeyHex: string,
  p521PrivHex: string,
  applicationId: string,
): Promise<void> {
  const provider = new JsonRpcProvider(deployment.rpcUrl);
  const wallet = new Wallet(evmKeyHex, provider);
  const processor = new Contract(deployment.processorEndpointAddress, PROCESS_ABI, wallet);

  const ecdh = createECDH('secp521r1');
  ecdh.setPrivateKey(Buffer.from(p521PrivHex.replace(/^0x/, ''), 'hex'));
  const pubKey = ecdh.getPublicKey();
  if (pubKey.length !== 133) throw new Error(`expected 133-byte P-521 public key, got ${pubKey.length}`);

  const minFee: bigint = await processor.minFeePerRequest();
  const maxFee = minFee > 1_000_000n ? minFee : 1_000_000n;

  const tx = await processor.submitRequest(
    0,
    BigInt(applicationId),
    3, // ASSOCIATEKEY
    pubKey,
    '0x0000000000000000000000000000000000000000',
    0n,
    maxFee,
    { value: maxFee },
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error('ASSOCIATEKEY: no receipt');

  const iface = new Interface(PROCESS_ABI);
  let requestId: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'RequestSubmitted') requestId = parsed.args.requestId as string;
    } catch {
      /* not ours */
    }
  }
  if (!requestId) throw new Error('ASSOCIATEKEY: RequestSubmitted event not found');

  const completed = await pollUntil(
    'ASSOCIATEKEY RequestCompleted',
    async () => {
      const events = await processor.queryFilter(
        processor.filters.RequestCompleted(BigInt(applicationId), requestId),
        receipt.blockNumber,
      );
      if (events.length === 0) return null;
      const ev = events[0] as unknown as { args: { errorCode: bigint; errorMessage: string } };
      return { errorCode: Number(ev.args.errorCode), errorMessage: ev.args.errorMessage };
    },
    { maxAttempts: 30, intervalMs: 3000 },
  );
  if (completed.errorCode !== 0) {
    throw new Error(`ASSOCIATEKEY failed: errorCode ${completed.errorCode} — ${completed.errorMessage}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

interface PartyRig {
  label: string;
  wallet: Wallet;
  p521PrivateKeyHex: string;
  namespaceRef: string;
  adapter: VelaClientAdapter;
}

async function buildPartyRig(
  label: string,
  deployment: VelaDeploymentDescriptor,
  wallet: Wallet,
  applicationId: string,
): Promise<PartyRig> {
  const { privateKeyHex } = await deriveAgentP521KeyPair(wallet);
  const namespaceRef = deriveVelaPartyNamespaceRef(applicationId, {
    authorityPrincipal: wallet.address,
    confidentialPrivacyIdentity: `vela-devnet-smoke:${label}`,
  });
  const opts: VelaClientAdapterOptions = {
    deployment,
    requesterPrivateKeyHex: wallet.privateKey,
    requesterP521PrivateKeyHex: privateKeyHex,
    // A first run against this devnet with the bare minFeePerRequest() (10
    // wei) failed EVERY multi-party submission with errorCode 12
    // "insufficient fuel: required 25 wei, provided 10 wei" — an execution
    // fee failure, not a guest disposition, and it decoded as UNRESOLVED
    // indistinguishably from a genuine authorization refusal until the raw
    // errorCode was inspected directly. Multi-party requests process more
    // than one party's ProjectionInputs, so they cost more fuel than the
    // single-party minimum this devnet's minFeePerRequest() reflects.
    // Generous headroom (still negligible against the devnet's 10,000 test
    // ETH grant) so a genuine guest disposition is never confused with a
    // fee shortfall again.
    maxFeeValueWei: 1_000_000n,
  };
  const adapter = new VelaClientAdapter(opts);
  return { label, wallet, p521PrivateKeyHex: privateKeyHex, namespaceRef, adapter };
}

async function main() {
  const startedAt = new Date().toISOString();
  const tokenResp = loadTokenResponse();
  const deployment = deploymentFromTokenResponse(tokenResp);
  const deployerKeyHex = tokenResp.env.VELA_SECP_KEY;
  if (!deployerKeyHex) throw new Error('token response env.VELA_SECP_KEY missing');

  console.log('=== Phase 2: verify guest WASM matches current app.go build ===');
  const wasmBytes = readFileSync(WASM_PATH);
  const { createHash } = await import('crypto');
  const localSha256 = createHash('sha256').update(wasmBytes).digest('hex');
  console.log('wasm path:', WASM_PATH);
  console.log('wasm sha256:', localSha256);
  console.log('wasm bytes:', wasmBytes.length);

  console.log('\n=== Phase 3: deploy to public devnet ===');
  const deployResult = await deployWasmToPublicDevnet(deployment, deployerKeyHex, wasmBytes, localSha256);
  console.log('applicationId:', deployResult.applicationId);
  console.log('deploy tx:', deployResult.deployTxHash);

  console.log('\n=== Phase 4: register test parties (ASSOCIATEKEY) ===');
  const deployerWallet = new Wallet(deployerKeyHex);
  const partyBWallet = new Wallet('0x' + randomBytes(32).toString('hex'));
  const partyCWallet = new Wallet('0x' + randomBytes(32).toString('hex'));

  console.log('funding party B/C from the devnet-granted account...');
  await fundAccount(deployment, deployerKeyHex, partyBWallet.address, 50_000_000_000_000_000n); // 0.05 ETH
  await fundAccount(deployment, deployerKeyHex, partyCWallet.address, 50_000_000_000_000_000n);

  const partyA = await buildPartyRig('party-a', deployment, deployerWallet.connect(new JsonRpcProvider(deployment.rpcUrl)), deployResult.applicationId);
  const partyB = await buildPartyRig('party-b', deployment, partyBWallet.connect(new JsonRpcProvider(deployment.rpcUrl)), deployResult.applicationId);
  const partyC = await buildPartyRig('party-c', deployment, partyCWallet.connect(new JsonRpcProvider(deployment.rpcUrl)), deployResult.applicationId);

  for (const party of [partyA, partyB, partyC]) {
    console.log(`ASSOCIATEKEY for ${party.label} (${party.wallet.address})...`);
    await associateKey(deployment, party.wallet.privateKey, party.p521PrivateKeyHex, deployResult.applicationId);
  }
  console.log('all parties registered.');

  const results: Record<string, unknown> = {
    startedAt,
    applicationId: deployResult.applicationId,
    wasmSha256: deployResult.wasmSha256,
    deployTxHash: deployResult.deployTxHash,
    attestationMode: 'EMULATED (no_attestation) — never Nitro-attested',
    parties: {
      A: { address: partyA.wallet.address, namespaceRef: partyA.namespaceRef },
      B: { address: partyB.wallet.address, namespaceRef: partyB.namespaceRef },
      C: { address: partyC.wallet.address, namespaceRef: partyC.namespaceRef },
    },
  };

  // ── Case A: unauthorized joint computation — invalid scope binding (a
  //    requestRef the real request does not carry) — expected UNRESOLVED for
  //    every party, no cross-party combination, no disclosure. Constructed
  //    at the raw wire level (not via buildVelaMultiPartyProjectionRequest,
  //    whose own gate 5 would refuse this before submission) specifically to
  //    prove the GUEST's OWN in-enclave enforcement, independent of our
  //    client-side gates — the defense-in-depth property those gates
  //    document but do not themselves prove end-to-end. ───────────────────
  console.log('\n=== Phase 5, Case A: unauthorized joint computation (invalid scope binding) ===');
  {
    const requestRef = randomUUID();
    const mismatchedBindingRef = randomUUID(); // deliberately NOT this request's own ref
    const scope: VelaMultiPartyDisclosureScope = {
      binding: {
        applicationId: deployResult.applicationId,
        requestRef: mismatchedBindingRef,
        operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
        outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
      },
      grants: [
        { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: partyA.namespaceRef },
        { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: partyB.namespaceRef },
        { action: VELA_SCOPE_ACTION_DISCLOSE_TO, party: partyB.namespaceRef, to: partyA.namespaceRef },
      ],
    };
    const rawRequest: VelaMultiPartyProjectionRequest = {
      type: VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE,
      requestRef,
      inputs: {
        [partyA.namespaceRef]: {
          recipientAddress: partyA.wallet.address,
          inputs: { currentExposure: 100, proposedSpend: 1900, privateSpendLimit: 5000, privateRiskLimit: 10000 },
        },
        [partyB.namespaceRef]: {
          recipientAddress: partyB.wallet.address,
          inputs: { currentExposure: 100, proposedSpend: 200, privateSpendLimit: 500, privateRiskLimit: 1000 },
        },
      },
      scope,
    };
    const plaintext = Buffer.from(JSON.stringify(rawRequest), 'utf8');
    const encryptedPayload = await partyA.adapter.encryptForTee(plaintext);
    const onChainRequestId = await partyA.adapter.submitProcessRequest(deployResult.applicationId, encryptedPayload);
    console.log('Case A onChainRequestId:', onChainRequestId);
    const dispositionA = await pollOutcome('Case A disposition (party A)', partyA.adapter, onChainRequestId);
    const dispositionB = await pollOutcome('Case A disposition (party B)', partyB.adapter, onChainRequestId);
    console.log('Case A — party A disposition:', dispositionA, '| party B disposition:', dispositionB);
    results.caseA = { onChainRequestId, requestRef, dispositionA, dispositionB, expected: 'UNRESOLVED for both' };
  }

  // ── Case B: authorized joint computation, restricted disclosure. A and B
  //    both grant COMPUTE_WITH; only B grants DISCLOSE_TO A (A sees the
  //    joint verdict, B sees only its own standalone verdict — never A's
  //    raw data, never the joint verdict it wasn't disclosed). ────────────
  console.log('\n=== Phase 5, Case B: authorized joint computation, restricted disclosure ===');
  let caseBRequestRef = '';
  {
    const requestRef = randomUUID();
    caseBRequestRef = requestRef;
    const scope: VelaMultiPartyDisclosureScope = {
      binding: {
        applicationId: deployResult.applicationId,
        requestRef,
        operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
        outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
      },
      grants: [
        { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: partyA.namespaceRef },
        { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: partyB.namespaceRef },
        { action: VELA_SCOPE_ACTION_DISCLOSE_TO, party: partyB.namespaceRef, to: partyA.namespaceRef },
      ],
    };
    const prepared = await prepareVelaMultiPartyProjection(partyA.adapter, {
      applicationId: deployResult.applicationId,
      requestRef,
      scope,
      parties: [
        {
          identities: { authorityPrincipal: partyA.wallet.address, confidentialPrivacyIdentity: 'vela-devnet-smoke:party-a' },
          recipientAddress: partyA.wallet.address,
          // Chosen so the JOINT verdict and party B's OWN standalone verdict
          // provably DIFFER (see the guest's combine formula: joint sums
          // exposure/spend across the group and checks the total against
          // EVERY member's own limits). A alone: spend 1900<=5000,
          // exposure+spend 2000<=10000 -> ACCEPTABLE standalone.
          inputs: { currentExposure: 100, proposedSpend: 1900, privateSpendLimit: 5000, privateRiskLimit: 10000 },
        },
        {
          identities: { authorityPrincipal: partyB.wallet.address, confidentialPrivacyIdentity: 'vela-devnet-smoke:party-b' },
          recipientAddress: partyB.wallet.address,
          // B alone: spend 200<=500, exposure+spend 300<=1000 -> ACCEPTABLE
          // standalone. But the JOINT totalSpend (1900+200=2100) exceeds
          // B's own privateSpendLimit (500) -> the guest's conservative
          // combine rule makes the JOINT verdict UNACCEPTABLE, decisively
          // different from B's own ACCEPTABLE standalone. If B ever
          // received the joint verdict instead of its own, this would show
          // up as UNACCEPTABLE where ACCEPTABLE was expected.
          inputs: { currentExposure: 100, proposedSpend: 200, privateSpendLimit: 500, privateRiskLimit: 1000 },
        },
      ],
    });
    const submission = await submitVelaMultiPartyProjection(partyA.adapter, prepared);
    console.log('Case B onChainRequestId:', submission.onChainRequestId);
    const dispositionA = await pollOutcome('Case B disposition (party A)', partyA.adapter, submission.onChainRequestId);
    const dispositionB = await pollOutcome('Case B disposition (party B)', partyB.adapter, submission.onChainRequestId);
    console.log('Case B — party A (joint, authorized) disposition:', dispositionA);
    console.log('Case B — party B (own standalone, NOT the joint verdict) disposition:', dispositionB);
    results.caseB = {
      onChainRequestId: submission.onChainRequestId,
      requestRef,
      dispositionA,
      dispositionB,
      expected:
        'party A: UNACCEPTABLE (joint — combined spend exceeds B own limit); party B: ACCEPTABLE (its own standalone verdict, decisively NOT the joint one)',
    };
  }

  // ── Case C: scope replay / non-transitivity — reuse Case B's exact grants
  //    and binding.requestRef against a DIFFERENT actual request — expected
  //    UNRESOLVED for every party (the guest's own binding check, not our
  //    client-side gate, which we bypass here on purpose). ────────────────
  console.log('\n=== Phase 5, Case C: scope replay (non-transitivity) ===');
  {
    const freshRequestRef = randomUUID(); // the ACTUAL request's own identity
    const replayedScope: VelaMultiPartyDisclosureScope = {
      binding: {
        applicationId: deployResult.applicationId,
        requestRef: caseBRequestRef, // Case B's requestRef, NOT this request's
        operationType: VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION,
        outputClass: VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT,
      },
      grants: [
        { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: partyA.namespaceRef },
        { action: VELA_SCOPE_ACTION_COMPUTE_WITH, party: partyB.namespaceRef },
        { action: VELA_SCOPE_ACTION_DISCLOSE_TO, party: partyB.namespaceRef, to: partyA.namespaceRef },
      ],
    };
    const rawRequest: VelaMultiPartyProjectionRequest = {
      type: VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE,
      requestRef: freshRequestRef,
      inputs: {
        [partyA.namespaceRef]: {
          recipientAddress: partyA.wallet.address,
          inputs: { currentExposure: 100, proposedSpend: 1900, privateSpendLimit: 5000, privateRiskLimit: 10000 },
        },
        [partyB.namespaceRef]: {
          recipientAddress: partyB.wallet.address,
          inputs: { currentExposure: 100, proposedSpend: 200, privateSpendLimit: 500, privateRiskLimit: 1000 },
        },
      },
      scope: replayedScope,
    };
    const plaintext = Buffer.from(JSON.stringify(rawRequest), 'utf8');
    const encryptedPayload = await partyA.adapter.encryptForTee(plaintext);
    const onChainRequestId = await partyA.adapter.submitProcessRequest(deployResult.applicationId, encryptedPayload);
    console.log('Case C onChainRequestId:', onChainRequestId);
    const dispositionA = await pollOutcome('Case C disposition (party A)', partyA.adapter, onChainRequestId);
    const dispositionB = await pollOutcome('Case C disposition (party B)', partyB.adapter, onChainRequestId);
    console.log('Case C — party A disposition:', dispositionA, '| party B disposition:', dispositionB);
    results.caseC = {
      onChainRequestId,
      requestRef: freshRequestRef,
      replayedBindingRequestRef: caseBRequestRef,
      dispositionA,
      dispositionB,
      expected: 'UNRESOLVED for both — a scope valid for one requestRef is rejected against another',
    };
  }

  results.finishedAt = new Date().toISOString();
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log('\n=== Done. Redacted results written to', OUT_PATH, '===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('public-devnet-smoke FAILED:', err);
  process.exit(1);
});
