/**
 * Shared VELA_PUBLIC_DEVNET_TOKEN_FILE -> VelaDeploymentDescriptor resolver
 * (2026-09-16 correction). Extracted from `scripts/vela/public-devnet-smoke.ts`'s
 * own `loadTokenResponse`/`deploymentFromTokenResponse` (previously
 * file-local, unexported, and duplicated nowhere — until
 * `scripts/seedUseCaseZeroDemo.ts` needed the identical mapping and a second
 * copy would have violated inv.engineering.036/037). This is the ONE
 * authoritative place that knows the token-file JSON shape and which of its
 * `env` keys map to which `VelaDeploymentDescriptor` field; both callers
 * import from here.
 *
 * The token file is the raw JSON response saved from
 * `POST https://devnet.synsema.app/token` — never minted, fetched, or
 * constructed by this module. Its shape:
 *   { token: string; host: string; address: string; env: Record<string, string> }
 * where `env` carries `VELA_RPC_URL`, `VELA_PROCESSOR`, `VELA_TEE_AUTHENTICATOR`,
 * `VELA_AUTHORITY_URL`, and optionally `VELA_SUBGRAPH_URL` — the Synsema
 * devnet's own env-var naming, distinct from (and never conflated with)
 * `services/vela/velaConfig.ts`'s `VELA_PUBLIC_DEVNET_*` individual env vars,
 * which are a SEPARATE, parallel way to reach the same `'public_devnet'`
 * deployment without a token file. `velaConfig.ts` itself is intentionally
 * NOT modified by this file — it keeps its own existing env-var contract;
 * this module is an additional, opt-in resolution path callers use only when
 * `VELA_PUBLIC_DEVNET_TOKEN_FILE` is actually set.
 *
 * SECURITY: `token` (a live devnet capability credential) is the one field
 * this module reads but NEVER includes in a thrown error message, a log
 * line, or the returned `VelaDeploymentDescriptor` — every error below names
 * only field NAMES ("token", "env.VELA_RPC_URL", ...), never a field VALUE.
 * `host`/`address` are structural fields (not secrets) and may appear in the
 * `DevnetTokenResponse` this module returns, but are likewise never echoed
 * into an error message string.
 *
 * Server-side only (reads a local file path from the filesystem/env).
 */

import { readFileSync } from 'fs';
import type { VelaDeploymentDescriptor } from './velaTypes';

export interface DevnetTokenResponse {
  token: string;
  host: string;
  address: string;
  env: Record<string, string>;
}

/** Reads and validates `VELA_PUBLIC_DEVNET_TOKEN_FILE`, throwing a clear,
 *  actionable error (naming no secret) if it is unset. Separate from
 *  `loadDevnetTokenResponse` so a caller that already has an explicit path
 *  (e.g. a test, or a caller reading a different env var) can skip this
 *  env-var-specific step entirely. */
export function readDevnetTokenFilePathFromEnv(): string {
  const path = process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
  if (!path) {
    throw new Error(
      'VELA_PUBLIC_DEVNET_TOKEN_FILE is required — point it at the JSON saved from ' +
        'POST https://devnet.synsema.app/token. This module never mints a token itself ' +
        'so the raw response never appears in process args or a second location.',
    );
  }
  return path;
}

/**
 * Reads, parses, and validates a devnet token-response file at `path`.
 * Fails closed with a specific, actionable message for every distinct
 * failure mode (unreadable file, malformed JSON, wrong top-level shape,
 * missing/malformed required field) — never a bare re-thrown parser error,
 * and never a field VALUE (the `token` credential above all) in any message.
 */
export function loadDevnetTokenResponse(path: string): DevnetTokenResponse {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `loadDevnetTokenResponse: could not read the token file at "${path}": ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `loadDevnetTokenResponse: the token file at "${path}" is not valid JSON: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`loadDevnetTokenResponse: the token file at "${path}" must contain a single JSON object.`);
  }
  const obj = parsed as Record<string, unknown>;

  const missing: string[] = [];
  if (typeof obj.token !== 'string' || obj.token.length === 0) missing.push('token');
  if (typeof obj.host !== 'string' || obj.host.length === 0) missing.push('host');
  if (typeof obj.address !== 'string' || obj.address.length === 0) missing.push('address');
  if (typeof obj.env !== 'object' || obj.env === null || Array.isArray(obj.env)) missing.push('env');
  if (missing.length > 0) {
    // Never interpolate obj.token (or any other field's VALUE) here —
    // only the NAMES of the missing/malformed fields.
    throw new Error(
      `loadDevnetTokenResponse: the token file at "${path}" is missing or has a malformed field: ` +
        `${missing.join(', ')}.`,
    );
  }

  return obj as unknown as DevnetTokenResponse;
}

/**
 * Maps an already-loaded `DevnetTokenResponse` to a `VelaDeploymentDescriptor`
 * — the SAME field mapping `scripts/vela/public-devnet-smoke.ts` used before
 * this extraction (chainId is fixed at 31337, matching that script's own
 * verified-live coordinates; `subgraphUrl` is optional and defaults to the
 * empty string; every other field is required and named explicitly on
 * failure). The Synsema public devnet is unconditionally `'no_attestation'`
 * — see `services/vela/velaConfig.ts`'s own `resolvePublicDevnetDeployment`
 * doc comment for why there is no attested variant to get wrong here either.
 */
export function deploymentFromDevnetTokenResponse(t: DevnetTokenResponse): VelaDeploymentDescriptor {
  const env = t.env;
  const need = (k: string): string => {
    const v = env[k];
    if (!v) {
      throw new Error(`deploymentFromDevnetTokenResponse: token response env.${k} is missing or empty.`);
    }
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

/**
 * One-call convenience: resolves `VELA_PUBLIC_DEVNET_TOKEN_FILE` (or an
 * explicitly supplied `path`, e.g. for a caller with its own env var),
 * loads and validates the token file, and maps it to a deployment
 * descriptor — the single entry point both `scripts/vela/public-devnet-smoke.ts`
 * and `scripts/seedUseCaseZeroDemo.ts` use rather than each re-composing the
 * two steps above.
 */
export function resolvePublicDevnetDeploymentFromTokenFile(path?: string): VelaDeploymentDescriptor {
  const resolvedPath = path ?? readDevnetTokenFilePathFromEnv();
  return deploymentFromDevnetTokenResponse(loadDevnetTokenResponse(resolvedPath));
}
