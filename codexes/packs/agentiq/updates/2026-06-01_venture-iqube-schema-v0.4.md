# Venture iQube schema v0.4 — myCartridge block

**Date:** 2026-06-01
**Status:** spec · v0.4 · supersedes v0.3 (which superseded v0.2 / v0.1)
**Surface:** aigentMe ingest + CartridgeSetupWizard (Phase 6)
**Schema id:** `https://aigentz.me/schemas/venture-iqube/v0.4.json`
**Reference:** myCartridge PRD v0.2 §27 (`codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md`)

## What changed since v0.3

v0.4 adds a nested **`myCartridge`** block under each `ventures[]` entry. The block captures the operator's intent for their own cartridge — identity, purpose, tab template selection, audience posture, Triad configuration (Cartridge + Copilot + Wallet), specialist whitelist, active tab declaration, membership model, and catalogue opt-in.

The legacy top-level `smartTriad` key — never officially in the schema but observed in early experiments — is **rejected at ingest** with a migration error.

**MVP rule:** at most one `ventures[]` entry carries a `myCartridge` block per persona. Platform sys-admins may exceed (multi-cartridge personas).

## Block shape (nested under `ventures[N].myCartridge`)

```jsonc
{
  "configured": true,
  "slug": "string (URL-safe lowercase with dashes; auto-derived from title, editable)",
  "title": "string (≤140)",
  "description": "string (≤2000)",
  "purpose": "string (≤4000) — feeds copilot system prompt",
  "category": "community | venture | knowledge | creative | media | franchise | learning | research | professional | private",
  "visibility": "public | private | invite-only | member-only",

  /* ownerPersonaId is intentionally absent — T0 / spine-resolved only.
     Any client-supplied ownerPersonaId is rejected by the Zod validator. */

  "audience": {
    "kind": "open | gated | franchise | inner-circle",
    "estimatedSize": "1-10 | 10-100 | 100-1k | 1k-10k | 10k+",
    "languages": ["en"]
  },

  "template": "community-v1 | venture-v1 | knowledge-v1 | creative-v1 | custom",

  "tabs": [
    {
      "slug": "string (≤128)",
      "templateId": "pulse-v1 | codex-v1 | experience-v1 | active-v1 | wallet-v1 | ledger-v1 | community-v1 | members-v1 | venture-v1 | settings-v1 | admin-v1 | overview-v1",
      "visibility": "public | member | admin | invite | token-gated",
      "primary": true,
      "tokenGate": { "tokenId": "q-cent | usdc | knyt", "minBalance": "string" }
    }
  ],

  "smartTriad": {
    "copilot": {
      "source": "aigentMe | cartridge-copilot | specialist",
      "cartridgeCopilotPersonaId": "string (optional; null for MVP)",
      "promptContext": "string (≤4000)"
    },
    "knowledgeBase": {
      "ingestSources": ["mycanvas", "myworkspace", "uploads", "codex", "json_blob"],
      "embeddingScope": "cartridge | domain",
      "jsonBlob": { "uri": "string", "uploadedAt": "ISO-8601", "sizeBytes": 12345 }
    },
    "codex": {
      "enabled": true,
      "rootTabSlug": "codex",
      "registryEligible": false,
      "mintingEnabled": false
    },
    "wallet": {
      "enabled": true,
      "tokenWhitelist": ["q-cent", "usdc"],
      "primitives": {
        "cryptoSend": true,
        "cryptoReceive": true,
        "paymentRequest": true,
        "rewardPayout": true
      }
    }
  },

  "specialists": {
    "available": ["aigent-c", "marketa"],
    "primary": "aigent-c"
  },

  "activeTab": {
    "slug": "string",
    "catalogId": "string",
    "metrics": ["string"],
    "actions": ["string"]
  },

  "membershipModel": {
    "rolesEnabled": ["owner", "admin", "member"],
    "invitePolicy": "owner-only | admin-allowed | public-request",
    "membershipReceipts": true
  },

  "stateChangeReceipts": {
    "enabled": true,
    "receiptKinds": ["created", "tab_visibility", "member_invited", "crypto_send", "payment_request", "reward_payout", "codex_published", "activation_submitted", "activation_reviewed"]
  },

  "triadNomenclature": "v0.2",
  "catalogueOptIn": false
}
```

