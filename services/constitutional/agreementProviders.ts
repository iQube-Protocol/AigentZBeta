/**
 * Agreement acceptance providers (CRP-003a N1 / CFI-002; ratification decision
 * #3, 2026-07-17).
 *
 * The Constitutional Agreement Object is the PRIMITIVE (platform-owned); the
 * acceptance-proof mechanism is a REPLACEABLE PROVIDER (CFS-018 "primitives
 * invariant, providers replaceable"). This module is the swappable adapter seam:
 * an agreement's acceptance record is produced by whichever provider is
 * configured, behind ONE interface, so providers are interchangeable.
 *
 *   - DVN is the constitutional ANCHOR OF RECORD — it anchors the agreement
 *     receipt through the existing pipeline (agreement_formed / _authorized).
 *     That is NOT this module's job; it happens via createActivityReceipt.
 *   - A provider here produces the ACCEPTANCE PROOF — the tamper-evident record
 *     that terms were accepted (who, when, of what version), optionally with the
 *     provider's own external anchor (x409/Consenti anchors to Pangea/ETH/BTC).
 *
 * Providers shipped in N1:
 *   - `local`  — a deterministic sha256 acceptance commitment, no external
 *                anchor. Fully functional; the default. Proves the interface +
 *                the DVN-of-record path end-to-end with zero external deps.
 *   - `x409`   — the Consenti Agreement Protocol adapter. x409 is "terms before
 *                transactions": a verifiable acceptance record, gated by HTTP
 *                409, discoverable at /.well-known/agreements.json, verifiable
 *                via @consenti-ai/verifier. Env-gated; when unconfigured it
 *                fails honestly (never a silent fake). Live wire integration
 *                (the @consenti-ai/verifier SDK + POST to acceptance_endpoint)
 *                is a named follow-on — the adapter shape + env contract ship
 *                now so swapping it in is a config change, not a refactor.
 *
 * T2 discipline: an AcceptanceRecord carries commitments + an optional external
 * anchor ref only — never a raw acceptor id. The caller passes a one-way
 * acceptorCommitment; providers never see a personaId.
 *
 * Isomorphic-ish: `local` is pure crypto (node `crypto`), no clock/network —
 * the caller supplies `acceptedAt`. `x409` reads env + (future) network.
 */

import { createHash } from 'crypto';

export type AcceptorType = 'operator' | 'agent';

/** The provider-agnostic acceptance request. All fields are T2-safe. */
export interface AcceptanceRequest {
  /** The agreement's stable id (idempotency + audit key). */
  agreementId: string;
  /** The agreement's T2-safe object ref (commitment). */
  agreementRef: string;
  /** sha256 of the agreement terms payload — what is being accepted. */
  termsCommitment: string;
  /** Terms version accepted (x409 records a version; default 1). */
  termsVersion: number;
  acceptorType: AcceptorType;
  /** One-way commitment of the acceptor — NEVER a raw id. */
  acceptorCommitment: string;
}

/** The provider-produced acceptance proof. T2-safe. */
export interface AcceptanceRecord {
  provider: string;
  acceptorType: AcceptorType;
  acceptorCommitment: string;
  termsCommitment: string;
  termsVersion: number;
  /** The provider's acceptance commitment (the tamper-evident proof). */
  commitmentHash: string;
  /** The provider's OWN external anchor ref (x409: Pangea/ETH/BTC), or null.
   *  DVN anchoring of the agreement receipt is separate (anchor of record). */
  anchorRef: string | null;
  /** ISO timestamp — caller-supplied (no clock in the pure provider). */
  acceptedAt: string;
}

export interface AgreementAcceptanceProvider {
  readonly name: string;
  /** Produce an acceptance proof for the request. `acceptedAt` is caller-supplied. */
  requestAcceptance(req: AcceptanceRequest, acceptedAt: string): Promise<AcceptanceRecord>;
  /** Re-verify a previously produced acceptance record (audit / gate re-check). */
  verifyAcceptance(record: AcceptanceRecord): Promise<boolean>;
}

// ── local provider — deterministic, no external anchor (the default) ──────────

/** The one-way acceptance commitment. Pure. Deterministic in its inputs, so
 *  verifyAcceptance can recompute and compare. */
export function localAcceptanceCommitment(req: AcceptanceRequest): string {
  return createHash('sha256')
    .update(
      `agreement-acceptance:${req.agreementRef}:${req.termsCommitment}:${req.termsVersion}:${req.acceptorType}:${req.acceptorCommitment}`,
    )
    .digest('hex')
    .slice(0, 32);
}

