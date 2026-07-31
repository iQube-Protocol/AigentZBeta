# PII Exposure Consent Surface — Backlog

**Date:** 2026-05-26
**Status:** Backlog. Created alongside the CRM ↔ identity / asset enrichment plan.
**Parent:** `2026-05-26_crm-identity-asset-enrichment-plan.md`

---

## The problem

Today (alpha), platform admins see verbatim email + display label + investor flag + active activations on any persona they review via `AdminAccessRequestsTab` and (when shipped) the Persona 360 inspector tab. The operator's posture for the alpha is: *all platform participants have a known relationship with the platform and stack; sharing PII with platform admins is fine.*

Two near-term events make that posture insufficient:

1. **Non-platform admins arrive.** Partner-tier admins (e.g. a KNYT-only `tenant_super_admin` who is NOT a platform_super_admin) start reviewing access requests for their own cartridge. Their visibility into the requester's PII should be narrower than a platform admin's.
2. **The persona must be able to revoke consent.** Today there's no surface where a user can see — let alone control — which audiences can see which fields of their identity. The Identity & Access Spine has `discloseCredential()` for one-shot disclosure but no persistent consent / grant store.

## What's needed

A persistent consent layer that the spine consults whenever a T1 PII field is about to be rendered to a non-self audience. Fields it must cover (initial set):

- `email`
- `displayLabel`
- `fioHandle` (T0 today → could become T1 by-disclosure)
- `walletAliases[].chain` and per-chain `status`
- `investorTier` (when present)
- `kybeAttestation` summary (any field beyond presence/absence)
- `reputationScore` / `reputationBucket`

Audience tiers (initial set):

- `self` — always visible (T0/T1 distinction applies)
- `platform_admin` — uber / platform_super / category_uber
- `cartridge_admin` — per-cartridge admin (a KNYT admin viewing a KNYT requester)
- `partner_admin` — sub-tenant admin scope (alpha: empty)
- `specific_persona` — explicit one-to-one grant (e.g. an investor approves a specific founder to see their wallet aliases)

## Sketch of the storage model

A single `persona_pii_consents` table, service-role only, keyed by `(persona_id, audience, field)`:

```sql
CREATE TABLE persona_pii_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      text NOT NULL,
  audience_kind   text NOT NULL CHECK (audience_kind IN ('platform_admin','cartridge_admin','partner_admin','specific_persona')),
  -- For 'cartridge_admin' / 'partner_admin' — the slug they admin.
  audience_scope  text,
  -- For 'specific_persona' — the persona id they granted to.
  audience_target text,
  field_key       text NOT NULL,
  visibility      text NOT NULL CHECK (visibility IN ('hidden','redacted','visible')),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  reason          text
);
```

Defaults (alpha posture preserved): if no row exists for `(persona_id, 'platform_admin', field_key)`, the spine treats it as `visible`. As the consent UI lands, sane platform-tier defaults shift to `visible` for non-sensitive fields (display_label) and `redacted` for sensitive ones (email — masked to `d***@metame.com` when no explicit consent exists), with the user able to override per-audience.

## Surfaces the persona needs

- **A "Who can see me?" panel** on the metaMe Cartridge (Settings / Sovereignty tab). Lists every audience × field cell + the current visibility state. Edit-in-place.
- **A consent notification** when a non-platform admin (e.g. a KNYT cartridge admin) opens an access request — the admin sees the masked surface and a "Request to view email" affordance that DM's the persona for one-off consent.
- **An audit trail** — every disclosure event writes a receipt readable on the operator's "Who saw my data?" panel. Same pattern as `activity_receipts`.

## Why not just gate everything in code

Because the spine already has the disclosure pathway (`discloseCredential()`). The gap is a persistent consent store the spine can read from BEFORE deciding whether to call `discloseCredential` or return a masked field. That's the missing piece, not the gate logic itself.

## Sequencing

This is **NOT** blocking the alpha access-requests workflow. It's the next layer down — and the alpha posture (full PII to platform admins, deferred consent for partner-tier) is the operator's deliberate call.

Pick this up when:

- the iQube fleshing-out workstream has landed (so blakQube-backed disclosure has a richer story), OR
- the first non-platform-admin (tenant-scoped) reviewer joins the system, whichever comes first.

## Files to touch when this is built

- `supabase/migrations/202607xx0000_persona_pii_consents.sql` — new
- `services/identity/piiConsent.ts` — new resolver (`resolvePiiVisibility(personaId, audience, fields)`)
- `services/identity/personaAssetGraph.ts` — gate field emission via `piiConsent.resolvePiiVisibility`
- `app/api/admin/access-requests/route.ts` — call the visibility resolver before emitting requester fields
- `app/triad/components/codex/tabs/Persona360InspectorTab.tsx` — same
- A new persona-facing "Who can see me?" tab on `metame-codex` (sovereignty group)

## Reference

- `services/identity/getActivePersona.ts` — the spine entry
- `types/access.ts` — T0 / T1 / T2 tier documentation
- `codexes/packs/agentiq/updates/2026-05-26_crm-identity-asset-enrichment-plan.md` — parent
