/**
 * Vela pre-Early-Access hardening — item 1 (config externalization) and
 * item 2 (attestation state explicit + fail closed), scoped to
 * services/vela/velaConfig.ts.
 *
 * `docs/vela/VELA-LIVE-ACTIVATION-001.md` §1 names `velaConfig.ts` as the ONE
 * config surface that should change to retarget from the local Docker
 * Compose stack to a real Horizen-provisioned instance. These canaries prove:
 *   - `'local'` is unconditionally safe and unchanged (no env vars involved).
 *   - `'early_access'` reads every coordinate from an env var and throws a
 *     specific, named error for the first missing or malformed one — never a
 *     guessed endpoint, never a silent fallback to the local stack.
 *   - An unrecognised `attestationMode` string fails closed with a clear
 *     error rather than being silently coerced to `'no_attestation'`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VELA_LOCAL_DEPLOYMENT, resolveVelaDeployment } from '@/services/vela/velaConfig';

const EARLY_ACCESS_VARS = [
  'VELA_EARLY_ACCESS_CHAIN_ID',
  'VELA_EARLY_ACCESS_RPC_URL',
  'VELA_EARLY_ACCESS_PROCESSOR_ENDPOINT_ADDRESS',
  'VELA_EARLY_ACCESS_TEE_AUTHENTICATOR_ADDRESS',
  'VELA_EARLY_ACCESS_AUTHORITY_SERVICE_URL',
  'VELA_EARLY_ACCESS_SUBGRAPH_URL',
  'VELA_EARLY_ACCESS_ATTESTATION_MODE',
] as const;

const VALID_EARLY_ACCESS_ENV: Record<(typeof EARLY_ACCESS_VARS)[number], string> = {
  VELA_EARLY_ACCESS_CHAIN_ID: '845320009',
  VELA_EARLY_ACCESS_RPC_URL: 'https://early-access.example.horizen.io/rpc',
  VELA_EARLY_ACCESS_PROCESSOR_ENDPOINT_ADDRESS: '0x1111111111111111111111111111111111111111',
  VELA_EARLY_ACCESS_TEE_AUTHENTICATOR_ADDRESS: '0x2222222222222222222222222222222222222222',
  VELA_EARLY_ACCESS_AUTHORITY_SERVICE_URL: 'https://early-access.example.horizen.io/authority',
  VELA_EARLY_ACCESS_SUBGRAPH_URL: 'https://early-access.example.horizen.io/subgraphs/name/hcce',
  VELA_EARLY_ACCESS_ATTESTATION_MODE: 'nitro_attested',
};

describe('resolveVelaDeployment', () => {
  const saved: Partial<Record<string, string | undefined>> = {};

  beforeEach(() => {
    for (const v of EARLY_ACCESS_VARS) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
  });

  afterEach(() => {
    for (const v of EARLY_ACCESS_VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it("'local' returns the proven local deployment unconditionally, no env vars involved", () => {
    expect(resolveVelaDeployment('local')).toBe(VELA_LOCAL_DEPLOYMENT);
    expect(resolveVelaDeployment('local').attestationMode).toBe('no_attestation');
  });

  it("'early_access' throws a specific missing-var error when nothing is configured", () => {
    expect(() => resolveVelaDeployment('early_access')).toThrow(
      /missing required env var VELA_EARLY_ACCESS_CHAIN_ID/,
    );
  });

  it('names the FIRST missing var, not a generic "not configured" message', () => {
    for (const [key, value] of Object.entries(VALID_EARLY_ACCESS_ENV)) {
      process.env[key] = value;
    }
    delete process.env.VELA_EARLY_ACCESS_SUBGRAPH_URL;
    expect(() => resolveVelaDeployment('early_access')).toThrow(
      /missing required env var VELA_EARLY_ACCESS_SUBGRAPH_URL/,
    );
  });

  it('never falls back to the local stack coordinates when early_access is requested but unconfigured', () => {
    let thrown = false;
    try {
      resolveVelaDeployment('early_access');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('resolves a fully-configured early_access deployment from env vars, matching them exactly', () => {
    for (const [key, value] of Object.entries(VALID_EARLY_ACCESS_ENV)) {
      process.env[key] = value;
    }
    const deployment = resolveVelaDeployment('early_access');
    expect(deployment).toEqual({
      chainId: 845320009,
      rpcUrl: VALID_EARLY_ACCESS_ENV.VELA_EARLY_ACCESS_RPC_URL,
      processorEndpointAddress: VALID_EARLY_ACCESS_ENV.VELA_EARLY_ACCESS_PROCESSOR_ENDPOINT_ADDRESS,
      teeAuthenticatorAddress: VALID_EARLY_ACCESS_ENV.VELA_EARLY_ACCESS_TEE_AUTHENTICATOR_ADDRESS,
      authorityServiceUrl: VALID_EARLY_ACCESS_ENV.VELA_EARLY_ACCESS_AUTHORITY_SERVICE_URL,
      subgraphUrl: VALID_EARLY_ACCESS_ENV.VELA_EARLY_ACCESS_SUBGRAPH_URL,
      attestationMode: 'nitro_attested',
    });
  });

  it('rejects a non-numeric chain id rather than coercing it (e.g. to NaN or 0)', () => {
    for (const [key, value] of Object.entries(VALID_EARLY_ACCESS_ENV)) {
      process.env[key] = value;
    }
    process.env.VELA_EARLY_ACCESS_CHAIN_ID = 'not-a-number';
    expect(() => resolveVelaDeployment('early_access')).toThrow(
      /VELA_EARLY_ACCESS_CHAIN_ID must be a positive integer/,
    );
  });

  it('fails closed on an unrecognised attestation-mode string instead of silently defaulting', () => {
    for (const [key, value] of Object.entries(VALID_EARLY_ACCESS_ENV)) {
      process.env[key] = value;
    }
    process.env.VELA_EARLY_ACCESS_ATTESTATION_MODE = 'probably_attested'; // not a real value
    expect(() => resolveVelaDeployment('early_access')).toThrow(
      /VELA_EARLY_ACCESS_ATTESTATION_MODE must be one of no_attestation, nitro_attested/,
    );
  });

  it('accepts "no_attestation" as a legitimate (if unusual) early-access value', () => {
    for (const [key, value] of Object.entries(VALID_EARLY_ACCESS_ENV)) {
      process.env[key] = value;
    }
    process.env.VELA_EARLY_ACCESS_ATTESTATION_MODE = 'no_attestation';
    expect(resolveVelaDeployment('early_access').attestationMode).toBe('no_attestation');
  });

  it('never accepts case variants — attestation mode is an exact enum match, not a fuzzy one', () => {
    for (const [key, value] of Object.entries(VALID_EARLY_ACCESS_ENV)) {
      process.env[key] = value;
    }
    process.env.VELA_EARLY_ACCESS_ATTESTATION_MODE = 'NITRO_ATTESTED';
    expect(() => resolveVelaDeployment('early_access')).toThrow(
      /VELA_EARLY_ACCESS_ATTESTATION_MODE must be one of/,
    );
  });
});
