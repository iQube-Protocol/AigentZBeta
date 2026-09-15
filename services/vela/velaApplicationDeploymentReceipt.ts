/**
 * Canonical Vela application-deployment receipt (Vela/Horizen v0.2.0
 * feedback, 2026-09-16). Reconstructs and verifies WHICH WASM a given
 * `applicationId` actually is — `applicationId` alone does NOT prove this
 * (Horizen's own finding 1): it is an integer the chain assigns, with no
 * intrinsic binding to any artifact. The binding is a CHAIN OF EVIDENCE:
 *
 *   deploy transaction input (carries the WASM sha256, unencrypted)
 *     -> DeployRequestSubmitted (binds that deploy request to the assigned applicationId)
 *     -> DeployRequestCompleted (proves the deployment actually SUCCEEDED, for THAT applicationId/requestId)
 *
 * This receipt is the smallest canonical type that carries all three links
 * plus the identifiers needed to independently cross-check them — it never
 * asserts "applicationId proves the WASM"; its validity comes entirely from
 * `assembleVelaApplicationDeploymentReceipt`/`verifyVelaApplicationDeploymentReceipt`
 * actually re-deriving and matching that chain, fail-closed.
 *
 * NEVER placed on this receipt: a private key, a devnet capability token,
 * or any other secret. Only public, already-on-chain-or-uploaded facts.
 *
 * Server-side/tooling only.
 */

export const VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION = 'vela-application-deployment-receipt/v1';

export interface VelaApplicationDeploymentReceiptNetwork {
  chainId: number;
  processorEndpointAddress: string;
  /** `ProcessorEndpoint.PROTOCOL_VERSION` at deploy time (0 for v0.2.0). */
  protocolVersion: number;
}

export interface VelaApplicationDeploymentReceiptTransaction {
  hash: string;
  blockNumber: number | null;
  /**
   * The WASM sha256 decoded from the deploy transaction's OWN unencrypted
   * `submitDeployRequest` payload argument — reconstructed independently,
   * never merely copied from an upload-service response (Horizen finding 2:
   * "the WASM hash is inside the unencrypted deploy-request transaction
   * input"). This is the field `wasm.sha256` below is checked against.
   */
  inputWasmSha256: string;
  inputArtifactId: string;
  /** The deploy payload's own declared mode — `'artifact_ref'` for the
   *  current smoke-script deploy path; carried through, never assumed. */
  inputMode: string;
}

export interface VelaApplicationDeploymentReceiptSubmitted {
  requestId: string;
  applicationId: string;
}

export interface VelaApplicationDeploymentReceiptCompleted {
  requestId: string;
  applicationId: string;
  /** `DeployRequestCompleted.status` — 0 = completed, 1 = failed (same
   *  authoritative-status convention as process-request completion). */
  status: number;
  errorCode: number;
  errorMessage: string;
}

export interface VelaApplicationDeploymentReceipt {
  schemaVersion: typeof VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION;
  network: VelaApplicationDeploymentReceiptNetwork;
  wasm: { sha256: string };
  deployTransaction: VelaApplicationDeploymentReceiptTransaction;
  deployRequestSubmitted: VelaApplicationDeploymentReceiptSubmitted;
  deployRequestCompleted: VelaApplicationDeploymentReceiptCompleted;
  /** The applicationId this receipt verifies — always equal to both
   *  `deployRequestSubmitted.applicationId` and
   *  `deployRequestCompleted.applicationId` (checked; never trusted). */
  applicationId: string;
  attestationMode: 'no_attestation' | 'nitro_attested';
  /**
   * True for the public Synsema devnet (and any other explicitly ephemeral
   * deployment target) — an `applicationId` bound here is NOT durable and
   * will not survive the devnet's periodic resets (Horizen's own operator
   * description). A consumer MUST treat `ephemeral: true` as informational,
   * never as a reason to skip verification.
   */
  ephemeral: boolean;
  authorityServiceUrl?: string;
  artifactId?: string;
  /** Only ever set from a genuinely sourced timestamp (e.g. the block's own
   *  timestamp, or the moment this receipt was assembled) — never
   *  synthesized/guessed when the source is unavailable. */
  observedAt: string | null;
}

/** Raw evidence a caller has ALREADY fetched (from a live deploy, or from
 *  re-decoding an existing on-chain transaction) — this module does no
 *  network I/O of its own; it only assembles and verifies. */