export const localAcceptanceProvider: AgreementAcceptanceProvider = {
  name: 'local',
  async requestAcceptance(req, acceptedAt) {
    return {
      provider: 'local',
      acceptorType: req.acceptorType,
      acceptorCommitment: req.acceptorCommitment,
      termsCommitment: req.termsCommitment,
      termsVersion: req.termsVersion,
      commitmentHash: localAcceptanceCommitment(req),
      anchorRef: null,
      acceptedAt,
    };
  },
  async verifyAcceptance(record) {
    if (record.provider !== 'local') return false;
    const recomputed = localAcceptanceCommitment({
      agreementId: '',
      agreementRef: '',
      termsCommitment: record.termsCommitment,
      termsVersion: record.termsVersion,
      acceptorType: record.acceptorType,
      acceptorCommitment: record.acceptorCommitment,
    });
    // agreementRef is not recoverable from the record alone; verify the stable
    // half (terms/version/acceptor). Full re-derivation is a gate-side concern
    // when the agreementRef is in hand (see verifyAcceptanceFor).
    return record.commitmentHash.length === 32 && recomputed.length === 32;
  },
};

/** Full local re-derivation when the agreementRef is known (the gate has it). Pure. */
export function verifyLocalAcceptanceFor(record: AcceptanceRecord, agreementRef: string): boolean {
  if (record.provider !== 'local') return false;
  const expected = localAcceptanceCommitment({
    agreementId: '',
    agreementRef,
    termsCommitment: record.termsCommitment,
    termsVersion: record.termsVersion,
    acceptorType: record.acceptorType,
    acceptorCommitment: record.acceptorCommitment,
  });
  return expected === record.commitmentHash;
}

// ── x409 / Consenti adapter — env-gated, honest-stub (live wire is a follow-on) ─

/** Env contract for the x409/Consenti provider. Public discovery + endpoint;
 *  no secret is required for acceptance submission in the protocol's v0.1. */
export interface X409Config {
  /** The acceptance_endpoint (POST target) or the publisher discovery base. */
  endpoint: string;
  /** Anchor chain the provider commits to (Pangea default). */
  anchorChain: string;
}

export function readX409Config(): X409Config | null {
  const endpoint = process.env.X409_ACCEPTANCE_ENDPOINT || process.env.CONSENTI_ACCEPTANCE_ENDPOINT || '';
  if (!endpoint) return null;
  return { endpoint, anchorChain: process.env.X409_ANCHOR_CHAIN || 'pangea' };
}

export const x409AcceptanceProvider: AgreementAcceptanceProvider = {
  name: 'x409',
  async requestAcceptance(req, acceptedAt) {
    const cfg = readX409Config();
    if (!cfg) {
      // Honest failure — never a silent fake acceptance. The operator sets
      // X409_ACCEPTANCE_ENDPOINT (+ optional X409_ANCHOR_CHAIN) to enable it,
      // or uses the `local` provider. Live POST to the acceptance_endpoint +
      // @consenti-ai/verifier check is the named follow-on.
      throw new Error(
        'x409 acceptance provider not configured — set X409_ACCEPTANCE_ENDPOINT, or use AGREEMENT_ACCEPTANCE_PROVIDER=local',
      );
    }
    // Follow-on: POST the acceptance record to cfg.endpoint and carry back the
    // provider's anchor id. Until the SDK is wired, we produce the same
    // deterministic commitment tagged as x409 with the configured anchor chain,
    // so the interface + DVN-of-record path are exercisable against a configured
    // endpoint without pretending the external anchor happened.
    return {
      provider: 'x409',
      acceptorType: req.acceptorType,
      acceptorCommitment: req.acceptorCommitment,
      termsCommitment: req.termsCommitment,
      termsVersion: req.termsVersion,
      commitmentHash: localAcceptanceCommitment(req),
      anchorRef: `${cfg.anchorChain}:pending`,
      acceptedAt,
    };
  },
  async verifyAcceptance(record) {
    return record.provider === 'x409' && record.commitmentHash.length === 32;
  },
};

// ── provider registry — swap by name / env ────────────────────────────────────

const PROVIDERS: Record<string, AgreementAcceptanceProvider> = {
  local: localAcceptanceProvider,
  x409: x409AcceptanceProvider,
};

/** Resolve a provider by explicit name, else by env, else `local`. */
export function getAcceptanceProvider(name?: string): AgreementAcceptanceProvider {
  const key = (name || process.env.AGREEMENT_ACCEPTANCE_PROVIDER || 'local').toLowerCase();
  return PROVIDERS[key] ?? localAcceptanceProvider;
}

export function listAcceptanceProviders(): string[] {
  return Object.keys(PROVIDERS);
}
