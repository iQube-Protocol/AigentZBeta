# myCartridge Phase 6 — CartridgeSetupWizard (5 steps, end-to-end)

**Date:** 2026-06-02
**Status:** shipped — wizard, two API routes, AigentMeWelcomeTab wire-up
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §28, §32 Phase 6, §33 row 6
**Predecessors:** Phase 3 (ventureQube v0.4 + Zod), Phase 4a (DB), Phase 4b (spine), Phase 5a (tab templates)

## Scope

End-to-end wizard so an operator can click through the 5 steps, save, and have a real cartridge appear in `codex_configs` + `codex_tabs` + `cartridge_activations` + `cartridge_memberships` with the spine recognising the owner role on the next persona resolution.

## Files added (4) + modified (1)

| File | Status | Purpose |
|---|---|---|
| `app/api/assistant/cartridge-config/route.ts` | NEW | POST — persists wizard output to all 4 destinations in dependency order. Zod-validated payload. Slug-uniqueness pre-check. Service-role inserts. Partial-state recovery hooks (returns `partial.cartridgeId` on mid-flight failure). |
| `app/api/assistant/cartridge-recommend/route.ts` | NEW | POST — recommends template bundle + category + specialists from the persona's ExperienceQube via pure keyword + experienceType heuristic. No LLM call in MVP; rationale string returned for transparency. |
| `components/metame/setup/CartridgeSetupWizard.tsx` | NEW | The 5-step modal. Mirrors `ExperienceModelSetupWizard.tsx`'s dialog shell, step indicator, Field + RadioGroup helpers, `personaFetch`, save/error UI, re-hydration on open. |
| `codexes/packs/agentiq/updates/2026-06-02_mycartridge-phase-6-wizard.md` | NEW | This doc. Registered in `agentiq/collections.json`. |
| `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` | MODIFIED | Import + state hook (`cartridgeWizardOpen`) + handler branch (`'set-up-cartridge'` CTA id) + dialog mount alongside the existing ExperienceModel wizard. |

## What the API routes do

### `POST /api/assistant/cartridge-config`

Body is the wizard output, validated against a local Zod schema that re-uses the v0.4 enums from `services/iqube/ventureQubeSchema.ts` (single source of truth).

On success, writes (in this order — fail-fast):

1. **Slug uniqueness check** — `SELECT id FROM codex_configs WHERE slug = $1`. Returns 409 if taken.
2. **`codex_configs`** — full identity row including Phase 4a columns (`owner_persona_id`, `primary_tab_slug`, `available_specialists`, `token_whitelist`, `smart_triad_config`). The `metadata` JSONB carries the wizard-only fields (description, purpose, category, audience, etc.) so the canonical descriptor doesn't lose them.
3. **`codex_tabs`** — one row per picked template with `type = 'template'`, `config = { templateId, props: {} }`, and the Phase 4a gate columns (`member_only`, `invite_only`, `role_required`, `token_gated`) populated from the wizard's per-tab visibility selection.
4. **`cartridge_activations`** — single row for the active tab. `status` defaults to `'approved'` (private surface) or `'pending_metame'` (when `catalogueOptIn=true`).
5. **`cartridge_memberships`** — single row granting `owner` role to the saving persona. The next `getActivePersona(req)` call projects this into `cartridgeFlags.cartridgeMemberships` (Phase 4b).

Failure recovery: any error after the codex_configs row exists returns `partial.cartridgeId` so Phase 7's operator manager can pick up the incomplete state.

### `POST /api/assistant/cartridge-recommend`

Reads the persona's ExperienceQube via `services/iqube/experienceQube.getExperienceQube` (existing service). Maps `experienceType` + `experienceName` keywords to one of the 4 template bundles (community / venture / knowledge / creative). The fallback is `venture` (most common Alpha intent). Returns:

```json
{
  "ok": true,
  "recommendation": {
    "templateBundle": "venture",
    "category": "venture",
    "visibility": "private",
    "availableSpecialists": ["aigent-c", "moneypenny", "marketa"],
    "primarySpecialist": "aigent-c",
    "rationale": "experienceType=venture_building"
  }
}
```

Specialists default per bundle come verbatim from PRD §24.

## The 5 wizard steps

1. **Identity** — title (auto-derives slug until user edits), description, category (10 options from §27).
2. **Purpose** — recommendation chip ("Use this" button accepts), purpose textarea, audience kind, estimated size, visibility (public/member-only/invite-only/private).
3. **Tabs** — template bundle radio (Community / Venture / Knowledge Estate / Creative Universe / Custom); picking a bundle pre-fills `tabs` from the canonical bundle table inside the wizard file. Inline reorder + add/remove deferred to Phase 7's manager.
4. **Permissions** — per-tab visibility picker (public/member/admin/invite/token-gated). Token-gated UI is typed only; wallet wiring lands in Phase 9. Primary tab dropdown.
5. **Triad & Active** — copilot source radio (cartridge-copilot disabled in MVP per PRD), specialist multi-select capped at 3 (4th+ shows free-tier lock per §35 R7), wallet on/off toggle, active tab dropdown, catalogue opt-in checkbox (only when `visibility = public`).