export interface RawVelaApplicationDeploymentEvidence {
  network: VelaApplicationDeploymentReceiptNetwork;
  localWasmSha256: string;
  deployTransaction: VelaApplicationDeploymentReceiptTransaction | null;
  deployRequestSubmitted: VelaApplicationDeploymentReceiptSubmitted | null;
  deployRequestCompleted: VelaApplicationDeploymentReceiptCompleted | null;
  attestationMode: 'no_attestation' | 'nitro_attested';
  ephemeral: boolean;
  authorityServiceUrl?: string;
  artifactId?: string;
  observedAt?: string | null;
}

class VelaApplicationDeploymentReceiptError extends Error {
  constructor(reason: string) {
    super(`VelaApplicationDeploymentReceipt: ${reason}`);
    this.name = 'VelaApplicationDeploymentReceiptError';
  }
}

/** The cross-consistency checks shared by BOTH assembly (from live evidence)
 *  and verification (of an already-persisted receipt) — one place, never
 *  duplicated between the two entry points below. */
function assertReceiptInternallyConsistent(r: {
  wasm: { sha256: string };
  deployTransaction: VelaApplicationDeploymentReceiptTransaction;
  deployRequestSubmitted: VelaApplicationDeploymentReceiptSubmitted;
  deployRequestCompleted: VelaApplicationDeploymentReceiptCompleted;
  applicationId: string;
}): void {
  if (r.deployTransaction.inputWasmSha256 !== r.wasm.sha256) {
    throw new VelaApplicationDeploymentReceiptError(
      `WASM hash mismatch: the deploy transaction's own input carries "${r.deployTransaction.inputWasmSha256}", ` +
        `but this receipt claims sha256 "${r.wasm.sha256}" — refusing to trust applicationId "${r.applicationId}" ` +
        'for a different WASM than was actually deployed.',
    );
  }
  if (r.deployRequestSubmitted.requestId !== r.deployRequestCompleted.requestId) {
    throw new VelaApplicationDeploymentReceiptError(
      `request ID mismatch: DeployRequestSubmitted requestId "${r.deployRequestSubmitted.requestId}" does not ` +
        `match DeployRequestCompleted requestId "${r.deployRequestCompleted.requestId}" — these must be the ` +
        'SAME on-chain deploy request; refusing to correlate two different requests.',
    );
  }
  if (
    r.deployRequestSubmitted.applicationId !== r.deployRequestCompleted.applicationId ||
    r.deployRequestSubmitted.applicationId !== r.applicationId
  ) {
    throw new VelaApplicationDeploymentReceiptError(
      `applicationId mismatch across evidence: DeployRequestSubmitted="${r.deployRequestSubmitted.applicationId}", ` +
        `DeployRequestCompleted="${r.deployRequestCompleted.applicationId}", receipt.applicationId="${r.applicationId}" ` +
        '— all three must agree; applicationId alone never proves WASM identity (see this file\'s own header).',
    );
  }
  if (r.deployRequestCompleted.status !== 0 || r.deployRequestCompleted.errorCode !== 0) {
    throw new VelaApplicationDeploymentReceiptError(
      `deployment did not complete successfully: DeployRequestCompleted status=${r.deployRequestCompleted.status}, ` +
        `errorCode=${r.deployRequestCompleted.errorCode} ("${r.deployRequestCompleted.errorMessage}") — refusing to ` +
        `treat applicationId "${r.applicationId}" as a valid, usable deployment.`,
    );
  }
}

/**
 * Assembles and verifies a receipt from RAW, already-fetched evidence — the
 * function `scripts/vela/public-devnet-smoke.ts`'s deploy step calls
 * immediately after a deploy succeeds. Fails closed on every condition the
 * corrective instruction names: missing transaction input, mismatched
 * request/application IDs, mismatched WASM hashes, failed deployment
 * status, or malformed/incomplete evidence (missing `deployTransaction`/
 * `deployRequestSubmitted`/`deployRequestCompleted` at all).
 */
export function assembleVelaApplicationDeploymentReceipt(
  evidence: RawVelaApplicationDeploymentEvidence,
): VelaApplicationDeploymentReceipt {
  if (!evidence.deployTransaction) {
    throw new VelaApplicationDeploymentReceiptError(
      'missing deploy transaction input — cannot reconstruct the WASM-hash binding without it.',
    );
  }
  if (!evidence.deployRequestSubmitted) {
    throw new VelaApplicationDeploymentReceiptError('missing DeployRequestSubmitted evidence.');
  }
  if (!evidence.deployRequestCompleted) {
    throw new VelaApplicationDeploymentReceiptError('missing DeployRequestCompleted evidence.');
  }

  const applicationId = evidence.deployRequestSubmitted.applicationId;
  const receipt: VelaApplicationDeploymentReceipt = {
    schemaVersion: VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION,
    network: evidence.network,
    wasm: { sha256: evidence.localWasmSha256 },
    deployTransaction: evidence.deployTransaction,
    deployRequestSubmitted: evidence.deployRequestSubmitted,
    deployRequestCompleted: evidence.deployRequestCompleted,
    applicationId,
    attestationMode: evidence.attestationMode,
    ephemeral: evidence.ephemeral,
    authorityServiceUrl: evidence.authorityServiceUrl,
    artifactId: evidence.artifactId,
    observedAt: evidence.observedAt ?? null,
  };

  assertReceiptInternallyConsistent(receipt);
  return receipt;
}

