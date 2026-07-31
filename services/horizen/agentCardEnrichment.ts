/**
 * Agent Card enrichment after a confirmed Horizen transparency authorization
 * (GJR-VFY-001 §10, Phase 2 — Horizen Verify capability).
 *
 * Called ONLY after `verifyHorizenTransparencyActivation` (Phase 1,
 * services/horizen/authorizationClient.ts) returns `{ok: true}` — "a
 * successful signature without successful partner reread is not
 * completion" applies here too: this function must never run against an
 * unconfirmed authorization.
 *
 * Projects the confirmed state onto MoneyPenny's canonical AigentQube record
 * (registry_assets 'aigentqube-moneypenny') via the SAME
 * external_registry_bindings[0].transparency field the Agent Card route
 * already projects tokenId/registryAlias/status from — never a second,
 * parallel source of truth (inv.engineering.036/037). The served Agent Card
 * (app/api/agents/moneypenny/agent-card.json/route.ts) reads this same
 * binding and projects it into the card's own `metadata.horizen.pulse`/`.pnl`
 * and `metadata.evidence` — updated in the same change as this file so the
 * enrichment is never an inert write (CLAUDE.md Companion invariant MS-7).
 *
 * Establishes Standing ELIGIBILITY only (`evidence.standingStatus`). It does
 * not accrue Standing — that remains a separate governed act
 * (services/crm/standingAccrualService.ts).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';

const AIGENTQUBE_ID = 'aigentqube-moneypenny';

export interface EnrichAgentCardInput {
  /** The operator's own persona — recorded as the receipts' principal. */
  actorPersonaId: string;
  authorizationId: string;
  controllerWallet: string;
  tokenId: string;
  network: string;
  signatureRef: string | null;
  submissionRef: string | null;
}

export type EnrichAgentCardResult =
  | { ok: true; receiptRefs: { pnlTransparencyEnabled: string | null; agentCardEnriched: string | null } }
  | { ok: false; refusalCode: 'AIGENTQUBE_NOT_FOUND' | 'NO_MATCHING_BINDING'; detail: string };

export async function enrichAgentCardAfterHorizenAuthorization(
  input: EnrichAgentCardInput,
): Promise<EnrichAgentCardResult> {
  const admin = getSupabaseServer();
  if (!admin) throw new Error('enrichAgentCardAfterHorizenAuthorization: Supabase configuration missing');

  const { data: row, error } = await admin
    .from('registry_assets')
    .select('metadata')
    .eq('asset_id', AIGENTQUBE_ID)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND', detail: `no registry_assets row for "${AIGENTQUBE_ID}"` };
  }

  const metadata = (row.metadata ?? {}) as { external_registry_bindings?: ExternalAgentRegistryBinding[] };
  const bindings = Array.isArray(metadata.external_registry_bindings) ? [...metadata.external_registry_bindings] : [];
  const idx = bindings.findIndex((b) => b.token_id === input.tokenId && (b.network ?? '') === input.network);
  if (idx === -1) {
    return {
      ok: false,
      refusalCode: 'NO_MATCHING_BINDING',
      detail: `no external_registry_bindings entry matches tokenId "${input.tokenId}" on network "${input.network}" — refusing to fabricate one`,
    };
  }

  const existingTransparency = bindings[idx].transparency;
  bindings[idx] = {
    ...bindings[idx],
    transparency: {
      pulse_enabled: true,
      pulse_authorization_ref: input.authorizationId,
      pnl_disclosure_authorized: true,
      pnl_proof_refs: existingTransparency?.pnl_proof_refs ?? [],
    },
  };

  const { error: updateError } = await admin
    .from('registry_assets')
    .update({ metadata: { ...metadata, external_registry_bindings: bindings }, updated_at: new Date().toISOString() })
    .eq('asset_id', AIGENTQUBE_ID);
  if (updateError) throw new Error(`enrichAgentCardAfterHorizenAuthorization: metadata update failed: ${updateError.message}`);

  const commonInput = {
    personaId: input.actorPersonaId,
    activeCartridge: 'agentiq' as const,
    agentsInvoked: ['aigent-moneypenny'],
    actionInput: {
      aigentQubeId: AIGENTQUBE_ID,
      controllerWallet: input.controllerWallet,
      tokenId: input.tokenId,
      network: input.network,
      authorizationId: input.authorizationId,
      signatureRef: input.signatureRef,
      submissionRef: input.submissionRef,
    },
  };

  const pnlReceipt = await createActivityReceipt({
    ...commonInput,
    actionType: 'horizen_pnl_transparency_enabled',
    summary: `Horizen P&L transparency disclosure authorized for MoneyPenny (token ${input.tokenId}, ${input.network})`,
  });
  const enrichmentReceipt = await createActivityReceipt({
    ...commonInput,
    actionType: 'agent_card_enriched',
    summary: `MoneyPenny's Agent Card enriched with confirmed Horizen Pulse/PnL transparency state (token ${input.tokenId}, ${input.network})`,
  });

  return {
    ok: true,
    receiptRefs: {
      pnlTransparencyEnabled: pnlReceipt?.id ?? null,
      agentCardEnriched: enrichmentReceipt?.id ?? null,
    },
  };
}
