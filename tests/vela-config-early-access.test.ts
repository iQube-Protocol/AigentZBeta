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

/**
 * 'public_devnet' — the public Synsema Vela v0.2.0 devnet
 * (https://devnet.synsema.app/), added 2026-09-14 after running the current
 * MoneyPenny multi-party guest through its real deploy/register/submit/poll
 * lifecycle. Same fail-closed discipline as 'early_access': every coordinate
 * from an env var, no guessed endpoint, no silent fallback. Unlike
 * 'early_access', attestationMode is NOT env-configurable — this specific
 * public instance is documented (by its own devnet page) as unconditionally
 * "no attestation", so there is no attestation-mode var to mis-set.
 */
const PUBLIC_DEVNET_VARS = [
  'VELA_PUBLIC_DEVNET_CHAIN_ID',
  'VELA_PUBLIC_DEVNET_RPC_URL',
  'VELA_PUBLIC_DEVNET_PROCESSOR_ENDPOINT_ADDRESS',
  'VELA_PUBLIC_DEVNET_TEE_AUTHENTICATOR_ADDRESS',
  'VELA_PUBLIC_DEVNET_AUTHORITY_SERVICE_URL',
  'VELA_PUBLIC_DEVNET_SUBGRAPH_URL',
] as const;

const VALID_PUBLIC_DEVNET_ENV: Record<(typeof PUBLIC_DEVNET_VARS)[number], string> = {
  VELA_PUBLIC_DEVNET_CHAIN_ID: '31337',
  VELA_PUBLIC_DEVNET_RPC_URL: 'https://devnet.synsema.app/EXAMPLE-TOKEN/rpc',
  VELA_PUBLIC_DEVNET_PROCESSOR_ENDPOINT_ADDRESS: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  VELA_PUBLIC_DEVNET_TEE_AUTHENTICATOR_ADDRESS: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  VELA_PUBLIC_DEVNET_AUTHORITY_SERVICE_URL: 'https://devnet.synsema.app/EXAMPLE-TOKEN/authority',
  VELA_PUBLIC_DEVNET_SUBGRAPH_URL: 'https://devnet.synsema.app/EXAMPLE-TOKEN/subgraph/subgraphs/name/hcce',
};

describe("resolveVelaDeployment('public_devnet')", () => {
  const saved: Partial<Record<string, string | undefined>> = {};

  beforeEach(() => {
    for (const v of PUBLIC_DEVNET_VARS) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
  });

  afterEach(() => {
    for (const v of PUBLIC_DEVNET_VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it('throws a specific missing-var error when nothing is configured', () => {
    expect(() => resolveVelaDeployment('public_devnet')).toThrow(
      /missing required env var VELA_PUBLIC_DEVNET_CHAIN_ID/,
    );
  });

  it('names the FIRST missing var, not a generic "not configured" message', () => {
    for (const [key, value] of Object.entries(VALID_PUBLIC_DEVNET_ENV)) {
      process.env[key] = value;
    }
    delete process.env.VELA_PUBLIC_DEVNET_AUTHORITY_SERVICE_URL;
    expect(() => resolveVelaDeployment('public_devnet')).toThrow(
      /missing required env var VELA_PUBLIC_DEVNET_AUTHORITY_SERVICE_URL/,
    );
  });

  it('resolves a fully-configured public_devnet deployment from env vars, matching them exactly, always no_attestation', () => {
    for (const [key, value] of Object.entries(VALID_PUBLIC_DEVNET_ENV)) {
      process.env[key] = value;
    }
    const deployment = resolveVelaDeployment('public_devnet');
    expect(deployment).toEqual({
      chainId: 31337,
      rpcUrl: VALID_PUBLIC_DEVNET_ENV.VELA_PUBLIC_DEVNET_RPC_URL,
      processorEndpointAddress: VALID_PUBLIC_DEVNET_ENV.VELA_PUBLIC_DEVNET_PROCESSOR_ENDPOINT_ADDRESS,
      teeAuthenticatorAddress: VALID_PUBLIC_DEVNET_ENV.VELA_PUBLIC_DEVNET_TEE_AUTHENTICATOR_ADDRESS,
      authorityServiceUrl: VALID_PUBLIC_DEVNET_ENV.VELA_PUBLIC_DEVNET_AUTHORITY_SERVICE_URL,
      subgraphUrl: VALID_PUBLIC_DEVNET_ENV.VELA_PUBLIC_DEVNET_SUBGRAPH_URL,
      attestationMode: 'no_attestation',
    });
  });

  it('rejects a non-numeric chain id rather than coercing it', () => {
    for (const [key, value] of Object.entries(VALID_PUBLIC_DEVNET_ENV)) {
      process.env[key] = value;
    }
    process.env.VELA_PUBLIC_DEVNET_CHAIN_ID = 'not-a-number';
    expect(() => resolveVelaDeployment('public_devnet')).toThrow(
      /VELA_PUBLIC_DEVNET_CHAIN_ID must be a positive integer/,
    );
  });

  it('never falls back to local or early_access coordinates when unconfigured', () => {
    let thrown = false;
    try {
      resolveVelaDeployment('public_devnet');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});
