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

---

# Addendum (2026-07-29) — partner rulings from John Camardo (CTO), differentiator statement, outstanding questions, contacts

Three questions this brief and the 2026-07-28 Slice B build had left open are now closed by rulings
from Horizen's own primary technical contact. Recorded here as an addendum rather than a rewrite of
the original brief above, which stays as the record of what was known on 2026-07-26.

## The differentiator, stated plainly

> Horizen proves the PnL. metaMe proves who authorized the agent, under what delegation, and
> records the consequential action through DVN receipts.

This is the sentence to lead with when demonstrating the pilot to Horizen — it is also carried
verbatim in the Evidence surface of the Partner Workspace UI (`PartnerProgrammesTab.tsx`,
`EvidenceChainPanel`).

## Outstanding questions — status

| Question | Status |
|---|---|
| Is ERC-8004 identity cross-network (the Mainnet/Sepolia divergence in the brief's own PnL worked example)? | **RESOLVED.** Sample ambiguity in the worked example, not confirmed intended behavior. ERC-8004 identity on this pilot is primarily **Base-native** — Base Sepolia is the test environment, Base Mainnet is production. `registryProfileNetwork`, `erc8004IdentityChain` and `proofChain` stay three separate fields defensively (unchanged from ruling §2), but no cross-network identity architecture is a pilot requirement. See `services/horizen/evidence.ts`. |
| Are the Registry, Pulse, REST, MCP and Verifiable PnL interfaces stable for this phase, or should the integration build in version negotiation? | **RESOLVED.** Treat the current interfaces as static for this phase. Keep strict schema validation, safe parsing and malformed-response refusal (already the discipline in `services/horizen/client.ts` and `identity.ts`) — no speculative version-negotiation or migration machinery. |
| Is REST polling the confirmed synchronization approach, or is direct event indexing required for the pilot? | **RESOLVED.** REST polling is confirmed for the first release (already the posture in `services/horizen/client.ts`'s `MIN_POLL_INTERVAL_MS`). Direct Transfer-event indexing is a noted production evolution (`services/horizen/agentBinding.ts`) — not a pilot requirement, and the pilot is not blocked on it. |

**Genuinely still open — scheduling and execution only:**

- The first Base Sepolia test date.
- The agreed Base Mainnet reference agent for the later-phase bar.

Everything else this brief or the Slice B build (2026-07-28) had flagged as an open interface,
synchronization, or cross-network question is now closed by the rulings above.

## Contacts

The pilot's two Horizen-side points of contact, deliberately kept as fluid prose rather than a
formal escalation matrix (the operator's own instruction, and the same discipline the 2026-07-26
brief above already applied to "Partner contacts stay optional/absent until verified contact data
has a real home" — now superseded for these two names specifically, which are operator-verified and
already recorded as data in `services/horizen/evidence.ts`'s `HORIZEN_PARTNERSHIP.contacts`):

- **John Camardo** — CTO, primary technical contact. Registry, Pulse, Verifiable PnL, architecture,
  integration, infrastructure, and the partner rulings recorded in this addendum.
- **Luca Cermelli** — Operations Lead, first operational contact. Pilot activities, delivery
  cadence, scheduling and follow-through; escalates to John where appropriate.

This does not add a new registry `contacts` data structure — the Relationship Builder remains the
contact surface of record for the Partner Workspace's own `PartnerWorkspace.contacts` field, and the
two names above live as prose here and in the Partner Workspace UI copy, plus as the existing
`HORIZEN_PARTNERSHIP.contacts` structure that already backs pilot evidence records.

## Base Sepolia acceptance criteria — definition of pilot-complete

1. One ERC-8004 agent is registered or identified on Base Sepolia.
2. Its Agent Card is resolvable.
3. A Verifiable PnL proof is produced.
4. The proof is retrieved through the Horizen interface.
5. The proof is correlated to the correct Base Sepolia token ID and network.
6. metaMe records the proof as constitutional evidence.
7. A DVN receipt records the consequential ingestion or action.
8. The operator-agent binding and active delegation can be resolved.
9. The attributable chain is visible in the Partner Workspace.
10. Repeated retrieval produces the same normalized result.
11. No Mainnet/Sepolia identity collision is accepted.
12. Malformed, mismatched, replayed, or duplicate proof records fail safely.

Checkable in code today: 2 (`services/horizen/agentCard.ts`), 3–5 (`services/horizen/correlate.ts`,
`evidence.ts`), 6 (`evidence.ts`), 8 (`services/horizen/agentBinding.ts`), 9
(`PartnerProgrammesTab.tsx`'s `EvidenceChainPanel`), 10 (`buildHorizenEvidence` is pure/deterministic,
asserted in `tests/horizen-integration.test.ts`), 11 (`services/horizen/identity.ts`'s
network-first keying, asserted in `tests/horizen-agent-binding.test.ts`), 12 (`client.ts`'s shape/
not-ready/http/transport failure taxonomy plus the binding resolution's ownership-freshness gate).
Item 1 and item 7 are checkable only against a live Base Sepolia read and a live DVN submission
respectively — the code paths exist (`HORIZEN_EVIDENCE_ACTION_TYPE` is declared on
`ANCHORABLE_ACTION_TYPES`) but pilot-complete status for those two depends on an actual scheduled
test run, which is one of the two genuinely open items above.

## Mainnet acceptance criteria — later-phase bar, not built now

1. One ERC-8004 agent registered on Base Mainnet.
2. The agent claimed by its primary operator.
3. The operator holding or claiming a Polity Passport.
4. A valid bounded delegation authorizing the agent.
5. One real Verifiable PnL proof produced.
6. Horizen validating and recording that proof.
7. metaMe ingesting the proof and generating the corresponding DVN receipt.
8. Attribution resolving to agent, operator, passport, delegation, network, chain ID, and token ID.
9. The evidence appearing in the Partner Workspace without exposing raw private identifiers.
10. Strict separation of Mainnet and Sepolia records.
11. Replay and duplicate protection.
12. The full flow completing without manual database correction.

None of these are built or required for the pilot today — recorded here as the definition of the
later-phase bar, per the same partner ruling.

## Scope discipline — explicitly later phases, not pilot blockers

Full Marketa vetting workflow; full MoneyPenny orchestration; Standing accrual; Pulse automation;
direct event indexing; Proof-of-Reserves; cross-chain settlement; multi-agent composition. None of
these gate the Base Sepolia pilot.

## Backlog (operator-queued 2026-07-27)

- **Daily Chief-of-Staff wakeup — Aigent Z's morning report.** A Routine/automation
  increment: Aigent Z (workspace owner/orchestrator) produces a daily morning report over
  the Partner Workspace — pilot state, open actions, agreement movements, communication
  since last sync — delivered on a schedule rather than on-demand. Deliberately NOT in the
  composition pass: it should land after the workspace surface is live so there is real
  state to report on. The natural next charter for this workstream once the surface is
  deployed and exercised. (Operator: "Make sure we don't lose this.")
