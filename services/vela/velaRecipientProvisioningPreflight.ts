/**
 * Recipient provisioning preflight (Vela masterclass, 2026-09-16) — the
 * masterclass confirms that every `UserEvent.UserID` recipient a multi-party
 * request will address (the `recipientAddress` on each
 * `VelaMultiPartyContribution` — see `services/vela/velaMultiPartyProjection.ts`)
 * MUST already hold an active P-521 association registered on-chain via
 * `ASSOCIATEKEY` (`VELA_REQUEST_TYPE.ASSOCIATEKEY`, RequestType=3) BEFORE any
 * `PROCESS` request that addresses them is submitted; otherwise the Executor
 * returns an execution error (`errorCode 9 "no Secp521r1_PubKey found"`,
 * `docs/vela/VELA_EARLY_ACCESS_HANDOFF.md` §6) and the request fails at the
 * EXECUTION layer — never at the guest, since `ASSOCIATEKEY` never reaches
 * the WASM (`services/vela/wasm/projector/app/app.go` has no ASSOCIATEKEY
 * branch at all; the association lives entirely in the Executor/on-chain
 * registration layer `ProcessorEndpoint` mediates).
 *
 * This module exists so that failure surfaces EARLY, read-only, and BEFORE
 * any signer is resolved or anything is written/submitted — mirroring the
 * existing `RES-2026-08-22-VELA-ASSOCIATEKEY-PROVISIONING-001` rule
 * ("ASSOCIATEKEY is a provisioning/bootstrap step, never a transaction-time
 * repair") but as a genuine PREFLIGHT CHECK rather than a documentation-only
 * discipline.
 *
 * NEVER INFERS REGISTRATION FROM LOCAL KEY POSSESSION. A caller deriving or
 * holding a P-521 key (`services/vela/agentP521Derivation.ts`) proves
 * NOTHING about whether that key's public half was ever actually submitted
 * on-chain via `ASSOCIATEKEY` — this module verifies the EXECUTOR/CONTRACT
 * REGISTRY STATE itself, by re-deriving the SAME chain-of-evidence pattern
 * `services/vela/velaApplicationDeploymentReceipt.ts` already established for
 * deployment verification: decode the ASSOCIATEKEY `submitRequest`
 * transaction's OWN `requestType` argument from calldata (never assumed from
 * context or a local flag), cross-referenced against a matching successful
 * `RequestCompleted` for that exact `requestId` — using ONLY the existing,
 * pinned v0.2.0 `ProcessorEndpoint` ABI surface (`RequestSubmitted`/
 * `RequestCompleted`/`submitRequest` — the SAME events
 * `services/vela/velaClientAdapter.ts`'s own `PROCESSOR_ABI` already
 * declares; no new, independently-drifting ABI is introduced).
 *
 * EVENT-SEED REGISTRATION IS OPTIONAL, NEVER BLOCKING. An `ASSOCIATEKEY`
 * payload MAY additionally carry a 93-byte ECDH-encrypted privacy seed
 * (`docs/vela/VELA-PRIVACY-BOUNDARY-001.md`: "sent ECDH-encrypted inside the
 * 226-byte ASSOCIATEKEY payload" = 133-byte pubkey + 93-byte seed envelope).
 * Its presence is a PUBLIC WIRE-LEVEL FACT this module reads from the
 * payload's own BYTE LENGTH alone — never decrypting, never reading its
 * content, never treating that content as available. When a recipient's
 * event seed is absent, readiness is UNAFFECTED (event-seed registration is
 * opt-in per `VELA-PRIVACY-BOUNDARY-001` §3) and this module instead records
 * the resulting PRIVACY LIMITATION: without a seed, that recipient's
 * `UserEvent.eventSubType` falls back to the zero/no-privacy-seed scheme
 * (`app.go`: "EventSubType is left zero so the on-chain indexed topic
 * reveals nothing") — never a correlatable or identity-leaking value either
 * way, only a less private one of the two Vela already supports.
 *
 * REDACTED EVIDENCE ONLY. `VelaRecipientReadinessEvidence` carries the
 * recipient's on-chain address (itself PUBLIC wire data — the address a
 * multi-party request submits ON-CHAIN as `RecipientAddress`, not a T0
 * identifier or private key), a coarse association status, and a coarse
 * event-seed status. It NEVER carries a P-521 public key, a private key, a
 * devnet token, ciphertext, or the ASSOCIATEKEY payload's own bytes — only
 * counts/lengths/booleans derived from them.
 *
 * Server-side/tooling only (constructs a real, read-only ethers provider —
 * no wallet, no private key, ever — when using
 * `createVelaClientRecipientRegistryReader`).
 */

