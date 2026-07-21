/**
 * thresholdLink.ts — the signed `metame-threshold-link/v1` bootstrap manifest
 * (PRD-THR-001 §7). The human sees a "Cross the Threshold" page; the manifest
 * tells the Threshold Companion (the user's agent) what to do.
 *
 * Trust model (mirrors CFS-042 accession + passportCredential signing):
 *  - The manifest carries NO permanent secrets and NO T0 identifiers — only
 *    invitation identity, the gateway endpoint, the requested role + capability
 *    scope, expiry, a signature, and an optional one-time exchange token.
 *  - Signing is an HMAC-SHA256 stub over the canonical manifest JSON using
 *    THRESHOLD_LINK_SIGNING_SECRET (falls back to the Bureau credential secret).
 *    Absent a secret, the manifest is emitted UNSIGNED with an explicit stub
 *    marker so no consumer mistakes it for a production proof. Asymmetric,
 *    publicly verifiable signing is a follow-on (Passport Bureau Phase C).
 */

import { createHmac } from 'crypto';

export const THRESHOLD_LINK_SCHEMA = 'metame-threshold-link/v1';

export interface ThresholdLinkInput {
  invitationId: string;
  initiatingService: string; // e.g. 'polity-passport' (self-serve) | 'irl' (service-initiated)
  institution?: string;
  requestedRole: string;
  requestedCapabilities: string[];
  gatewayUrl: string; // derived from publicOrigin — never hardcoded
  transport?: 'streamable-http';
  handshakePrompt?: string;
  expiresAt?: string | null;
  exchangeToken?: string | null;
}

export interface ThresholdLinkManifest {
  schema: typeof THRESHOLD_LINK_SCHEMA;
  invitationId: string;
  initiatingService: string;
  institution?: string;
  gateway: { url: string; transport: 'streamable-http' };
  requestedRole: string;
  requestedCapabilities: string[];
  handshakePrompt: string;
  expiresAt: string | null;
  exchangeToken?: string | null;
  signature: { type: 'ThresholdHmacStub/v0' | 'ThresholdUnsignedStub/v0'; value: string | null };
}

const DEFAULT_HANDSHAKE_PROMPT =
  'Connect to the metaMe Threshold Gateway, inspect this crossing, explain each requested permission to your principal, and cross only after explicit approval. Only the human authorizes — you prepare and explain.';

/** Deterministic canonical JSON of the signable fields (signature excluded). */
function canonicalize(m: Omit<ThresholdLinkManifest, 'signature'>): string {
  return JSON.stringify({
    schema: m.schema,
    invitationId: m.invitationId,
    initiatingService: m.initiatingService,
    institution: m.institution ?? null,
    gateway: m.gateway,
    requestedRole: m.requestedRole,
    requestedCapabilities: m.requestedCapabilities,
    handshakePrompt: m.handshakePrompt,
    expiresAt: m.expiresAt,
    exchangeToken: m.exchangeToken ?? null,
  });
}

function signingSecret(): string | null {
  return (
    process.env.THRESHOLD_LINK_SIGNING_SECRET ||
    process.env.PASSPORT_BUREAU_CREDENTIAL_SECRET ||
    null
  );
}

export function buildThresholdLink(input: ThresholdLinkInput): ThresholdLinkManifest {
  const base: Omit<ThresholdLinkManifest, 'signature'> = {
    schema: THRESHOLD_LINK_SCHEMA,
    invitationId: input.invitationId,
    initiatingService: input.initiatingService,
    institution: input.institution,
    gateway: { url: input.gatewayUrl, transport: input.transport ?? 'streamable-http' },
    requestedRole: input.requestedRole,
    requestedCapabilities: input.requestedCapabilities,
    handshakePrompt: input.handshakePrompt || DEFAULT_HANDSHAKE_PROMPT,
    expiresAt: input.expiresAt ?? null,
    exchangeToken: input.exchangeToken ?? null,
  };

  const secret = signingSecret();
  if (!secret) {
    return { ...base, signature: { type: 'ThresholdUnsignedStub/v0', value: null } };
  }
  const value = createHmac('sha256', secret).update(canonicalize(base)).digest('hex');
  return { ...base, signature: { type: 'ThresholdHmacStub/v0', value } };
}

/** Verify a manifest's HMAC stub. Returns true for a valid signature; false if
 *  invalid. Unsigned stubs return false (no integrity proof to verify). */
export function verifyThresholdLink(manifest: ThresholdLinkManifest): boolean {
  const secret = signingSecret();
  if (!secret || !manifest.signature?.value) return false;
  const { signature, ...rest } = manifest;
  const expected = createHmac('sha256', secret).update(canonicalize(rest)).digest('hex');
  // constant-time-ish compare
  if (expected.length !== signature.value.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.value.charCodeAt(i);
  return diff === 0;
}
