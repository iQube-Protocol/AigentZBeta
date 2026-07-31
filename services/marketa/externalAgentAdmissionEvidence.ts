/**
 * Marketa's evidence normalizer (GJR-MKT-001 Phase 3) — a READ-ONLY
 * assembler that builds the deterministic input Phase 4's rule engine
 * decides against. It gathers, cross-checks and hashes; it never decides
 * eligibility itself ("Evidence Before Decision" — every Marketa decision
 * must resolve to a versioned evidence snapshot, GJR-MKT-001 cross-capability
 * invariants).
 *
 * Every field is populated from a REAL source or left honestly absent/false
 * — never fabricated to make a downstream rule pass (CLAUDE.md "No
 * Guessing"). In particular: `authorityFitness.sponsorEligible` stays `null`
 * here always — assessing sponsor-eligibility is Marketa's own DRAFT-mode
 * job (Phase 4), not this assembler's.
 *
 * Reuses read-only sources exclusively:
 *   - registry_assets (the AigentQube record)
 *   - services/horizen/client.ts's fetchRegistryAgent (read-only, soft-fails
 *     to `externalRegistry.resolves: false` rather than throwing)
 *   - services/receipts/activityReceiptService.ts (existing receipts)
 *   - services/passport/externalAgentAdmission.ts's structural facts
 *     (`canDelegateOnward` — literal `false`; expiry/revocation are
 *     enforced by that module's own constructor/transitions, so
 *     `delegationBoundable`/`delegationRevocable`/`expirySupported` are
 *     structural truths about the admission TYPE, not per-candidate reads)
 *
 * Never calls anything in services/horizen/authorizationClient.ts (the
 * MUTATING Verify capability) — this module only reads what Verify already
 * confirmed, via the same `external_registry_bindings[0].transparency`
 * field services/horizen/agentCardEnrichment.ts writes.
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { canonicalJson } from '@/services/simulation/journal';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { fetchRegistryAgent as defaultFetchRegistryAgent, type HorizenRead } from '@/services/horizen/client';
import type { HorizenNetwork } from '@/services/horizen/identity';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';

/** A fresh control proof must have been recorded within this window (mirrors agentBinding.ts's ownership-freshness discipline). */
export const CONTROL_PROOF_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ExternalAgentAdmissionEvidence {
  aigentQube: { exists: boolean; id?: string; canonicalStateHash?: string };
  agentCard: { resolves: boolean; url?: string; hash?: string; schemaValid: boolean; provenanceValid: boolean };
  externalRegistry: {
    resolves: boolean;
    protocol?: string;
    network?: string;
    contract?: string;
    tokenId?: string;
    ownerWallet?: string;
  };
  control: { proven: boolean; proofRef?: string; signerWallet?: string; fresh: boolean };
  transparency: { pulseSupported: boolean; pulseEnabled: boolean; pnlDisclosureAuthorized: boolean; evidenceRefs: string[] };
  authorityFitness: {
    sponsorEligible: boolean | null;
    delegationBoundable: boolean;
    delegationRevocable: boolean;
    onwardDelegationProhibited: boolean;
    expirySupported: boolean;
  };
  risk: { contradictions: string[]; unresolvedClaims: string[]; quarantineSignals: string[] };
}

/**
 * Minimal, generic A2A-shaped Agent Card structural check — never the
 * MoneyPenny-specific `validateAgentCard` from
 * scripts/register-moneypenny-horizen.ts (that checks one candidate's
 * expected VALUES; this checks the SHAPE any candidate's card must have).
 */
export function validateAgentCardSchema(card: unknown): boolean {
  if (!card || typeof card !== 'object') return false;
  const c = card as Record<string, unknown>;
  return (
    typeof c.name === 'string' && c.name.length > 0 &&
    typeof c.url === 'string' && /^https?:\/\//.test(c.url) &&
    typeof c.metadata === 'object' && c.metadata !== null
  );
}

export interface AssembleEvidenceInput {
  aigentQubeId: string;
  actorPersonaId: string;
  agentCardUrl: string;
}

