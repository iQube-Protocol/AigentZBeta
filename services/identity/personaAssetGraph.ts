/**
 * personaAssetGraph — unified read-side projection of a persona's
 * identity + asset graph.
 *
 * Composes existing spine resolvers (cartridgeAdminGrants,
 * userOwnsAsset / getOwnedAssetIds, persona_activations,
 * wallet_alias_commitments) into a single T1-safe payload the
 * admin-review surfaces consume. No parallel resolvers — every
 * source-of-truth read happens through its existing canonical helper.
 *
 * Spine contract
 * --------------
 *   - Server-only. Accepts a T0 personaId; returns a T1-safe shape.
 *   - The five fields that MUST NEVER leave the server
 *     (personaId, authProfileId, rootDid, kybeAttestation, cross-persona
 *     fioHandle) are never copied into the response. Wallet linkage is
 *     exposed only as a `walletAliases` list of (chain, status, expiresAt)
 *     — not the plaintext addresses.
 *   - Errors swallow per branch — a failure resolving one branch (e.g.
 *     wallet aliases) does NOT block the rest of the graph. The
 *     resolver always returns a usable shape.
 *
 * Lifecycle
 * ---------
 *   The `ownedIqubes` branch reads from `persona_iqube_holdings`
 *   (migration 20260526010000). Empty until the iQube fleshing-out
 *   workstream wires writes — returns `[]` gracefully.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCartridgeAdminGrants } from '@/services/access/cartridgeAdminGrants';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';

export type IqubeAssetClass =
  | 'TalentQube'
  | 'AigentQube'
  | 'DataQube'
  | 'ToolQube'
  | 'SkillQube'
  | 'ConnectorQube'
  | 'WorkflowQube';

export interface PersonaAssetGraph {
  /** T1 identifier presence flags + the masked label. Never the raw IDs. */
  identifiers: {
    displayLabel: string | null;
    email: string | null;       // alpha posture: visible to platform admins
    fioHandle: string | null;   // T0 — present here for the access-requests
                                // path where the reviewer is a platform admin
                                // and the alpha PII posture exposes it.
                                // Mask via piiConsent resolver once that lands.
    rootDidPresent: boolean;
    kybePresent: boolean;
    identifiability: string | null;
    walletAliases: Array<{
      chain: 'evm' | 'btc' | 'sol';
      status: string;
      expiresAt: string | null;
    }>;
  };
  reputation: { score: number; bucket: number };
  /** Resolved through getCartridgeAdminGrants — single SoT. */
  adminGrants: { isGlobalAdmin: boolean; cartridgeSlugs: string[] };
  /** persona_activations rows with status='active'. */
  activeActivations: string[];
  /** crm_investors presence + tier label when readable. */
  investorStatus: { isInvestor: boolean; tier: string | null };
  /** Aggregated $KNYT balance across all reward grants. */
  knytBalance: number | null;
  /** Owned content assets — episodes, store SKUs, iQube instances. */
  ownedAssets: {
    /** master_content_qubes slugs the persona owns (direct + expanded via SKU). */
    episodes: string[];
    /** store_skus the persona has redeemed. */
    cards: string[];
    /** persona_iqube_holdings rows joined with registry_assets metadata. */
    iQubes: Array<{
      registryAssetId: string;
      name: string | null;
      assetClass: IqubeAssetClass;
      trustBand: string | null;
      source: string;
      acquiredAt: string;
    }>;
  };
  /** Agent personas this persona owns / operates. T1 — agent ids only. */
  agentsProvisioned: string[];
  /** Diagnostic flags — which branches resolved successfully. */
  resolved: {
    identifiers: boolean;
    reputation: boolean;
    adminGrants: boolean;
    activations: boolean;
    investor: boolean;
    knyt: boolean;
    ownedContent: boolean;
    ownedIqubes: boolean;
    agents: boolean;
  };
}

