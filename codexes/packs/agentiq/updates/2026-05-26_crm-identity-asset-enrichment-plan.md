# CRM ↔ Identity / Asset Enrichment — Planning Doc

**Date:** 2026-05-26
**Status:** Planning. No schema changes shipped. Captured here as the followup to the admin-access-requests refinements pass (commit `acefbea2`).
**Author:** Claude Code session `claude/friendly-lovelace-41Wsn`

---

## Why this exists

When a global admin reviews an `admin_access_requests` row (commit `acefbea2`), the inline enrichment block shows:

- existing admin grants (from `crm_admin_roles`)
- active runtime activations (from `persona_activations`)
- whether the requester has an investor record (from `crm_investors`)

That's enough for the alpha to make a yes/no call. But it doesn't surface:

- which **DIDQube identities** the requester operates (root_did, kybe_did, FIO handle)
- which **SmartWallet** addresses (EVM / BTC / SOL) they've registered — and crucially, which on-chain holdings those wallets carry (KNYT cards, episode NFTs, partner allocations, etc.)
- which **AIQS** (AgentiQ iQube Suite — TalentQubes, AigentQubes, DataQubes, ToolQubes, ConnectorQubes) the persona owns
- which **agents** (Aigent Z, Aigent Marketa, Aigent Kn0w1, MoneyPenny, …) they have provisioned, configured, or paid for
- which **cartridges / packs** they hold entitlements on (full episode catalog, premium issues, partner-only artifacts)

The admin's review is therefore narrower than it should be. The user's request:

> "The CRM should also be enriched, including with knowledge of personas, DIDqube identities and Smartwallet ownership, and DIDQube, agents, AIQS, and so on, that they have."

This document describes how to wire that enrichment — without violating the Identity & Access Spine contract.

---

## What the platform ALREADY has

Critical context for anyone proposing schema changes: a substantial portion of this graph already exists. Don't propose new tables for data that's already modelled.

| Concern | Already present | Tables / files |
|---|---|---|
| CRM ↔ persona link | ✅ Yes | `crm_personas.identity_persona_id` (FK to `persona.id`), `crm_personas.root_did`, `crm_personas.kybe_did`; backfilled by trigger `sync_persona_to_crm_persona` (`supabase/migrations/20260512040000_crm_personas_smart_link.sql`) |
| CRM ↔ DIDQube identity | ✅ Yes (joined view) | `crm_personas_with_identity` VIEW joins `crm_personas` → `persona` → `root_identity` → `kybe_identity` |
| FIO handle | ✅ Yes | `personas.fio_handle` (T0, server-only) |
| External wallet linkage | ✅ Yes (privacy-preserving) | `wallet_alias_commitments` — stores commitments only, never plaintext addresses (`supabase/migrations/20260429000000_wallet_alias_commitments.sql`). Plaintext addresses live in the persona blakQube, encrypted; reading them requires `discloseCredential()` on the spine. |
| Multi-email merge | ✅ Yes | `crm_auth_profile_emails` (alias table); `getMergedLinkedAuthProfileIds` walks it. The admin-grant resolver already uses this fallback. |
| Reputation | ✅ Yes | `crm_personas.reputation_score`, `crm_personas.reputation_bucket` |
| Persona admin grants | ✅ Yes | `crm_admin_roles` (auth_profile_id → role_type + tenant scope) — surfaced via `services/access/cartridgeAdminGrants.ts` and resolved through the spine into `ActivePersonaContext.cartridgeFlags.adminCartridges` |
| Runtime activations | ✅ Yes | `persona_activations` (T0 persona_id → activation_id status) |
| Investor record | ✅ Yes | `crm_investors` (key off `auth_profile_id`) |
| KNYT episode entitlements | ✅ Yes | `master_content_qubes`, `store_skus`, plus per-persona resolution in `services/rewards/assetOwnership.ts::userOwnsAsset()` |
| KNYT reward grants | ✅ Yes | `knyt_reward_grants` (per-persona $KNYT balances) |
| Registry assets catalog | ✅ Yes | `registry_assets` (asset_id, asset_class, tenant_id, trust_band, …) |