export interface AssembleEvidenceDeps {
  fetchRegistryAgent?: (registryAlias: string, network: HorizenNetwork) => Promise<HorizenRead<Record<string, unknown>>>;
  fetchAgentCard?: (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>;
  now?: () => Date;
}

export type AssembleEvidenceResult =
  | { ok: true; evidence: ExternalAgentAdmissionEvidence; evidenceSnapshotHash: string }
  | { ok: false; refusalCode: 'AIGENTQUBE_NOT_FOUND'; detail: string };

export async function assembleExternalAgentAdmissionEvidence(
  input: AssembleEvidenceInput,
  deps: AssembleEvidenceDeps = {},
): Promise<AssembleEvidenceResult> {
  const admin = getSupabaseServer();
  if (!admin) throw new Error('assembleExternalAgentAdmissionEvidence: Supabase configuration missing');
  const now = deps.now ?? (() => new Date());

  const { data: row } = await admin
    .from('registry_assets')
    .select('metadata')
    .eq('asset_id', input.aigentQubeId)
    .maybeSingle();
  if (!row) {
    return { ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND', detail: `no registry_assets row for "${input.aigentQubeId}"` };
  }

  const metadata = (row.metadata ?? {}) as { external_registry_bindings?: ExternalAgentRegistryBinding[] };
  const binding = metadata.external_registry_bindings?.[0];
  const contradictions: string[] = [];
  const unresolvedClaims: string[] = [];
  const quarantineSignals: string[] = [];

  // ── Agent Card ────────────────────────────────────────────────────────
  const fetchCard = deps.fetchAgentCard ?? ((url: string) => fetch(url, { cache: 'no-store' }));
  let cardResolves = false;
  let cardHash: string | undefined;
  let cardSchemaValid = false;
  let cardProvenanceValid = false;
  try {
    const res = await fetchCard(input.agentCardUrl);
    if (res.ok) {
      const text = await res.text();
      cardHash = createHash('sha256').update(text, 'utf8').digest('hex');
      cardResolves = true;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        contradictions.push('agent-card-not-json');
      }
      cardSchemaValid = validateAgentCardSchema(parsed);
      if (parsed && typeof parsed === 'object') {
        const url = (parsed as Record<string, unknown>).url;
        cardProvenanceValid = typeof url === 'string' && url === input.agentCardUrl;
        if (cardSchemaValid && !cardProvenanceValid) contradictions.push('agent-card-url-self-mismatch');
      }
    } else {
      unresolvedClaims.push('agent-card-unreachable');
    }
  } catch {
    unresolvedClaims.push('agent-card-unreachable');
  }

  // ── External registry ─────────────────────────────────────────────────
  let ownerWallet: string | undefined;
  const registryResolves = Boolean(binding?.token_id);
  if (binding?.token_id && binding.network) {
    const fetchRegistry = deps.fetchRegistryAgent ?? defaultFetchRegistryAgent;
    try {
      const read = await fetchRegistry(binding.registry_alias ?? binding.token_id, binding.network as HorizenNetwork);
      if (read.ok) {
        const owner = (read.value as Record<string, unknown>).owner ?? (read.value as Record<string, unknown>).ownerAddress;
        if (typeof owner === 'string') ownerWallet = owner;
      } else {
        unresolvedClaims.push('registry-reread-unavailable');
      }
    } catch {
      unresolvedClaims.push('registry-reread-unavailable');
    }
  } else if (!binding?.token_id) {
    unresolvedClaims.push('external-registry-not-resolved');
  }

  // ── Control proof ────────────────────────────────────────────────────
  const controlReceipts = await listActivityReceiptsForPersona(input.actorPersonaId, {
    actionTypes: ['agent_control_proven'],
    limit: 5,
  });
  const controlReceipt = controlReceipts.find(
    (r) => (r.actionInput as { aigentQubeId?: string } | null)?.aigentQubeId === input.aigentQubeId,
  );
  const controlProven = Boolean(controlReceipt);
  const controlFresh =
    controlProven && controlReceipt
      ? now().getTime() - Date.parse(controlReceipt.createdAt) <= CONTROL_PROOF_FRESHNESS_WINDOW_MS
      : false;
  if (!controlProven) unresolvedClaims.push('no-control-proof-recorded');
  else if (!controlFresh) unresolvedClaims.push('control-proof-stale');

  const controlSignerWallet = (controlReceipt?.actionInput as { signerWallet?: string } | null)?.signerWallet;
  if (controlProven && ownerWallet && controlSignerWallet && controlSignerWallet.toLowerCase() !== ownerWallet.toLowerCase()) {
    quarantineSignals.push('control-proof-signer-does-not-match-registry-owner');
  }

  // ── Transparency (reads Verify's confirmed state only, never live Horizen) ──
  const pulseEnabled = Boolean(binding?.transparency?.pulse_enabled);
  const pnlDisclosureAuthorized = Boolean(binding?.transparency?.pnl_disclosure_authorized);
  const transparencyEvidenceRefs = binding?.transparency?.pulse_authorization_ref
    ? [binding.transparency.pulse_authorization_ref]
    : [];
  if (registryResolves && !pulseEnabled) unresolvedClaims.push('pulse-not-yet-authorized');

  // ── Authority fitness — structural facts about the admission TYPE, not this
  // candidate. services/passport/externalAgentAdmission.ts's
  // `ExternalAgentAdmission.mayDelegateOnward` is a literal `false` type (not
  // `boolean`) and `createExternalAgentAdmission` refuses a non-future expiry
  // and admits with a real revocation block — so these four are TYPE-LEVEL
  // guarantees of that record shape, true for any candidate admitted through
  // it, not a per-candidate read.
  const authorityFitness = {
    sponsorEligible: null as boolean | null,
    delegationBoundable: true,
    delegationRevocable: true,
    onwardDelegationProhibited: true,
    expirySupported: true,
  };

  const evidence: ExternalAgentAdmissionEvidence = {
    aigentQube: {
      exists: true,
      id: input.aigentQubeId,
      canonicalStateHash: createHash('sha256').update(canonicalJson(metadata), 'utf8').digest('hex'),
    },
    agentCard: {
      resolves: cardResolves,
      url: input.agentCardUrl,
      hash: cardHash,
      schemaValid: cardSchemaValid,
      provenanceValid: cardProvenanceValid,
    },
    externalRegistry: {
      resolves: registryResolves,
      protocol: binding?.protocol,
      network: binding?.network,
      contract: binding?.identity_registry_contract,
      tokenId: binding?.token_id ?? undefined,
      ownerWallet,
    },
    control: {
      proven: controlProven,
      proofRef: controlReceipt?.id,
      signerWallet: controlSignerWallet,
      fresh: controlFresh,
    },
    transparency: {
      pulseSupported: registryResolves,
      pulseEnabled,
      pnlDisclosureAuthorized,
      evidenceRefs: transparencyEvidenceRefs,
    },
    authorityFitness,
    risk: { contradictions, unresolvedClaims, quarantineSignals },
  };

  return {
    ok: true,
    evidence,
    evidenceSnapshotHash: createHash('sha256').update(canonicalJson(evidence), 'utf8').digest('hex'),
  };
}