import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';
import { VELA_REQUEST_TYPE, type VelaDeploymentDescriptor } from './velaTypes';

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** `ProcessorEndpoint.PROTOCOL_VERSION` — 0 at v0.2.0 (same constant
 *  `velaClientAdapter.ts`'s own `PROTOCOL_VERSION` pins; not re-exported from
 *  there to avoid a read-only module depending on the write-path transport). */
const PROTOCOL_VERSION = 0;

/**
 * Pinned v0.2.0 `ProcessorEndpoint` ABI surface this module needs — a strict
 * SUBSET of `VelaClientAdapter`'s own `PROCESSOR_ABI` (never a second,
 * independently-drifting copy). `minFeePerRequest` is read-only; the
 * remaining three are exactly what both the read-only association check
 * ABOVE and `submitVelaAssociateKeyRequest` BELOW need — no other
 * `ProcessorEndpoint` method is ever called from this file.
 */
const RECIPIENT_REGISTRY_ABI = [
  'function submitRequest(uint8 protocolVersion, uint64 applicationId, uint8 requestType, bytes payload, address tokenAddress, uint256 assetAmount, uint256 maxFeeValue) payable returns (bytes32)',
  'function minFeePerRequest() view returns (uint256)',
  'event RequestSubmitted(uint64 indexed applicationId, bytes32 indexed requestId, address indexed sender, address facilitator)',
  'event RequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
];

/** ASSOCIATEKEY payload carrying ONLY the 133-byte P-521 public key (no
 *  privacy seed) — `docs/vela/VELA-SIGNER-TOPOLOGY-001.md` §6b. */
const ASSOCIATEKEY_PAYLOAD_LEN_KEY_ONLY = 133;
/** ASSOCIATEKEY payload carrying the public key PLUS the 93-byte
 *  ECDH-encrypted privacy seed envelope — `VELA-PRIVACY-BOUNDARY-001.md`
 *  ("...inside the 226-byte ASSOCIATEKEY payload" = 133 + 93). */
const ASSOCIATEKEY_PAYLOAD_LEN_WITH_SEED = 226;

export type VelaAssociationStatus = 'VERIFIED' | 'MISSING' | 'UNVERIFIABLE';
export type VelaEventSeedStatus = 'VERIFIED' | 'ABSENT' | 'UNVERIFIABLE';

/**
 * Redacted readiness evidence for ONE recipient. `recipientAddress` is the
 * only identifying field, and it is itself public on-chain wire data (the
 * exact value the multi-party request submits as `RecipientAddress`) — never
 * a T0 identifier, never key material.
 */
export interface VelaRecipientReadinessEvidence {
  recipientAddress: string;
  associationStatus: VelaAssociationStatus;
  associationDetail: string;
  eventSeedStatus: VelaEventSeedStatus;
  eventSeedDetail: string;
}

export interface VelaRecipientProvisioningPreflightResult {
  /** True iff EVERY recipient's `associationStatus` is `'VERIFIED'`. Event-seed
   *  status never affects this — see this file's own header. */
  ready: boolean;
  recipients: VelaRecipientReadinessEvidence[];
  /** Populated (non-null) whenever at least one recipient's `eventSeedStatus`
   *  is not `'VERIFIED'` — documents the resulting, non-blocking privacy
   *  exposure. `null` when every recipient's event seed is verified, or when
   *  there are no recipients to check. */
  privacyLimitation: string | null;
}

/**
 * The narrow, injectable seam this module's orchestration logic depends on —
 * mirrors this codebase's existing `VelaTransport`/`VelaTestTransport`
 * pattern (`services/vela/velaTypes.ts`, `velaTestTransport.ts`) so the
 * orchestrator (`checkVelaRecipientProvisioning`) is provable in CI without a
 * live RPC, and the real implementation
 * (`createVelaClientRecipientRegistryReader`) is the ONLY place that ever
 * touches the network.
 */
