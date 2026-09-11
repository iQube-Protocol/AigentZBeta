# myCartridge Phase 5 — tab template framework

**Date:** 2026-06-02
**Status:** Phase 5a shipped — framework + 4 reference templates + 8 stubs + renderer dispatch. Phase 5b carries the deep extractions (community/venture/members) and lands after Phase 6 + Phase 7 dependencies.
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §22, §33 row 5
**Predecessors:** Phase 4a (DB tables + columns), Phase 4b (spine extension)

## What Phase 5a delivered

The framework so the wizard (Phase 6) can write `tab.type = 'template'` + `tab.config.templateId = '<id>'` and have it render end-to-end without further code edits per cartridge.

### Types

| Edit | File | Change |
|---|---|---|
| Extend `CodexTabType` | `types/codex.ts` | Added `'template'` literal to the union. |
| Extend `CodexTabConfig` | `types/codex.ts` | Added optional `templateId?: CartridgeTabTemplateId` (imported via the v0.4 schema type). |
| Extend `CodexTab` | `types/codex.ts` | Added `memberOnly?`, `inviteOnly?`, `tokenGated?`, `roleRequired?` — mirrors the Phase 4a `codex_tabs` columns. The runtime enforcement still flows through the spine (`evaluateAccess` with `member:<slug>` / `role:<slug>:<role>` credentials); the type fields just declare intent so the wizard + admin tooling can write them. |

### Template registry

New directory `app/triad/components/codex/tabTemplates/`:

| File | Status |
|---|---|
| `types.ts` | NEW — `TabTemplateProps` shape (cartridgeSlug, personaId, theme, density, permissions, config, shell) + `TabTemplateRegistry` map type. |
| `registry.tsx` | NEW — single source of truth `TAB_TEMPLATES` registry covering all 12 template ids from `CartridgeTabTemplateId`. |
| `PulseTemplate.tsx` | Phase 5a reference — delegates to `KnytCommunityContentTab` with `cartridge={cartridgeSlug}` (cast to `"knyt" \| "qripto"` until Phase 5b widens the prop). |
| `CodexTemplate.tsx` | Phase 5a reference — read-only Codex entries panel. Phase 5b wires `/api/cartridge/[slug]/codex/entries`. |
| `ActiveTemplate.tsx` | Phase 5a reference — renders the metrics + actions arrays from `config`. Per PRD §20 active-tab pattern. |
| `OverviewTemplate.tsx` | Phase 5a reference — cartridge identity card (title, description, purpose, category, visibility, audience). Consumes the v0.4 myCartridge block via wizard-written config. |
| `StubTemplate.tsx` | NEW — 8 thin factories (`ExperienceStub`, `WalletStub`, `LedgerStub`, `CommunityStub`, `MembersStub`, `VentureStub`, `SettingsStub`, `AdminStub`) each rendering a labelled "coming soon" panel naming the templateId and the Phase that lands the deep implementation. Each stub is greppable by id. |

### Renderer dispatch

`app/triad/components/codex/TabRenderer.tsx`: added a branch ahead of the existing `liquid-ui` branch. When `tab.type === 'template'`, the renderer:

1. Reads `tab.config.templateId`.
2. Looks up `TAB_TEMPLATES[templateId]` — falls back to a labelled error panel if the id is missing or unknown (mirrors the existing `componentRegistry` error path).
3. Constructs the canonical `TabTemplateProps` envelope from the parent props (cartridgeSlug = `codexId`, personaId / theme / density / shell / isAdmin / isPartner) + the wizard's `tab.config.props` as `config`.
4. Renders the template with those props.

No other tab types are touched. `static`, `dynamic`, `liquid-ui` behave exactly as before.

## What Phase 5a explicitly does NOT include

Per PRD §22 the targeted production extractions are:

- `PulseTabTemplate` — deep extraction from `QriptoPulseTab` with reactions routing parameterized
- `CodexTabTemplate` — full extraction from KNYT Scrolls + Qripto Codex
- `ActiveTabTemplate` — extracted from KNYT Order tab Liquid template
- `VentureTabTemplate` — extracted from `AlphaProgrammeTab` with workstream count parameterized
- `MembersTabTemplate` — mirrors KNYT cartridge members + cartridge Experience Matrix fork

These are real engineering — each is 100-300 lines of meaningful UI lift. **Phase 5a delivers the framework + minimum-viable references; Phase 5b carries the deep extractions.** This split:

- Lets Phase 6 (wizard) start writing `templateId` to the DB and lets `TabRenderer` render every cartridge that's wizard-created end-to-end (against the reference + stub templates).
- Keeps the deep extractions scoped — each can land in its own commit alongside its API route work without coupling to the wizard.
- Means the `Pulse`, `Codex`, `Active`, `Overview` paths render as real content today (Pulse via existing community-content; Overview from wizard config; Active from wizard config; Codex via empty state until 5b).

The stub Phase column maps cleanly to the PRD §32 plan:

| Template id | Scheduled |
|---|---|
| `experience-v1` | Phase 5b |
| `community-v1`  | Phase 5b |
| `venture-v1`    | Phase 5b |
| `members-v1`    | Phase 7 |
| `settings-v1`   | Phase 7 |
| `admin-v1`      | Phase 7 |
| `wallet-v1`     | Phase 9 |
| `ledger-v1`     | Phase 10 |

## Privacy / spine alignment

- `TabTemplateProps.permissions` carries only `isAdmin` / `isPartner` / `cartridgeRole` (T1-safe — Phase 4b projections, never persona ids).
- Tab visibility gates declared in `CodexTab` (memberOnly / inviteOnly / tokenGated / roleRequired) are intent-only at the type layer. The actual gate fires server-side via `evaluateAccess` with the Phase 4b credentials before the tab is ever mounted; the template renders only when the gate already allowed.

## Test posture

- Full TS typecheck: clean (only pre-existing tsconfig noise).
- Sibling spine tests (`access-spine`, `layer3-admin-cartridge-gating`, `require-cartridge-admin`): 42 pass, 1 pre-existing fail (the `isDebugBypassEnabled` hardcoded-ON mismatch — already logged at `2026-06-02_debug-bypass-test-assertion-mismatch-backlog.md`).
- No template-specific tests in Phase 5a — the templates are thin presentation components consuming wizard-written config; the contract is covered by the renderer dispatch test in Phase 6 once the wizard writes its first cartridge.

## What unlocks next

- **Phase 6 (CartridgeSetupWizard):** can write `tab.type = 'template'` + `tab.config.templateId` + `tab.config.props` directly into `codex_tabs` rows. Every wizard-created tab renders against the framework with zero additional code per cartridge.
- **Phase 7 (operator manager):** tab editor UI can offer the 12 template ids as a select; preview pane uses the same `TAB_TEMPLATES` registry.
- **Phase 5b (deep extractions):** swap each `*Stub` factory for its real component in `registry.tsx`. One-line per swap; no cross-file ripple.
