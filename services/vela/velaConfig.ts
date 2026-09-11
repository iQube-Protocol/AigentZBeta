/**
 * Vela deployment config.
 *
 * `VELA_LOCAL_DEPLOYMENT` is the exact coordinates proven live during Slice 2A
 * (VELA_LOCAL_READY): full deploy → register → deposit → confidential balance
 * read → two-party private transfer, all succeeding against these addresses
 * on the local `vela-starterkit` Docker Compose stack. See
 * docs/vela/VELA-ATTESTATION-BOUNDARY-001.md — this deployment runs
 * `NoAttestationTeeAuthenticator` (`attestationMode: 'no_attestation'`), NOT a
 * real Nitro-attested TeeAuthenticator.
 *
 * These values are the starter kit's own documented defaults
 * (`vela-starterkit/dockerfiles/README.md` §"Practical how-to") and were
 * independently confirmed against a live local run, not guessed.
 *
 * `resolveVelaDeployment('early_access')` is the ONE config surface
 * `docs/vela/VELA-LIVE-ACTIVATION-001.md` §1 names for retargeting from the
 * local Docker Compose stack to a real Horizen-provisioned instance — every
 * coordinate is read from an env var, none is guessed or defaulted to a
 * plausible-looking value (No-Guessing rule, CLAUDE.md). No early-access
 * instance exists yet, so every `VELA_EARLY_ACCESS_*` var is unset today; the
 * function throws a specific "missing X" error per absent var rather than
 * silently falling back to the local stack's coordinates or to `undefined`.
 *
 * `applicationId` deliberately has NO env var and is NOT part of
 * `VelaDeploymentDescriptor` — per
 * `RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001` /
 * `CI-2026-08-22-VELA-APPLICATION-ID-DEPLOYMENT-RECORD-001`, a Vela
 * `applicationId` is a property of one deployment TRANSACTION against a
 * specific chain's current state, never a durable identity for "the WASM
 * application" — baking it into static config would be exactly the mistake
 * that invariant exists to prevent. It stays a per-call parameter
 * (`createFactorConfidentialProjectionProvider({ applicationId })` and
 * equivalents), verified fresh against whichever chain is live before reuse.
 *
 * Server-side only — never import into client code (matches the CLAUDE.md
 * rule against NEXT_PUBLIC_-exposing any service-side config by accident;
 * nothing here is a secret, but the local stack is not a production target).
 */

import type { VelaAttestationMode, VelaDeploymentDescriptor } from './velaTypes';

export const VELA_LOCAL_DEPLOYMENT: VelaDeploymentDescriptor = {
  chainId: 31337,
  rpcUrl: 'http://localhost:8545',
  processorEndpointAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  teeAuthenticatorAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  authorityServiceUrl: 'http://localhost:8081',
  subgraphUrl: 'http://localhost:8000/subgraphs/name/hcce',
  attestationMode: 'no_attestation',
};

export type VelaEnv = 'local' | 'early_access';

/** The only two spellings `VelaAttestationMode` accepts. Kept as a runtime
 *  list (not just the type) so an unrecognised env var value fails closed
 *  with a specific message instead of an `as` cast silently lying. */
const VALID_ATTESTATION_MODES: readonly VelaAttestationMode[] = [
  'no_attestation',
  'nitro_attested',
];

/** Reads a required env var for the early-access deployment, throwing a
 *  specific "missing X" error rather than defaulting to a guessed value —
 *  per CLAUDE.md's No-Guessing rule, applied to Vela deployment coordinates. */
function requireEnv(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(
      `resolveVelaDeployment('early_access'): missing required env var ${varName} — ` +
        'no Vela early-access deployment coordinate may be guessed or defaulted. ' +
        'Set it to the value Horizen provisions (see docs/vela/VELA-LIVE-ACTIVATION-001.md §1).',
    );
  }
  return value;
}

function resolveEarlyAccessDeployment(): VelaDeploymentDescriptor {
  const chainIdRaw = requireEnv('VELA_EARLY_ACCESS_CHAIN_ID');
  const chainId = Number(chainIdRaw);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(
      `resolveVelaDeployment('early_access'): VELA_EARLY_ACCESS_CHAIN_ID must be a positive integer, got "${chainIdRaw}".`,
    );
  }

  const attestationModeRaw = requireEnv('VELA_EARLY_ACCESS_ATTESTATION_MODE');
  if (!VALID_ATTESTATION_MODES.includes(attestationModeRaw as VelaAttestationMode)) {
    // Fail closed: an unrecognised attestation-mode string must never be
    // silently coerced (e.g. defaulting to 'no_attestation') — that would
    // let a misconfigured env var quietly downgrade the attestation the
    // rest of the constitutional pipeline believes it is getting.
    throw new Error(
      `resolveVelaDeployment('early_access'): VELA_EARLY_ACCESS_ATTESTATION_MODE must be one of ${VALID_ATTESTATION_MODES.join(
        ', ',
      )}, got "${attestationModeRaw}". Per VELA-ATTESTATION-BOUNDARY-001, this fact cannot be inferred — it must be recorded explicitly and correctly.`,
    );
  }

  return {
    chainId,
    rpcUrl: requireEnv('VELA_EARLY_ACCESS_RPC_URL'),
    processorEndpointAddress: requireEnv('VELA_EARLY_ACCESS_PROCESSOR_ENDPOINT_ADDRESS'),
    teeAuthenticatorAddress: requireEnv('VELA_EARLY_ACCESS_TEE_AUTHENTICATOR_ADDRESS'),
    authorityServiceUrl: requireEnv('VELA_EARLY_ACCESS_AUTHORITY_SERVICE_URL'),
    subgraphUrl: requireEnv('VELA_EARLY_ACCESS_SUBGRAPH_URL'),
    attestationMode: attestationModeRaw as VelaAttestationMode,
  };
}

/**
 * Resolves a Vela deployment descriptor by named environment.
 *
 * `'local'` always returns the proven local Docker Compose coordinates —
 * unconditionally safe, no env vars involved, matches every existing caller's
 * behavior exactly (no behavior change for `'local'`).
 *
 * `'early_access'` reads every coordinate from a `VELA_EARLY_ACCESS_*` env
 * var and throws a specific, named error for the first one that is missing
 * or malformed — this function will not run, partially configured, against a
 * guessed endpoint. See docs/vela/VELA_EARLY_ACCESS_HANDOFF.md for what
 * Horizen provisions before these vars can be set for real.
 */
export function resolveVelaDeployment(env: VelaEnv): VelaDeploymentDescriptor {
  if (env === 'local') return VELA_LOCAL_DEPLOYMENT;
  if (env === 'early_access') return resolveEarlyAccessDeployment();
  throw new Error(
    `resolveVelaDeployment: unrecognised env "${env}" — only "local" and "early_access" exist.`,
  );
}
