/**
 * policyResolvers — per-action policy hooks for evaluateAccess.
 *
 * Phase 1.3 of the unified identity-content-access foundation plan.
 *
 * Centralises the small set of per-action decisions that should NOT be
 * scattered across surfaces:
 *   - Which actions require synchronous DVN receipt anchoring before the
 *     decision is returned (vs async fire-and-forget). Operator §11.2:
 *     async by default; sync for mint, transfer, payment-settle,
 *     policy-escalation, disclosure.
 *   - Which credential strings drive which on-chain / canister
 *     verification path. (Stub today; Phase 3 wires DVN policy hooks.)
 *
 * Routes never set sync mode themselves. They pass requireSyncReceipt as
 * a hint; this module decides whether the action actually qualifies and
 * downgrades to async with a log if not.
 */

import type { AccessAction, ReceiptMode } from '@/types/access';

/**
 * The set of actions where the receipt IS the proof and must be anchored
 * before the action is considered complete. Per operator decision §11.2.
 */
const SYNC_RECEIPT_ACTIONS: ReadonlySet<AccessAction> = new Set<AccessAction>([
  'mint',
  'transfer',
  'payment-settle',
  'policy-escalation',
  'disclosure',
]);

/**
 * Resolve the receipt mode for an action.
 *
 * @param action  The action being gated.
 * @param hint    Caller-provided hint. Honoured only if the action
 *                qualifies for sync per operator decision; otherwise
 *                downgraded to async (rate-limit + log handled by
 *                evaluateAccess, not here).
 */
export function resolveReceiptMode(
  action: AccessAction,
  hint: boolean | undefined,
): ReceiptMode {
  if (SYNC_RECEIPT_ACTIONS.has(action)) {
    // Default-sync for the consequential set, regardless of caller hint.
    // Async hint is honoured only if the action does NOT belong to the
    // consequential set; consequential actions cannot opt out of sync.
    return 'sync';
  }
  return hint ? 'async' : 'async';
}

/**
 * Returns true if the given credential string indicates a credential
 * that requires on-chain or canister verification beyond the simple
 * cartridge-flag check (admin / partner). Phase 3 wires the actual
 * verifier; today this is a classifier only.
 */
export function credentialRequiresExternalVerifier(credential: string | undefined): boolean {
  if (!credential) return false;
  return (
    credential.startsWith('cohort:') ||
    credential.startsWith('token:')
  );
}

/**
 * Cartridge-flag credentials that resolve from ActivePersonaContext
 * directly (no canister or chain lookup). Phase 1 baseline.
 *
 * Supported credentials:
 *   'admin'                       — global uber/platform-tier admin
 *                                    (cartridgeFlags.isAdmin)
 *   'partner'                     — partner cartridge flag
 *                                    (cartridgeFlags.isPartner)
 *   'admin-cartridge:<slug>'      — per-cartridge admin grant. Matches
 *                                    when the persona's
 *                                    cartridgeFlags.adminCartridges
 *                                    array contains the slug, OR when
 *                                    the global isAdmin flag is true
 *                                    (uber-admin override). Added
 *                                    2026-05-26 as part of the spine
 *                                    admin-grants extension — see
 *                                    codexes/packs/agentiq/updates/2026-05-26_spine-admin-grants-extension.md.
 *
 * Backwards compatible — the `flags` parameter accepts the legacy
 * { isAdmin, isPartner } shape and treats a missing adminCartridges
 * field as the no-grants posture (fail-closed).
 */
export function credentialMatchesCartridgeFlag(
  credential: string | undefined,
  flags: { isAdmin: boolean; isPartner: boolean; adminCartridges?: string[] },
): boolean {
  if (!credential) return false;
  if (credential === 'admin')   return flags.isAdmin;
  if (credential === 'partner') return flags.isPartner;
  if (credential.startsWith('admin-cartridge:')) {
    const slug = credential.slice('admin-cartridge:'.length).trim();
    if (!slug) return false;
    // Global isAdmin satisfies any per-cartridge admin gate (uber/
    // platform-tier override). Otherwise the slug must appear in the
    // persona's explicit grant list.
    if (flags.isAdmin) return true;
    return Array.isArray(flags.adminCartridges) && flags.adminCartridges.includes(slug);
  }
  return false;
}