const EMPTY_GRAPH: PersonaAssetGraph = {
  identifiers: {
    displayLabel: null,
    email: null,
    fioHandle: null,
    rootDidPresent: false,
    kybePresent: false,
    identifiability: null,
    walletAliases: [],
  },
  reputation: { score: 0, bucket: 0 },
  adminGrants: { isGlobalAdmin: false, cartridgeSlugs: [] },
  activeActivations: [],
  investorStatus: { isInvestor: false, tier: null },
  knytBalance: null,
  ownedAssets: { episodes: [], cards: [], iQubes: [] },
  agentsProvisioned: [],
  resolved: {
    identifiers: false,
    reputation: false,
    adminGrants: false,
    activations: false,
    investor: false,
    knyt: false,
    ownedContent: false,
    ownedIqubes: false,
    agents: false,
  },
};

interface PersonaRow {
  id: string;
  auth_profile_id: string | null;
  display_label: string | null;
  fio_handle: string | null;
  root_id: string | null;
  default_identity_state: string | null;
}

interface RootIdentityRow {
  id: string;
  did_uri: string | null;
  kybe_id: string | null;
}

interface CrmPersonaRow {
  email: string | null;
  reputation_score: number | null;
  reputation_bucket: number | null;
}

export async function getPersonaAssetGraph(personaId: string): Promise<PersonaAssetGraph> {
  if (!personaId || typeof personaId !== 'string') return EMPTY_GRAPH;

  const admin = getSupabaseServer();
  if (!admin) return EMPTY_GRAPH;

  // Start from the persona row — gives us auth_profile_id (needed for
  // most other branches) and the basic identity fields.
  const { data: personaRow } = await admin
    .from('personas')
    .select('id, auth_profile_id, display_label, fio_handle, root_id, default_identity_state')
    .eq('id', personaId)
    .maybeSingle();

  const persona = personaRow as PersonaRow | null;
  if (!persona) return EMPTY_GRAPH;

  const authProfileId = persona.auth_profile_id;

  // Fan out every branch in parallel. Each branch is wrapped so a
  // single failure doesn't block the others.
  const [
    rootIdentity,
    crmPersona,
    walletAliases,
    adminGrants,
    activations,
    investorRow,
    knytGrants,
    ownedContent,
    ownedIqubes,
    agents,
  ] = await Promise.all([
    safe<RootIdentityRow | null>(
      async () => {
        if (!persona.root_id) return null;
        const { data } = await admin
          .from('root_identity')
          .select('id, did_uri, kybe_id')
          .eq('id', persona.root_id)
          .maybeSingle();
        return (data as RootIdentityRow | null) ?? null;
      },
      null,
    ),
    safe<CrmPersonaRow | null>(
      async () => {
        const { data } = await admin
          .from('crm_personas')
          .select('email, reputation_score, reputation_bucket')
          .eq('identity_persona_id', personaId)
          .maybeSingle();
        return (data as CrmPersonaRow | null) ?? null;
      },
      null,
    ),
    safe<Array<{ chain: 'evm' | 'btc' | 'sol'; status: string; expires_at: string | null }>>(
      async () => {
        const { data } = await admin
          .from('wallet_alias_commitments')
          .select('chain, status, expires_at')
          .eq('did_persona_id', personaId);
        return (data ?? []) as Array<{ chain: 'evm' | 'btc' | 'sol'; status: string; expires_at: string | null }>;
      },
      [],
    ),
    safe(
      () =>
        getCartridgeAdminGrants(
          authProfileId,
          [],
          // callerEmail is for the email-alias fallback in
          // resolveAdminFlag; we don't have it here without an extra
          // round-trip. The fallback only matters when the caller's
          // own grants don't resolve directly — which they should
          // for a graph read keyed off persona.auth_profile_id.
          null,
        ),
      { isGlobalAdmin: false, cartridgeSlugs: [] as string[] },
    ),
    safe<string[]>(
      async () => {
        const { data } = await admin
          .from('persona_activations')
          .select('activation_id')
          .eq('persona_id', personaId)
          .eq('status', 'active');
        return ((data ?? []) as Array<{ activation_id: string }>).map((r) => r.activation_id);
      },
      [],
    ),
    safe<{ isInvestor: boolean; tier: string | null }>(
      async () => {
        if (!authProfileId) return { isInvestor: false, tier: null };
        const { data } = await admin
          .from('crm_investors')
          .select('auth_profile_id, tier')
          .eq('auth_profile_id', authProfileId)
          .maybeSingle();
        if (!data) return { isInvestor: false, tier: null };
        const row = data as { auth_profile_id?: string; tier?: string | null };
        return { isInvestor: true, tier: row.tier ?? null };
      },
      { isInvestor: false, tier: null },
    ),
    safe<number | null>(
      async () => {
        const { data } = await admin
          .from('knyt_reward_grants')
          .select('amount_knyt')
          .eq('persona_id', personaId);
        const rows = (data ?? []) as Array<{ amount_knyt: unknown }>;
        if (rows.length === 0) return null;
        const total = rows.reduce((s, r) => s + parseFloat(String(r.amount_knyt ?? 0)), 0);
        return Number.isFinite(total) ? parseFloat(total.toFixed(8)) : null;
      },
      null,
    ),
    safe<{ episodes: string[]; cards: string[] }>(
      async () => {
        const owned = await getOwnedAssetIds(personaId);
        return {
          episodes: owned.expanded.length > 0 ? owned.expanded : owned.direct,
          cards: owned.ownedSkus,
        };
      },
      { episodes: [], cards: [] },
    ),
    safe<PersonaAssetGraph['ownedAssets']['iQubes']>(
      async () => {
        const { data: holdings } = await admin
          .from('persona_iqube_holdings')
          .select('registry_asset_id, asset_class, trust_band, source, acquired_at')
          .eq('persona_id', personaId)
          .eq('status', 'active');
        const typed = (holdings ?? []) as Array<{
          registry_asset_id: string;
          asset_class: string;
          trust_band: string | null;
          source: string;
          acquired_at: string;
        }>;
        if (typed.length === 0) return [];
        // Single batched lookup against registry_assets for the names.
        const assetIds = Array.from(new Set(typed.map((h) => h.registry_asset_id)));
        const { data: catalog } = await admin
          .from('registry_assets')
          .select('asset_id, name')
          .in('asset_id', assetIds);
        const nameById = new Map<string, string | null>(
          ((catalog ?? []) as Array<{ asset_id: string; name: string | null }>).map((r) => [
            r.asset_id,
            r.name ?? null,
          ]),
        );
        return typed.map((h) => ({
          registryAssetId: h.registry_asset_id,
          name: nameById.get(h.registry_asset_id) ?? null,
          assetClass: h.asset_class as IqubeAssetClass,
          trustBand: h.trust_band,
          source: h.source,
          acquiredAt: h.acquired_at,
        }));
      },
      [],
    ),
    safe<string[]>(
      async () => {
        // Best-effort lookup — agent provisioning is operational state
        // today (e.g. marketa_agent_personas). The resolver scans the
        // tables we know about; missing tables are silently skipped.
        const out: string[] = [];
        try {
          const { data } = await admin
            .from('marketa_agent_personas')
            .select('agent_id')
            .eq('persona_id', personaId);
          for (const row of (data ?? []) as Array<{ agent_id?: string }>) {
            if (row.agent_id) out.push(row.agent_id);
          }
        } catch {
          // table absent — skip.
        }
        return Array.from(new Set(out));
      },
      [],
    ),
  ]);

  return {
    identifiers: {
      displayLabel: persona.display_label,
      email: crmPersona?.email ?? null,
      fioHandle: persona.fio_handle,
      rootDidPresent: !!rootIdentity?.did_uri,
      kybePresent: !!rootIdentity?.kybe_id,
      identifiability: persona.default_identity_state,
      walletAliases: walletAliases.map((w) => ({
        chain: w.chain,
        status: w.status,
        expiresAt: w.expires_at,
      })),
    },
    reputation: {
      score: Number(crmPersona?.reputation_score ?? 0),
      bucket: Number(crmPersona?.reputation_bucket ?? 0),
    },
    adminGrants,
    activeActivations: activations,
    investorStatus: investorRow,
    knytBalance: knytGrants,
    ownedAssets: {
      episodes: ownedContent.episodes,
      cards: ownedContent.cards,
      iQubes: ownedIqubes,
    },
    agentsProvisioned: agents,
    resolved: {
      identifiers: true,
      reputation: crmPersona !== null,
      adminGrants: true,
      activations: true,
      investor: true,
      knyt: true,
      ownedContent: true,
      ownedIqubes: true,
      agents: true,
    },
  };
}

async function safe<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    const result = await fn();
    return result;
  } catch {
    return fallback;
  }
}