**Gap analysis:**

What's NOT present today is the read-side projection: a way for a reviewer (or aigentMe surface) to ask "give me the complete identity / asset graph for persona X" in a single query, and get back a T1-safe payload.

The data is mostly there. The wiring isn't.

---

## What's actually missing

1. **A unified read-only resolver: `getPersonaIdentityAssetGraph(personaId)`** that joins:
   - `crm_personas_with_identity` (for DIDQube + reputation + email),
   - `personas` (for fio_handle, default_identity_state, evm/btc/sol addresses *if* the operator has consented to disclosing — the commitment table is the canonical source),
   - `wallet_alias_commitments` (for which chains the persona has registered an alias, with TTL + status — never the plaintext addresses),
   - `persona_activations` (active surfaces),
   - `crm_admin_roles` (grants),
   - `crm_investors` (investor record presence + tier),
   - `knyt_reward_grants` (aggregated $KNYT balance),
   - `master_content_qubes` + `store_skus` + the entitlement query (the same path `userOwnsAsset()` uses) — to list owned episodes / cards / packs,
   - `registry_assets` filtered by persona-scoped tenancy or by persona-owned AigentQube records (see §3 — this is the genuinely new layer).
2. **A persona ↔ AigentQube / TalentQube / DataQube ownership table** — most asset classes today are platform-tier; the persona ownership graph for AIQS doesn't yet have a canonical table. `registry_assets.tenant_id` only carries `platform` or a tenant slug; persona-grain ownership of an iQube instance (e.g. "this user's TalentQube #42") needs an explicit row.
3. **The UI surface** — the enrichment panel inside `AdminAccessRequestsTab` (and a richer "Persona 360" inspector tab for admins).

---

## Proposed schema delta — `persona_iqube_holdings`

Single table to project persona-grain ownership of iQube instances. Service-role only; spine-gated reads.

```sql
CREATE TABLE IF NOT EXISTS public.persona_iqube_holdings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          text NOT NULL,
  -- The catalog row that defines the asset class + capabilities.
  -- For one-of-a-kind persona iQubes (a TalentQube unique to this
  -- persona), the registry_assets row IS the persona's instance.
  -- For shared-catalog assets (a SkillQube the persona has the right
  -- to invoke), the row references a shared catalog entry.
  registry_asset_id   text NOT NULL REFERENCES public.registry_assets(asset_id),
  asset_class         text NOT NULL,  -- TalentQube | AigentQube | DataQube | ToolQube | SkillQube | ConnectorQube | WorkflowQube
  -- How the persona acquired this holding.
  source              text NOT NULL DEFAULT 'self-mint'
    CHECK (source IN ('self-mint','minted-via-store','airdrop','partner-grant','admin-grant','inherited','imported')),
  -- For shared catalog entries — the seat / quota the persona has.
  capacity_units      integer,
  capacity_unit_label text,
  -- For unique instances — the iQube content hash / CID / on-chain id.
  instance_anchor     text,
  trust_band          text,   -- snapshot at acquisition time
  acquired_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','revoked','expired')),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, registry_asset_id, instance_anchor)
);
CREATE INDEX idx_persona_iqube_holdings_persona ON public.persona_iqube_holdings(persona_id);
CREATE INDEX idx_persona_iqube_holdings_class ON public.persona_iqube_holdings(asset_class);
CREATE INDEX idx_persona_iqube_holdings_status ON public.persona_iqube_holdings(status);
ALTER TABLE public.persona_iqube_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "persona_iqube_holdings_service" ON public.persona_iqube_holdings FOR ALL USING (auth.role() = 'service_role');
```