/**
 * Phase 3.3 — resolve cohort:* and token:* credentials by calling the
 * appropriate ICP canister.
 *
 *   cohort:<cohort-id>   — RQH (ReputationHub). Persona qualifies if their
 *                          partition has any reputation record in the cohort
 *                          bucket (membership proof).
 *   token:<chain>:<addr> — EVM RPC canister. Persona qualifies if they own
 *                          the ERC-721 / ERC-1155 token at the given address.
 *
 * Returns:
 *   { matches: true, reason: 'credential-met' }   on positive proof
 *   { matches: false, reason: 'credential-required' | 'token-required' }
 *
 * Defensive — any canister error or missing env returns {matches:false}
 * with the appropriate reason. Conservative deny preserves the gate.
 */
export interface ExternalCredentialResolution {
  matches: boolean;
  reason: 'credential-met' | 'credential-required' | 'token-required';
  evidence?: Record<string, unknown>;
}

export async function resolveExternalCredential(
  credential: string,
  personaId: string,
): Promise<ExternalCredentialResolution> {
  if (credential.startsWith('cohort:')) {
    return resolveCohortCredential(credential.slice('cohort:'.length), personaId);
  }
  if (credential.startsWith('token:')) {
    return resolveTokenCredential(credential.slice('token:'.length), personaId);
  }
  return { matches: false, reason: 'credential-required' };
}

async function resolveCohortCredential(
  cohortId: string,
  personaId: string,
): Promise<ExternalCredentialResolution> {
  const rqhId =
    process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID;
  if (!rqhId) return { matches: false, reason: 'credential-required' };

  try {
    const { fetchReputationFromRQH } = await import('@/services/crm/rewardVerificationService');
    // Partition id = `${cohortId}:${personaId}` per RQH partition convention.
    // The canister returns null when no reputation record exists, which we
    // treat as "not in cohort" — conservative deny.
    const partitionId = `${cohortId}:${personaId}`;
    const reputation = await fetchReputationFromRQH(partitionId);
    if (reputation && reputation.evidenceCount > 0) {
      return {
        matches: true,
        reason: 'credential-met',
        evidence: { source: 'rqh', cohortId, bucket: reputation.bucket },
      };
    }
    return { matches: false, reason: 'credential-required' };
  } catch (err) {
    console.error('[policyResolvers] RQH cohort lookup failed', err);
    return { matches: false, reason: 'credential-required' };
  }
}

async function resolveTokenCredential(
  spec: string,
  personaId: string,
): Promise<ExternalCredentialResolution> {
  // spec format: "<chain>:<contract>" e.g. "base:0xAbC..."
  // ERC-1155 form: "<chain>:<contract>:<tokenId>"
  const parts = spec.split(':');
  if (parts.length < 2) return { matches: false, reason: 'token-required' };
  const [chain, contract, tokenIdRaw] = parts;
  const tokenId = tokenIdRaw ? safeBigInt(tokenIdRaw) : null;

  try {
    const { resolvePersonaWalletAddress } = await import('@/services/identity/personaAddressResolver');
    const address = await resolvePersonaWalletAddress(personaId, chain);
    if (!address) return { matches: false, reason: 'token-required' };

    const { ownsErc721, ownsErc1155 } = await import('@/services/access/tokenOwnership');
    const owned = tokenId !== null
      ? await ownsErc1155(chain, contract, address, tokenId)
      : await ownsErc721(chain, contract, address);

    return owned
      ? { matches: true, reason: 'credential-met', evidence: { source: 'evm', chain, contract } }
      : { matches: false, reason: 'token-required' };
  } catch (err) {
    console.error('[policyResolvers] EVM token lookup failed', err);
    return { matches: false, reason: 'token-required' };
  }
}

function safeBigInt(s: string): bigint | null {
  try { return BigInt(s); } catch { return null; }
}