/** True structural check — every field present with the right primitive
 *  type. Named per-field so a malformed persisted receipt fails with a
 *  specific, actionable reason rather than a generic parse error. */
function assertReceiptWellFormed(raw: unknown): asserts raw is VelaApplicationDeploymentReceipt {
  if (typeof raw !== 'object' || raw === null) {
    throw new VelaApplicationDeploymentReceiptError('receipt must be a JSON object.');
  }
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION) {
    throw new VelaApplicationDeploymentReceiptError(
      `unrecognised or missing schemaVersion (expected "${VELA_APPLICATION_DEPLOYMENT_RECEIPT_SCHEMA_VERSION}", ` +
        `got ${JSON.stringify(r.schemaVersion)}).`,
    );
  }
  const need = (path: string, value: unknown, kind: 'string' | 'number' | 'boolean' | 'object'): void => {
    if (kind === 'object') {
      if (typeof value !== 'object' || value === null) {
        throw new VelaApplicationDeploymentReceiptError(`missing or malformed field: ${path}.`);
      }
      return;
    }
    if (typeof value !== kind) {
      throw new VelaApplicationDeploymentReceiptError(`missing or malformed field: ${path} (expected ${kind}).`);
    }
  };
  need('network', r.network, 'object');
  const network = r.network as Record<string, unknown>;
  need('network.chainId', network.chainId, 'number');
  need('network.processorEndpointAddress', network.processorEndpointAddress, 'string');
  need('network.protocolVersion', network.protocolVersion, 'number');

  need('wasm', r.wasm, 'object');
  need('wasm.sha256', (r.wasm as Record<string, unknown>).sha256, 'string');

  need('deployTransaction', r.deployTransaction, 'object');
  const dt = r.deployTransaction as Record<string, unknown>;
  need('deployTransaction.hash', dt.hash, 'string');
  need('deployTransaction.inputWasmSha256', dt.inputWasmSha256, 'string');
  need('deployTransaction.inputArtifactId', dt.inputArtifactId, 'string');
  need('deployTransaction.inputMode', dt.inputMode, 'string');

  need('deployRequestSubmitted', r.deployRequestSubmitted, 'object');
  const drs = r.deployRequestSubmitted as Record<string, unknown>;
  need('deployRequestSubmitted.requestId', drs.requestId, 'string');
  need('deployRequestSubmitted.applicationId', drs.applicationId, 'string');

  need('deployRequestCompleted', r.deployRequestCompleted, 'object');
  const drc = r.deployRequestCompleted as Record<string, unknown>;
  need('deployRequestCompleted.requestId', drc.requestId, 'string');
  need('deployRequestCompleted.applicationId', drc.applicationId, 'string');
  need('deployRequestCompleted.status', drc.status, 'number');
  need('deployRequestCompleted.errorCode', drc.errorCode, 'number');
  need('deployRequestCompleted.errorMessage', drc.errorMessage, 'string');

  need('applicationId', r.applicationId, 'string');
  need('attestationMode', r.attestationMode, 'string');
  if (r.attestationMode !== 'no_attestation' && r.attestationMode !== 'nitro_attested') {
    throw new VelaApplicationDeploymentReceiptError(
      `attestationMode must be "no_attestation" or "nitro_attested", got ${JSON.stringify(r.attestationMode)}.`,
    );
  }
  need('ephemeral', r.ephemeral, 'boolean');
}

/**
 * Verifies an already-persisted receipt (e.g. read from a JSON file) — pure
 * and LOCAL: re-runs the exact same cross-consistency checks
 * `assembleVelaApplicationDeploymentReceipt` runs, entirely from the
 * receipt's own embedded fields, with no live chain call. This is what
 * `scripts/seedUseCaseZeroDemo.ts` calls to verify a `--deployment-receipt`
 * file BEFORE trusting its `applicationId` — including under `--preflight`,
 * where "inspect and validate without writing" is exactly this function's
 * own contract (it does no I/O beyond the object already in hand).
 */
export function verifyVelaApplicationDeploymentReceipt(raw: unknown): VelaApplicationDeploymentReceipt {
  assertReceiptWellFormed(raw);
  assertReceiptInternallyConsistent(raw);
  return raw;
}