Why one table and not five? `registry_assets.asset_class` already distinguishes asset classes; the holding row only needs to point at the catalog entry and capture the acquisition delta. Five tables would mirror the catalog and double the join surface for the resolver — keeping it one table follows the same shape as `persona_activations` (which is `(persona_id, activation_id, status)` and works fine).

---

## Proposed resolver — `services/identity/personaAssetGraph.ts`

A single function the request-review surface (and aigentMe) calls.

```ts
export interface PersonaAssetGraph {
  identifiers: {
    fioHandle: string | null;           // T0 — never serialised to browser
    rootDidPresent: boolean;            // T1 — boolean, not the DID itself
    kybePresent: boolean;
    walletAliases: Array<{ chain: 'evm'|'btc'|'sol'; status: string; expiresAt: string }>; // T1
  };
  reputation: { score: number; bucket: number };
  // …everything below is T1-safe — counts, slugs, tier labels.
  adminGrants: { isGlobalAdmin: boolean; cartridgeSlugs: string[] };
  activeActivations: string[];
  investorStatus: { isInvestor: boolean; tier: string | null };
  knytBalance: number | null;
  ownedAssets: {
    episodes: string[];           // master_content_qubes slugs
    cards: string[];              // store_skus slugs
    iQubes: Array<{
      registryAssetId: string;
      assetClass: 'TalentQube'|'AigentQube'|'DataQube'|'ToolQube'|'SkillQube'|'ConnectorQube'|'WorkflowQube';
      trustBand: string | null;
      acquiredAt: string;
    }>;
  };
  agentsProvisioned: string[];    // T1 — agent ids ('aigent-marketa', 'aigent-kn0w1', etc.)
}

export async function getPersonaAssetGraph(
  personaId: string,
  options?: { skipBlocking?: boolean }
): Promise<PersonaAssetGraph>;
```

Spine contract:

- The resolver is **server-only** (Node runtime). Callable from API routes and other server code.
- It accepts a T0 `personaId` and returns a T1-safe payload. **It never returns root_did, kybe_did, evm_address, btc_address, sol_address, authProfileId, or any other T0 identifier.** Wallet linkage is exposed as `walletAliases` — a list of `(chain, status, expiresAt)` tuples only.
- The route layer is responsible for gating who can call it. The natural admin-tier surfaces are: the access-requests reviewer (read for a specific persona, scoped to the requesting persona), and a new "Persona 360" inspector tab for global admins (read for any persona).
- It composes existing resolvers — does NOT fork them. Reads through `cartridgeAdminGrants.getCartridgeAdminGrants()`, `assetOwnership.userOwnsAsset()`, etc. so changes to the spine model show up here automatically.

---

## Migration sequencing

1. **C-followup-1 — `persona_iqube_holdings` table** (~30 minutes). Migration + service-role RLS. Empty until backfill lands.
2. **C-followup-2 — `getPersonaAssetGraph` resolver** (~60 minutes). Server-side, no UI yet. Spine-style unit test alongside.
3. **C-followup-3 — enrich `AdminAccessRequestsTab` rows** (~30 minutes). Replace the alpha enrichment shape with the graph; the row card grows a 2nd accordion section "Identity & Assets" that the reviewer expands.
4. **C-followup-4 — Persona 360 inspector tab** (optional, larger). New global-admin tab under `metame-codex/admin/persona-360` that lets the admin look up any persona by display label / email / persona id and see the full graph.
5. **C-followup-5 — Backfill jobs** — populate `persona_iqube_holdings` for:
   - existing KNYT episode owners (one row per owned episode, asset_class = 'DataQube' or a new 'EpisodeQube')
   - existing AigentQube provisionings (when this table is reached, the trigger that creates a persona-bound AigentQube also inserts a `persona_iqube_holdings` row)
   - existing TalentQubes (already minted; backfill from whatever table they live in today)

Each step is independently reviewable. Stop after C-followup-3 for the "admin reviewer has more context" minimum, OR go through C-followup-4 for the wider "Persona 360" goal the user articulated.

---

