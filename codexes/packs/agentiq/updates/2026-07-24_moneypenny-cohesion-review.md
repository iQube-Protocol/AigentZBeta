# MoneyPenny Cohesion Review — Strand 4B

**Status: checkpoint, not a new spec.** Requested by the operator as part of the four-strand programme (Strand 4-B), to confirm the last several weeks of MoneyPenny work has actually converged before further development. Compiled from direct session history, not re-derived from a fresh codebase audit — flagged below wherever something should be independently verified rather than taken as confirmed.

## Runtime architecture

MoneyPenny's Constitutional Financial Services Agent Runtime shipped in six increments (P3-1 through P4-6):
- **P3-1–P3-4**: Advisor + Architect grounding — MoneyPenny reasons over the built Financial Services service pipeline before acting.
- **P4-1**: Runtime shadow-only driving agent — observes/proposes, does not act.
- **P4-2**: Agreement lifecycle + authority-boundary canary — the Constitutional Agreement primitive (form → accept → **human authorizes**) gates every domain flip.
- **P4-3**: First authoritative flip — **Domain 3 (Financial Intelligence) only**. Investment/Market domains remain shadow-only, gated additionally by a World-ID-verified Polity Passport per the runtime's own design.
- **P4-4**: Standing accrual + settlement receipt + a dedicated DVN action type — Domain 3 actions are now receipted and DVN-anchorable.
- **P4-5/P4-6**: Money-moving gate + real flip — **explicitly logged as a PAUSE POINT** (task #141). This was a deliberate stop, not an oversight: Domains 1/2 (Investment/Market — the money-moving domains) have NOT been flipped to authoritative. **This gate should not be crossed without an explicit operator go-ahead** — it sits directly under D1 (CFS-016, code execution stays human) and the DVN Pipeline Protection paramount rules.

**Verify independently**: whether the Domain 3 authoritative flip is still live and healthy on dev — this review did not re-run it.

## Cartridge

MoneyPenny had a single collapsed auto-generated tab (the `singleTabMode` fallback any cartridge with ≤1 tab hits) until today's Phase 2 work: a hand-curated `MONEYPENNY_CARTRIDGE` codex now groups her 10 existing panels (HFT Console, Chat, Portfolio, Strategies, x402, Identity/FIO, SmartTriad, CRM, Architect, Runtime) into four domains — **Operate** (HFT, Portfolio, Strategies, SmartTriad), **Connect** (Chat, CRM), **Service** (x402, Architect, Runtime), **Administer** (Identity). Pushed (commit `d9fcbcd0`). **Not yet verified live on dev** — this and Venture Lab's own Phase 1 regroup are the two pieces of navigation work from today still awaiting a live check.

The original standalone `/moneypenny` route (`MoneyPennyCartridge.tsx`) is untouched and still serves its own flat ten-tab interface independently — the two surfaces now share panel components via `MoneyPennyShell` + `MoneyPennyPanelTab`, not code.

## Venture Lab integration

The Financial Services Capability Suite (CRP-003a) — the platform's first full Constitutional Capability Domain, a 12-step service pipeline running shadow/authoritative per-domain — is mounted as Venture Lab's `financial-services` tab, which today sits in the **Service** domain per SPEC-VLM-001's five-domain regroup (Operate/Connect/Service/Grow/Administer). This is the correct, ratified home for it — a citizen reaches Financial Services through Venture Lab's intent-driven nav, not a MoneyPenny-specific detour.

## Smart Wallet integration

MoneyPenny's wallet-agent sync shipped as a background increment (task #143) — the wallet is aware of MoneyPenny's agent state. **Not independently re-verified this review** — worth a live check that the sync is still current given the volume of unrelated nav work since.

## Companion integration

**Update 2026-07-24 (later same day, operator-approved close-out of this gap):**

**Companion Search — built.** `services/companion/searchFederation.ts` gained a
seventh federated source, `searchMoneyPenny(query)`, wired into
`federateSearch()`'s `Promise.all`/log line/final spread exactly like the six
existing sources. It is pure and synchronous (no new read, same "index a
known list" shape as `searchCapability`) — and, per CLAUDE.md source-of-truth
discipline, it does not hand-copy MoneyPenny's ten panel names: it iterates
`MONEYPENNY_CARTRIDGE.tabs` (`data/codex-configs.ts`) directly, so her titles,
descriptions, and tab slugs can never drift from the cartridge she actually
ships (the same import pattern already used by
`services/devCommandCenter/stageGroundData.ts` and
`services/composer/runtimeProjectionShared.ts`). Each result deep-links to
`{ slug: 'moneypenny', tab: <real tab slug> }` via the existing
`buildCodexUrl()` path in `CompanionSearchPanel.tsx`. `'moneypenny'` was added
to `CompanionSearchSource` (`types/companionSearch.ts`) and to
`SOURCE_LABEL` (`components/companion/CompanionSearchPanel.tsx`) — the same
two-spot addition the mySoftware source made hours earlier. A citizen typing
"hft", "portfolio", "strategies", "x402", or "fio" into Companion Search now
gets a MoneyPenny result deep-linking into the matching tab (hft-console,
portfolio, strategies, x402, identity respectively).

**Companion Overlay — investigated, no new code shipped (finding: not a
narrow gap; a different architecture entirely).** The hypothesis in the
original gap note above — that registering `cap-moneypenny-financial-services`
in the Capability Registry would let Overlay's "generic" mechanism surface
MoneyPenny automatically — does not hold, on direct inspection of
`services/companion/overlayMapping.ts`, `overlayComposition.ts`, and
`app/api/companion/overlay/route.ts`:

- Overlay is **not** a general capability-registry matcher. It is a small,
  explicit `domain → shape` table (`shapeForDomain()`) with exactly two
  hardcoded shapes today: `'github-repo'` and `'banking'`. A domain that
  isn't `github.com`/`*.github.com` or in the small `BANKING_DOMAINS` set
  renders the honest `"domain-unmapped"` empty state — by design, not a bug
  (the file's own header explicitly rules out an "arbitrary-app classifier").
- Even within the one shape that *does* touch the capability system
  (`'github-repo'`), the lookup is `recommendProducers('software', 'operational')`
  — a **hardcoded** capability id (`'software'`) and tier, not a live query
  against whatever capabilities happen to be registered. `recommendProducers`'s
  own signature requires a `capability: CapabilityId` chosen in advance
  (`services/capability/capabilityGraph.ts`); a free-text or domain-driven
  "find whichever capability matches" query isn't something it can answer.
- `CapabilityId` (`types/capabilityGraph.ts`) is `ArtifactProfileId |
  'deployment-execution'` — a closed enum that does not include
  `'cap-moneypenny-financial-services'` at all. That id belongs to a
  *different* registry (the Constitutional Capability Brief / CCB registry
  `scripts/register-ccb-capabilities.ts` writes to), which `capabilityGraph.ts`'s
  producer-recommendation system does not read from.
- The `'banking'` shape — the one shape whose domain set already includes the
  platform's own domains (`metame.com`, `dev-beta.aigentz.me`, so MoneyPenny's
  cartridge pages already render *a* banking card today) — does **no**
  capability lookup at all. `composeBankingCard()` only returns
  standing/identifiability/cartridgeFlags; there is no field in
  `BankingOverlayCard` for "matched capability."

**Conclusion:** there is no narrow, low-risk fix available here (e.g. adding
a domain to an allowlist) — the domains MoneyPenny would need are already in
`BANKING_DOMAINS`, so that specific gap doesn't exist. The actual gap is
architectural: the banking shape has no capability-matching field to plug
into, and the one shape that does capability-match is hardcoded to a
different capability id in a different registry. Building that would mean
adding a new field to `BankingOverlayCard` and a new capability-matching path
— a new Overlay content shape, which CLAUDE.md's Change Sizing section
("no speculative features," "no over-engineering") rules out absent an
explicit operator ask. **No Overlay code was written.** Running the CCB
registration script closes the CCB-registry-visibility gap (MoneyPenny's
runtime becomes discoverable via `/api/constitutional/capability-registry`
and mySoftware, as already noted below) — it does **not**, on its own, cause
her to appear in the Companion Overlay. If MoneyPenny-aware Overlay content
is wanted, it needs its own scoped design (a third Overlay shape or a
capability field on the banking shape) and an explicit operator go-ahead,
not an assumption that registration alone closes it.

## Shared runtime

MoneyPenny's Constitutional Capability Brief (CFS-049 format) is written (`2026-07-24_ccb-moneypenny-runtime.md`) and queued for registration into the Capability Registry via the same script mentioned above — not yet run by the operator. Once it is, MoneyPenny's runtime becomes a discoverable, receipted, standing-bearing capability like any other, and (per today's mySoftware Phase 2 work) will show up in the registering persona's own mySoftware tab.

## Navigation / deep linking

MoneyPenny's own cartridge now has real intra-cartridge navigation (the four-domain regroup, `codex:navigate-tab`-compatible — same mechanism just fixed for the Companion side panel today). There is no MoneyPenny-specific cross-cartridge deep-linking beyond what `buildCodexUrl()` already provides generically (e.g. a Venture Lab card linking into `financial-services`).

## Remaining gaps (honest list)

1. **Live verification owed**: Venture Lab Phase 1 regroup, MoneyPenny Phase 2 regroup, wallet-agent sync currency — none re-checked live this review.
2. ~~**Companion↔MoneyPenny integration** — does not exist yet.~~ **Closed 2026-07-24 (Companion Search half)**: `searchMoneyPenny` ships as the 7th federated source. **Investigated, not built (Overlay half)**: Overlay's domain→shape mechanism is not generic and does not gain MoneyPenny visibility from CCB registration alone — see "Companion integration" above for the full finding. A MoneyPenny-aware Overlay shape remains a real, scoped-but-unbuilt option if wanted.
3. **CCB registration** — script written, not yet run by the operator (blocks MoneyPenny's capability from being discoverable/receipted as "hers" in the Capability Registry / mySoftware — and, per today's Overlay investigation, registration alone still would not surface her in Overlay).
4. **Domains 1/2 (money-moving) remain shadow-only** — a deliberate, unresolved pause point, not a bug. Any move past it needs its own explicit go-ahead and ceremony review, same discipline as SPEC-MMC-002 Phase 3's Deploy/Run actions.
5. **No test-suite/typecheck run** across the MoneyPenny increments this session (consistent with this sandbox's pre-existing `npm install` limitation, noted throughout today's other work) — this review is a documentation-level checkpoint, not a QA pass. The new `searchMoneyPenny` source was verified by hand-simulating its match logic against the real `MONEYPENNY_CARTRIDGE.tabs` data (see the follow-up implementation commit), not by a live test run.

## Outstanding implementation tasks

- Run the CCB registration script (operator, blocked on migration + personaId, both now provided).
- Live-verify the two nav regroups (Venture Lab, MoneyPenny) on dev.
- ~~Decide whether to build Companion↔MoneyPenny integration, and if so scope it~~ — **decided 2026-07-24**: Search source shipped; Overlay content deliberately not built (no narrow gap found; would require a new content shape — needs its own operator go-ahead if wanted).
- Any decision to progress Domains 1/2 toward authoritative needs its own explicit operator-authorized ceremony design — not assumed by this review.