Each step has a validation gate; "Next" is disabled until the gate passes.

## What's intentionally NOT included in Phase 6

- **Inline tab reorder** (PRD §28 step 3) — Phase 7.
- **Per-tab metrics / actions composer** for the Active tab — Phase 7.
- **JSON blob upload** for KB sources (PRD §28 step 5) — typed in the form state but the upload UI is deferred.
- **Token-gating wallet wiring** — typed in `CodexTab.tokenGated`; Phase 9 wires the wallet primitives that verify the gate.
- **Cartridge-copilot opt-in** — radio is present but disabled with a "(v0.5)" label.
- **DVN receipt emission** on save (PRD §30 + §28 "DVN receipt: actionType: 'cartridge_configured'") — Phase 10 wires the receipt feed end-to-end; the wizard saves cleanly without it.
- **Bootstrap-driven CTA chip** — the `'set-up-cartridge'` handler is wired in `AigentMeWelcomeTab`, but the chip strip itself reads from `bootstrap.primaryCtas`. Adding the chip there is a small bootstrap-route change (1-line addition to `PRIMARY_CTAS`) and best landed alongside Phase 7's bootstrap extensions.

## Privacy / spine alignment

- The config route reads `persona.personaId` from the spine and ONLY uses it for `cartridge_memberships.persona_id` and `codex_configs.owner_persona_id` (both T0 columns per Phase 4a). It never echoes a persona id in the response.
- `cartridge_memberships(slug, persona, role='owner')` is the natural extension of Phase 4b: the next `getActivePersona` call projects this into `cartridgeFlags.cartridgeMemberships[slug] = 'owner'`, which means any `evaluateAccess` gate of form `role:<slug>:<role>` automatically allows the cartridge creator without any extra wiring.
- The recommend route returns slugs + role enum strings only — no persona ids surface even when the recommendation derives from a private ExperienceQube.
- Client-side calls use `personaFetch` per CLAUDE.md PARAMOUNT rule.

## Test posture

- Full TS typecheck: clean.
- Sibling spine tests (`access-spine`, `layer3-admin-cartridge-gating`, `require-cartridge-admin`, `spine-admin-cartridges`, `persona-broadcast-handshake`): **63 pass**, 1 pre-existing fail (the logged `isDebugBypassEnabled` mismatch). Zero new regressions from Phase 6.
- No wizard unit tests in Phase 6a — the wizard is a presentation surface dispatching to two routes. The contracts of both routes are guarded by their Zod schemas (which reject malformed payloads at the API boundary). Phase 7's manager surface will land an integration test that round-trips Wizard → API → DB → Render.

## Operator smoke test (after deploy)

1. Open metaMe → aigentMe welcome tab.
2. Click the (eventual) "Create cartridge" chip (or trigger `handleCtaClick('set-up-cartridge')` from devtools).
3. Walk through the 5 steps.
4. Click "Create cartridge" on step 5.
5. Verify in Supabase:
   - `SELECT id, slug, owner_persona_id, primary_tab_slug, available_specialists FROM codex_configs WHERE slug = '<chosen-slug>';`
   - `SELECT slug, type, config->>'templateId' FROM codex_tabs WHERE codex_id = '<chosen-slug>-cartridge' ORDER BY "order";`
   - `SELECT * FROM cartridge_activations WHERE cartridge_slug = '<chosen-slug>';`
   - `SELECT * FROM cartridge_memberships WHERE cartridge_slug = '<chosen-slug>';`
6. Verify in the running app:
   - `personaFetch('/api/wallet/active-persona')` includes the slug in `cartridgeFlags.cartridgeMemberships`.
   - The new cartridge appears in the codex picker (registry list) since `codex_configs.enabled = true`.

## What unlocks next

- **Phase 7 (operator manager surface)** — `MyCartridgeManagerTab` mounts inside myCluster, reads `codex_configs` filtered by `owner_persona_id`, lets the owner edit per-tab visibility / primary tab / member invites / metrics + actions.
- **Phase 5b (template extractions)** — newly-created cartridges render against the framework today (Pulse / Codex / Active / Overview against the reference templates; the rest against stubs labelled with their scheduled Phase).
- **Phase 8 (Triad scoping)** — `/api/codex/chat` will consume `cartridgeSlug` and route to the cartridge's `availableSpecialists` set.
- **Phase 10 (receipts + catalogue)** — wires the wizard's `catalogueOptIn` toggle to actually emit a DVN receipt and surface in the Activations Catalogue review queue.