## What this is NOT proposing

- **Not** changing the privacy model. Plaintext wallet addresses stay in the persona blakQube; commitments stay in `wallet_alias_commitments`. The graph carries `walletAliases` (chain + status + ttl), not addresses.
- **Not** adding new CRM tables. `crm_personas` and friends stay as-is. The new table sits in the platform schema (parallel to `persona_activations`), not the CRM schema, because asset ownership is a platform concern, not a CRM concern. CRM continues to be the people-relationship layer.
- **Not** removing or replacing any existing resolver. `cartridgeAdminGrants.getCartridgeAdminGrants`, `assetOwnership.userOwnsAsset`, etc. remain canonical. The graph resolver composes them.
- **Not** exposing T0 identifiers across the wire. `personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, plaintext wallet addresses, and cross-persona `fioHandle` remain T0 — see `CLAUDE.md` §"Identity & Access Spine — CANONICAL SoT".

---

## Operator answers (2026-05-26)

The four open questions were resolved in the same session this doc was written. Captured here so any future reader has the answers inline rather than chasing them across QubeTalk packets.

1. **AigentQube ownership** → the **iQube Registry** (`registry_assets`) is the canonical SoT. Per-persona AigentQube provisioning rows project into `persona_iqube_holdings` (proposed below) which references `registry_assets.asset_id`. Tables like `marketa_agent_personas` remain as agent-specific operational state; they are NOT the ownership SoT.

2. **TalentQube ownership** → also the **iQube Registry**. Where a TalentQube is bespoke to a persona, the persona-specific facts (skills, history, attestations) live as **blakQube content** on that iQube — read via `discloseCredential()` at the spine layer, never queried directly. `persona_iqube_holdings` carries the linkage row + acquisition metadata; the rich content lives encrypted on the iQube.

3. **Persona 360 inspector tab** → **build now**. Implemented as C-followup-4 alongside the resolver + enriched access-requests panel. Sits under `metame-codex/admin/persona-360`.

4. **PII display rules — alpha** → **show the email verbatim** to platform admins. Rationale from the operator: "All platform participants have a known relationship with the platform and stack, and new non-platform admins would need to request the user's consent to share PII with them." That's an explicit deferral to the consent system, not an absence of one.

   **Backlog item (PII control surface)** — users need an ongoing-consent mechanism that controls which audiences (platform admins, partner admins, specific cartridge admins, named third parties) can see which PII fields (email, FIO handle, wallet aliases, KYC tier). Spike this into a separate doc under `agentiq/updates/` when the next iQube workstream picks it up; reference the spine's existing `discloseCredential()` contract for the disclosure pathway. The Persona 360 + access-requests panels assume the alpha posture until that work lands.

---

## Files this would touch when implemented

- `supabase/migrations/202605xx0000_persona_iqube_holdings.sql` — new
- `services/identity/personaAssetGraph.ts` — new
- `app/api/admin/access-requests/route.ts` — extend GET enrichment block to consume the graph
- `app/triad/components/codex/tabs/AdminAccessRequestsTab.tsx` — render the new enrichment shape
- `app/triad/components/codex/tabs/Persona360InspectorTab.tsx` — new (only if step 4 is on)
- `data/codex-configs.ts` — register the new tab under `metame-codex` admin group

---

## Reference reading

- `CLAUDE.md` — Identity & Access Spine — CANONICAL SoT (this doc is downstream)
- `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
- `codexes/packs/agentiq/updates/2026-04-29_plaintext-wallet-address-deprecation.md`
- `codexes/packs/agentiq/updates/2026-05-26_spine-admin-grants-extension.md` (mentioned in code, not always present on disk — the per-cartridge admin grants doc)
- `services/identity/getActivePersona.ts` — the spine entry point
- `services/access/cartridgeAdminGrants.ts` — admin grant resolver, alias map
- `services/rewards/assetOwnership.ts` — userOwnsAsset() — the existing per-persona ownership resolver