## Validation rules (Zod)

The Zod validator lives at `services/iqube/ventureQubeSchema.ts` and is the runtime source of truth. Key rules:

- `schemaVersion` must equal `'venture-iqube/v0.4'` for the myCartridge block to be accepted.
- `slug` matches `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` (URL-safe lowercase, 2–64 chars).
- `tabs[].length` ≥ 1 (every cartridge has at least one tab).
- `specialists.available.length` ≤ 3 — free tier cap per myCartridge PRD v0.2 §35 R7. Beyond 3 is payment-gated (typed in MVP, payment wiring deferred).
- `triadNomenclature` must equal `"v0.2"` (pins the Cartridge + Copilot + Wallet shape).
- Top-level `smartTriad` is rejected — the Triad lives nested inside `ventures[].myCartridge.smartTriad`.

## Ingest acceptance

`/api/persona/venture-iqube/ingest` now accepts v0.1, v0.2, v0.3, **and v0.4** payloads. For v0.4 payloads carrying a configured `myCartridge` block:

- The block is validated via Zod.
- The block is echoed back in the response under `result.myCartridge` as a slim preview (slug, title, category, visibility, primary tab slug, Triad enablement booleans, catalogue opt-in flag).
- The response includes `result.myCartridge.persistencePending: true` — the block is NOT yet written to `codex_configs`. Cartridge persistence ships in Phase 11 (Active Surface Access / Requests) per the PRD implementation plan.
- A warning is appended to `result.warnings`: `"v0.4 myCartridge block accepted in preview; cartridge persistence to codex_configs is deferred to Phase 11"`.

For v0.1 / v0.2 / v0.3 payloads, ingest behavior is unchanged.

## Operator prompt to re-emit (when ready to use v0.4)

> The Venture iQube schema has been bumped to v0.4. The new block lives nested under each `ventures[]` entry as `myCartridge`. Re-emit your Venture iQube JSON with:
>
> 1. `schemaVersion: "venture-iqube/v0.4"`.
> 2. Add a `myCartridge: { ... }` block to the single venture that should become your cartridge — fill in identity, purpose, category, visibility, template, tabs, smartTriad, specialists, activeTab, membershipModel, stateChangeReceipts, and `triadNomenclature: "v0.2"`.
> 3. Set `catalogueOptIn: true` only if you want the cartridge's active tab to enter the metaMe Activations Catalogue approval queue at ingest time.
> 4. Validate strictly against the v0.4 Zod schema and emit a single JSON file.

## Data fix

None for v0.4. Existing v0.3 payloads remain valid; the v0.4 block is purely additive.

## Roadmap

v0.5+ adds:
- Per-cartridge KB embedding pipeline (cartridge-scoped vector search vs. today's domain-scoped fallback).
- Per-cartridge tokens (bespoke ERC-20 deploy from inside the wizard).
- Token-gated tabs UI (typed in v0.4 via `CartridgeTabSpec.tokenGate`; UI deferred).
- Three-stage approval chain activation (Registry → Studio → metaMe) — `CARTRIDGE_APPROVAL_STAGES` flag flips from `'metame-only'` (MVP) to `'registry+studio+metame'`.
- Cartridge-level copilot persona (separate from owner's aigentMe).
- Specialist >3 payment flow.

## Cross-references

- TypeScript types: `types/ventureQube.ts`
- Zod validator: `services/iqube/ventureQubeSchema.ts`
- Ingest route: `app/api/persona/venture-iqube/ingest/route.ts`
- PRD: `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §27
- Prior schemas: v0.1 / v0.2 / v0.3 (sibling files in same updates directory)