export interface VelaRecipientRegistryReader {
  checkRecipientAssociation(
    applicationId: string,
    recipientAddress: string,
  ): Promise<VelaRecipientReadinessEvidence>;
}

/**
 * Orchestrates the full preflight over a list of recipients — pure
 * composition over the injected `reader`, no network access of its own.
 * Vacuously passes (`ready: true`, no recipients) when `recipientAddresses`
 * is empty — a caller with nothing to check (e.g. a BLOCKED-outcome envelope
 * that will never submit to Vela at all) never pays for, or is blocked by,
 * a check that does not apply to it.
 */
export async function checkVelaRecipientProvisioning(
  reader: Pick<VelaRecipientRegistryReader, 'checkRecipientAssociation'>,
  applicationId: string,
  recipientAddresses: string[],
): Promise<VelaRecipientProvisioningPreflightResult> {
  const recipients: VelaRecipientReadinessEvidence[] = [];
  for (const recipientAddress of recipientAddresses) {
    recipients.push(await reader.checkRecipientAssociation(applicationId, recipientAddress));
  }
  const ready = recipients.every((r) => r.associationStatus === 'VERIFIED');
  const seedNotVerifiedCount = recipients.filter((r) => r.eventSeedStatus !== 'VERIFIED').length;
  const privacyLimitation =
    seedNotVerifiedCount > 0
      ? `${seedNotVerifiedCount} of ${recipients.length} recipient(s) do not have a VERIFIED encrypted event-seed ` +
        'registration — their UserEvent.eventSubType falls back to the zero/no-privacy-seed scheme (never a ' +
        'correlatable or identity-leaking value; see VELA-PRIVACY-BOUNDARY-001) rather than the seed-derived ' +
        'HMAC-unlinkable scheme. Event-seed registration is OPTIONAL and its absence never blocks readiness.'
      : null;
  return { ready, recipients, privacyLimitation };
}

/**
 * The REAL, read-only registry reader — constructs its own minimal
 * `JsonRpcProvider` + read-only `Contract` against `deployment.rpcUrl`. This
 * function's own contract: it NEVER accepts, constructs, or could construct
 * a signer/wallet/private key of any kind — every ethers call it makes is a
 * `queryFilter`/`getTransaction` read.
 *
 * For each recipient address: scans `RequestSubmitted` logs (from `fromBlock`
 * onward, default the chain's genesis) filtered to `sender === recipientAddress`
 * for this `applicationId`; for each, decodes the ORIGINAL `submitRequest`
 * transaction's own calldata (never assumed) to confirm `requestType ===
 * ASSOCIATEKEY` and reads the matching `RequestCompleted`'s `errorCode`. The
 * FIRST successfully-completed ASSOCIATEKEY found determines
 * `associationStatus: 'VERIFIED'` (and, from that SAME transaction's payload
 * BYTE LENGTH only, `eventSeedStatus`); if none of the address's submitted
 * requests qualify, `associationStatus: 'MISSING'`. A query/decode failure
 * (unreachable RPC, malformed response) resolves to `'UNVERIFIABLE'` for
 * that recipient — never silently treated as `'VERIFIED'` or `'MISSING'`.
 */
