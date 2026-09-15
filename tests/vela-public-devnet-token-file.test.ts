/**
 * services/vela/velaPublicDevnetTokenFile.ts — the shared
 * VELA_PUBLIC_DEVNET_TOKEN_FILE -> VelaDeploymentDescriptor resolver
 * extracted from scripts/vela/public-devnet-smoke.ts (2026-09-16 seam
 * closure) and reused by scripts/seedUseCaseZeroDemo.ts. Valid / missing /
 * malformed / incomplete / secret-redacted cases, per the corrective
 * instruction's own acceptance criteria.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  readDevnetTokenFilePathFromEnv,
  loadDevnetTokenResponse,
  deploymentFromDevnetTokenResponse,
  resolvePublicDevnetDeploymentFromTokenFile,
  type DevnetTokenResponse,
} from '@/services/vela/velaPublicDevnetTokenFile';

const SECRET_TOKEN = 'super-secret-devnet-capability-token-do-not-leak';

function validTokenResponse(): DevnetTokenResponse {
  return {
    token: SECRET_TOKEN,
    host: 'devnet.synsema.app',
    address: '0x1111111111111111111111111111111111111111',
    env: {
      VELA_RPC_URL: 'https://devnet-rpc.synsema.app',
      VELA_PROCESSOR: '0x2222222222222222222222222222222222222222',
      VELA_TEE_AUTHENTICATOR: '0x3333333333333333333333333333333333333333',
      VELA_AUTHORITY_URL: 'https://devnet-authority.synsema.app',
      VELA_SUBGRAPH_URL: 'https://devnet-subgraph.synsema.app',
      VELA_SECP_KEY: '0x' + '44'.repeat(32),
    },
  };
}

let tmpDir: string;
let originalEnvValue: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vela-devnet-token-'));
  originalEnvValue = process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  if (originalEnvValue === undefined) delete process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
  else process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE = originalEnvValue;
});

function writeToken(content: string): string {
  const path = join(tmpDir, 'token_response.json');
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('loadDevnetTokenResponse — valid case', () => {
  it('reads and parses a well-formed token file', () => {
    const path = writeToken(JSON.stringify(validTokenResponse()));
    const result = loadDevnetTokenResponse(path);
    expect(result.token).toBe(SECRET_TOKEN);
    expect(result.host).toBe('devnet.synsema.app');
    expect(result.env.VELA_RPC_URL).toBe('https://devnet-rpc.synsema.app');
  });
});

describe('loadDevnetTokenResponse — missing file', () => {
  it('throws a clear, actionable error naming the path, never a raw fs error', () => {
    const path = join(tmpDir, 'does-not-exist.json');
    expect(() => loadDevnetTokenResponse(path)).toThrow(/could not read the token file/);
    expect(() => loadDevnetTokenResponse(path)).toThrow(path);
  });
});

describe('loadDevnetTokenResponse — malformed JSON', () => {
  it('throws a clear "not valid JSON" error for unparseable content', () => {
    const path = writeToken('{ this is not json ');
    expect(() => loadDevnetTokenResponse(path)).toThrow(/not valid JSON/);
  });

  it('throws when the file contains a JSON array, not an object', () => {
    const path = writeToken(JSON.stringify([1, 2, 3]));
    expect(() => loadDevnetTokenResponse(path)).toThrow(/must contain a single JSON object/);
  });

  it('throws when the file contains a bare JSON primitive', () => {
    const path = writeToken('"just a string"');
    expect(() => loadDevnetTokenResponse(path)).toThrow(/must contain a single JSON object/);
  });
});

describe('loadDevnetTokenResponse — incomplete/malformed required fields', () => {
  it('throws naming every missing top-level field', () => {
    const path = writeToken(JSON.stringify({ token: SECRET_TOKEN }));
    expect(() => loadDevnetTokenResponse(path)).toThrow(/host, address, env/);
  });

  it('throws when env is present but not an object', () => {
    const broken = { ...validTokenResponse(), env: 'not-an-object' };
    const path = writeToken(JSON.stringify(broken));
    expect(() => loadDevnetTokenResponse(path)).toThrow(/env/);
  });

  it('throws when a required field is an empty string', () => {
    const broken = { ...validTokenResponse(), host: '' };
    const path = writeToken(JSON.stringify(broken));
    expect(() => loadDevnetTokenResponse(path)).toThrow(/host/);
  });
});

describe('loadDevnetTokenResponse — secret redaction', () => {
  it('never includes the token value in any thrown error message', () => {
    const cases = [
      () => loadDevnetTokenResponse(join(tmpDir, 'missing.json')),
      () => loadDevnetTokenResponse(writeToken('not json')),
      () => loadDevnetTokenResponse(writeToken(JSON.stringify({ token: SECRET_TOKEN }))),
    ];
    for (const run of cases) {
      try {
        run();
        throw new Error('expected to throw');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).not.toContain(SECRET_TOKEN);
      }
    }
  });

  it('deploymentFromDevnetTokenResponse never includes the token value even though it receives the full response', () => {
    const incomplete: DevnetTokenResponse = { ...validTokenResponse(), env: { VELA_RPC_URL: 'https://x' } };
    try {
      deploymentFromDevnetTokenResponse(incomplete);
      throw new Error('expected to throw');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).toMatch(/VELA_PROCESSOR/);
    }
  });
});

describe('deploymentFromDevnetTokenResponse — valid mapping', () => {
  it('maps every field to the correct VelaDeploymentDescriptor property', () => {
    const deployment = deploymentFromDevnetTokenResponse(validTokenResponse());
    expect(deployment).toEqual({
      chainId: 31337,
      rpcUrl: 'https://devnet-rpc.synsema.app',
      processorEndpointAddress: '0x2222222222222222222222222222222222222222',
      teeAuthenticatorAddress: '0x3333333333333333333333333333333333333333',
      authorityServiceUrl: 'https://devnet-authority.synsema.app',
      subgraphUrl: 'https://devnet-subgraph.synsema.app',
      attestationMode: 'no_attestation',
    });
  });

  it('defaults subgraphUrl to empty string when env.VELA_SUBGRAPH_URL is absent', () => {
    const t = validTokenResponse();
    delete t.env.VELA_SUBGRAPH_URL;
    const deployment = deploymentFromDevnetTokenResponse(t);
    expect(deployment.subgraphUrl).toBe('');
  });

  it('throws naming the specific missing env key, incomplete case', () => {
    const t = validTokenResponse();
    delete t.env.VELA_PROCESSOR;
    expect(() => deploymentFromDevnetTokenResponse(t)).toThrow(/env\.VELA_PROCESSOR/);
  });
});

describe('readDevnetTokenFilePathFromEnv', () => {
  it('returns the env var value when set', () => {
    process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE = '/some/path.json';
    expect(readDevnetTokenFilePathFromEnv()).toBe('/some/path.json');
  });

  it('throws a clear error, naming no secret, when unset', () => {
    delete process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
    expect(() => readDevnetTokenFilePathFromEnv()).toThrow(/VELA_PUBLIC_DEVNET_TOKEN_FILE is required/);
  });
});

describe('resolvePublicDevnetDeploymentFromTokenFile — one-call convenience', () => {
  it('resolves end-to-end from the env var alone', () => {
    const path = writeToken(JSON.stringify(validTokenResponse()));
    process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE = path;
    const deployment = resolvePublicDevnetDeploymentFromTokenFile();
    expect(deployment.rpcUrl).toBe('https://devnet-rpc.synsema.app');
  });

  it('resolves end-to-end from an explicit path, ignoring the env var', () => {
    delete process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
    const path = writeToken(JSON.stringify(validTokenResponse()));
    const deployment = resolvePublicDevnetDeploymentFromTokenFile(path);
    expect(deployment.rpcUrl).toBe('https://devnet-rpc.synsema.app');
  });

  it('fails closed with the env-var error when neither an explicit path nor the env var is set', () => {
    delete process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
    expect(() => resolvePublicDevnetDeploymentFromTokenFile()).toThrow(/VELA_PUBLIC_DEVNET_TOKEN_FILE is required/);
  });
});
