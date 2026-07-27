# Partner Workspace pattern — Horizen Pilot Series 001 (2026-07-26)

**Session scope:** the Venture Lab **Partner Workspace** pattern, instantiated first with
**Horizen** ("Horizen Pilot Series 001"). Governing principle (operator + Aletheon):
*do not build a Horizen Pilot application — compose a Pilot Workspace from existing
Venture Lab capabilities.* Nothing new was invented; this increment is orchestration.

## The abstraction

A **Partner Workspace** = Partner · Objectives · Collaborate · Operate · Evidence ·
Communicate. It is data plus composition:

- **Registry (single source, `inv.engineering.036`):** `services/venture/partnerWorkspace.ts`
  — `PARTNER_WORKSPACES`, one authoritative list. Shape:
  `{ id, partnerName, series, objectives[], phase, ownerAgentId, partnershipContext,
  layerOwners, links[] }`. Links are deep-link **descriptors** (codex slug + tab slug),
  consumed only through `buildCodexUrl()` — no raw URLs are stored.
- **Surface:** `PartnerProgrammesTab` (new tab `partner-programmes` on the hand-curated
  Venture Lab cartridge, `group: connect`, **`adminOnly: true`**). It renders ONLY what the
  registry declares — the canary fails the build if the tab grows its own partner data.
- **Reusability claim:** instantiating Project Liberty, Lamina1, Secret, or BlockC is **one
  new registry entry**. Same architecture, different participants.

## Partner identity — resolved (operator, 2026-07-26)

The operator has ruled: the KNYT campaign Wave-1 partner "Horizen" and the pilot partner
**are the same organization**, and the relationship is now an **AgentiQ/metaMe
partnership**, not a KNYT one. The previously-open question recorded in Chrysalis tracker
#80 is resolved; the registry records the ruling as data
(`partnershipContext: 'agentiq-metame'`).

## The agent-layer division (ratified), encoded as data

`layerOwners` in the registry — verified against the codebase's real id vocabulary
(`RUNTIME_AGENT_IDS` in `services/metame/agentLlmOrchestra.ts`; `AgentRoleId` in
`types/orchestration.ts`):

| Layer | Owner id | Vocabulary |
|---|---|---|
| Operations (workspace owner / Chief of Staff) | `aigent-z` | runtime |
| Relationship | `aigent-marketa` | runtime |
| Financial Services | `aigent-moneypenny` | runtime |
| Knowledge | `aigent-kn0w1` | runtime |
| Customer Experience | `aigent-c` | orchestration role (no LLM runtime binding today) |
| Governance | `metame-guardian` | constitutional role (`sovereignAgentRoles` runtimeRoleId) |

Display names resolve through the canonical AigentQube profiles
(`getAigentQubeSource`) with documented fallbacks for the ids the profile map does not
carry (`aigent-z`, `aigent-c`, `metame-guardian`) — never invented.

## What COMPOSES (mounted components) vs what LINKS

**Composes (mounted inside the workspace):**

- **Collaborate → Invitations:** `StewardParticipationTab` mounted with the new optional
  `initialDomain="venture-lab"` prop (upstream extension, default `'passport'` preserved).
  The `venture-lab` access domain, its roles, and the invite→auto-peer-channel mechanics
  already existed in `services/passport/participationAccess.ts` — zero new invitation
  machinery, one system.
- **Collaborate → Peer Exchange:** `QubeTalkInboxTab` mounted with the new optional
  `domainFilter="venture-lab"` prop (upstream extension generalising the existing
  `researchOnly` filter; same store, a filter — not a second inbox).
- **Collaborate → Locker:** `LockerTab` mounted as-is (locker items are holder-scoped,
  not partner-scoped — the canonical unfiltered locker is the honest mount).
- **Operate → Constitutional Agreements:** live list from
  `GET /api/constitutional/agreement` (CRP-003a), via `personaFetch`.

**Links (deep links via `buildCodexUrl`, never a fork):**

- Overview → Portfolio Operating Brief (`alpha-knyt`/`portfolio`), Programme Dashboard
  (`alpha-knyt`/`alpha-programme`)
- Operate → Financial Services Suite (`alpha-knyt`/`financial-services`), AgentiQ OS α
  (`alpha-knyt`/`agentiq-os-vl`)
- Evidence → Governance Receipts (`agentiq-os-cartridge`/`governance-receipts`),
  myLedger (`metame`/`my-ledger`)
- Communicate → Relationship Builder (`alpha-knyt`/`relationship-builder`), Marketa
  (`marketa`)

A parity canary asserts every descriptor targets a real, enabled codex tab.

## Pilot Command Center — honesty contract

Fields: Pilot Health · Current Phase · Next Milestone · Owner · Partner · Open Actions ·
Technical Blockers · Last Sync. Rule enforced by canary: a metric is a real derivation
from an existing API or an explicit **"Not yet wired"** state — never a fabricated number
or hardcoded health glyph.

**Derived today:** Current Phase + Partner + Owner (registry); **Open Actions** = open
constitutional agreements (`proposed`/`accepted`, not yet `authorized`) from the live
CRP-003a agreement route.

**Honestly not wired yet (rendered as such):**

- Pilot Health, Next Milestone, Technical Blockers, Last Sync — no existing API carries
  these for a partner pilot.
- Partner-scoped evidence: receipts are not tagged to a partner workspace, so Evidence
  links to the canonical receipt surfaces instead of pretending to filter.
- Partner contacts: no verified contact record has a home in the registry yet
  (`contacts` stays optional/absent — the Relationship Builder remains the contact
  surface of record).
- Peer channels only carry `originDomain='venture-lab'` when opened via a venture-lab
  invitation with the auto-channel flag; manually-opened channels have no domain tag and
  appear in the unfiltered Locker inbox, not the filtered venture view.

## Files

- `services/venture/partnerWorkspace.ts` — NEW: the registry (single source)
- `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` — NEW: the surface
- `app/triad/components/codex/TabRenderer.tsx` — register `PartnerProgrammesTab`
- `data/codex-configs.ts` — `partner-programmes` tab on `VENTURE_LAB_CODEX` (adminOnly)
- `app/triad/components/codex/tabs/StewardParticipationTab.tsx` — optional `initialDomain`
- `components/composer/QubeTalkInboxTab.tsx` — optional `domainFilter`
- `tests/partner-workspace.test.ts` — NEW: canaries (single source, id vocabulary,
  canonical spellings, adminOnly, command-center honesty, transport/link discipline,
  deep-link parity)