export function createVelaClientRecipientRegistryReader(
  deployment: Pick<VelaDeploymentDescriptor, 'rpcUrl' | 'processorEndpointAddress'>,
  opts?: { fromBlock?: number },
): VelaRecipientRegistryReader {
  const provider = new JsonRpcProvider(deployment.rpcUrl);
  const processor = new Contract(deployment.processorEndpointAddress, RECIPIENT_REGISTRY_ABI, provider);
  const iface = new Interface(RECIPIENT_REGISTRY_ABI);
  const fromBlock = opts?.fromBlock ?? 0;

  const unverifiable = (
    recipientAddress: string,
    associationDetail: string,
  ): VelaRecipientReadinessEvidence => ({
    recipientAddress,
    associationStatus: 'UNVERIFIABLE',
    associationDetail,
    eventSeedStatus: 'UNVERIFIABLE',
    eventSeedDetail: 'association could not be verified, so its event seed cannot be checked either',
  });

  return {
    async checkRecipientAssociation(applicationId, recipientAddress) {
      if (!HEX_ADDRESS_RE.test(recipientAddress)) {
        return unverifiable(recipientAddress, 'recipientAddress is not a well-formed 20-byte hex address');
      }

      let submitted;
      try {
        submitted = await processor.queryFilter(
          processor.filters.RequestSubmitted(BigInt(applicationId), null, recipientAddress),
          fromBlock,
        );
      } catch (err) {
        return unverifiable(
          recipientAddress,
          `registry query (RequestSubmitted) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (submitted.length === 0) {
        return {
          recipientAddress,
          associationStatus: 'MISSING',
          associationDetail:
            'no RequestSubmitted log found from this address for this applicationId — never submitted an ' +
            'ASSOCIATEKEY (or any) request.',
          eventSeedStatus: 'UNVERIFIABLE',
          eventSeedDetail: 'no association to check a seed against',
        };
      }

      for (const log of submitted) {
        const parsedLog = processor.interface.parseLog(log);
        if (!parsedLog) continue;
        const requestId = parsedLog.args.requestId as string;

        let tx;
        try {
          tx = await provider.getTransaction(log.transactionHash);
        } catch (err) {
          return unverifiable(
            recipientAddress,
            `could not fetch the submitting transaction: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        if (!tx) continue;

        let decoded;
        try {
          decoded = iface.parseTransaction({ data: tx.data });
        } catch {
          continue;
        }
        if (!decoded || decoded.name !== 'submitRequest') continue;
        if (Number(decoded.args.requestType) !== VELA_REQUEST_TYPE.ASSOCIATEKEY) continue;

        let completed;
        try {
          completed = await processor.queryFilter(
            processor.filters.RequestCompleted(BigInt(applicationId), requestId),
            fromBlock,
          );
        } catch (err) {
          return unverifiable(
            recipientAddress,
            `could not verify ASSOCIATEKEY completion status: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        if (completed.length === 0) continue; // this attempt is still pending, or never completed — keep scanning

        const completedParsed = processor.interface.parseLog(completed[0]);
        const errorCode = completedParsed ? Number(completedParsed.args.errorCode) : undefined;
        if (errorCode !== 0) continue; // this specific ASSOCIATEKEY attempt failed — keep scanning others

        // Payload BYTE LENGTH only — never the payload's own bytes (the
        // public key and any privacy-seed ciphertext never leave this scope).
        const payloadHex = (decoded.args.payload as string).replace(/^0x/, '');
        const payloadByteLength = payloadHex.length / 2;
        let eventSeedStatus: VelaEventSeedStatus;
        let eventSeedDetail: string;
        if (payloadByteLength === ASSOCIATEKEY_PAYLOAD_LEN_WITH_SEED) {
          eventSeedStatus = 'VERIFIED';
          eventSeedDetail = 'ASSOCIATEKEY payload carries the 226-byte pubkey+seed shape.';
        } else if (payloadByteLength === ASSOCIATEKEY_PAYLOAD_LEN_KEY_ONLY) {
          eventSeedStatus = 'ABSENT';
          eventSeedDetail = 'ASSOCIATEKEY payload carries only the 133-byte public key — no privacy seed registered.';
        } else {
          eventSeedStatus = 'UNVERIFIABLE';
          eventSeedDetail =
            `ASSOCIATEKEY payload is ${payloadByteLength} bytes — neither the known key-only (133) nor ` +
            'key+seed (226) shape.';
        }

        return {
          recipientAddress,
          associationStatus: 'VERIFIED',
          associationDetail: `ASSOCIATEKEY request ${requestId} completed successfully (errorCode 0).`,
          eventSeedStatus,
          eventSeedDetail,
        };
      }

      return {
        recipientAddress,
        associationStatus: 'MISSING',
        associationDetail:
          'found RequestSubmitted log(s) from this address, but none was a successfully completed ASSOCIATEKEY ' +
          'request.',
        eventSeedStatus: 'UNVERIFIABLE',
        eventSeedDetail: 'no verified association to check a seed against',
      };
    },
  };
}

// ── ASSOCIATEKEY submission (2026-09-16, UC0 final live blocker) ───────────
//
// The bootstrap/provisioning half of this module's own check above — submit
// ONE ASSOCIATEKEY request (RequestType=3) registering a 133-byte
// uncompressed P-521 public key against the caller's own EVM address
// (`requesterPrivateKeyHex`'s signer IS `msg.sender`, which is exactly the
// `sender` field `createVelaClientRecipientRegistryReader` above filters
// `RequestSubmitted` logs by), then waits for the authoritative
// `RequestCompleted` and requires `status === 0 && errorCode === 0` — never
// treating a pending or failed completion as success.
//
// Reuses, rather than reimplements, everything this needs: the SAME pinned
// `RECIPIENT_REGISTRY_ABI` and `VELA_REQUEST_TYPE.ASSOCIATEKEY` the read-only
// check above already uses (no second, drifting ABI/opcode copy), and the
// SAME on-chain wire shape `scripts/vela-slice2g-associate-key.ts` and
// `scripts/vela/public-devnet-smoke.ts`'s own `associateKey()` already prove
// live — this is that shape's one canonical, importable implementation, not
// a third hand-copy of it. Callers derive the P-521 keypair via the existing
// `deriveAgentP521KeyPair` (`services/vela/agentP521Derivation.ts`) — this
// function never derives, generates, or otherwise touches P-521 key material
// itself, only the already-derived public key's bytes.
export interface VelaAssociateKeySubmissionResult {
  recipientAddress: string;
  requestId: string;
  status: number;
  errorCode: number;
}

export async function submitVelaAssociateKeyRequest(
  deployment: Pick<VelaDeploymentDescriptor, 'rpcUrl' | 'processorEndpointAddress'>,
  applicationId: string,
  requesterPrivateKeyHex: string,
  p521PublicKeyHex: string,
  opts: { maxPollAttempts?: number; pollIntervalMs?: number } = {},
): Promise<VelaAssociateKeySubmissionResult> {
  const payload = Buffer.from(p521PublicKeyHex.replace(/^0x/, ''), 'hex');
  if (payload.length !== ASSOCIATEKEY_PAYLOAD_LEN_KEY_ONLY) {
    throw new Error(
      `submitVelaAssociateKeyRequest: expected a ${ASSOCIATEKEY_PAYLOAD_LEN_KEY_ONLY}-byte P-521 public key, got ` +
        `${payload.length} bytes — refusing to submit a malformed ASSOCIATEKEY payload.`,
    );
  }

  const provider = new JsonRpcProvider(deployment.rpcUrl);
  const wallet = new Wallet(requesterPrivateKeyHex, provider);
  const processor = new Contract(deployment.processorEndpointAddress, RECIPIENT_REGISTRY_ABI, wallet);
  const iface = new Interface(RECIPIENT_REGISTRY_ABI);

  const minFee: bigint = await processor.minFeePerRequest();
  const maxFee = minFee > 1_000_000n ? minFee : 1_000_000n;

  const tx = await processor.submitRequest(
    PROTOCOL_VERSION,
    BigInt(applicationId),
    VELA_REQUEST_TYPE.ASSOCIATEKEY,
    payload,
    '0x0000000000000000000000000000000000000000',
    0n,
    maxFee,
    { value: maxFee },
  );
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('submitVelaAssociateKeyRequest: submitRequest returned no receipt.');
  }

  let requestId: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'RequestSubmitted') requestId = parsed.args.requestId as string;
    } catch {
      /* not ours */
    }
  }
  if (!requestId) {
    throw new Error('submitVelaAssociateKeyRequest: no RequestSubmitted event found in the submission receipt.');
  }

  const maxPollAttempts = opts.maxPollAttempts ?? 30;
  const pollIntervalMs = opts.pollIntervalMs ?? 3000;
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    const completed = await processor.queryFilter(
      processor.filters.RequestCompleted(BigInt(applicationId), requestId),
      receipt.blockNumber,
    );
    if (completed.length > 0) {
      const parsed = processor.interface.parseLog(completed[0])!;
      const status = Number(parsed.args.status);
      const errorCode = Number(parsed.args.errorCode);
      if (status !== 0 || errorCode !== 0) {
        throw new Error(
          `submitVelaAssociateKeyRequest: ASSOCIATEKEY request ${requestId} completed with status=${status}, ` +
            `errorCode=${errorCode}, errorMessage="${String(parsed.args.errorMessage ?? '')}" — never treated as success.`,
        );
      }
      return { recipientAddress: wallet.address, requestId, status, errorCode };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`submitVelaAssociateKeyRequest: timed out waiting for RequestCompleted on request ${requestId}.`);
}
