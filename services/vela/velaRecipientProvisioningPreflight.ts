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

import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { VELA_REQUEST_TYPE, type VelaDeploymentDescriptor } from './velaTypes';

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Pinned v0.2.0 `ProcessorEndpoint` ABI surface this check needs — a strict
 * SUBSET of `VelaClientAdapter`'s own `PROCESSOR_ABI` (never a second,
 * independently-drifting copy of the write-path methods this module never
 * calls). Read-only: nothing here is ever invoked as a state-changing call.
 */
const RECIPIENT_REGISTRY_ABI = [
  'function submitRequest(uint8 protocolVersion, uint64 applicationId, uint8 requestType, bytes payload, address tokenAddress, uint256 assetAmount, uint256 maxFeeValue) payable returns (bytes32)',
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
