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

### Companion Overlay — BUILT (operator go-ahead 2026-07-24, "Yes to mp overlay")

The investigation above stands as the correct record of *why* this was
architectural rather than an allowlist tweak. The operator then explicitly
approved building exactly the thing it scoped: a capability-matching field on
the banking shape. That is now shipped.

**The matching rule.** Deliberately dumb, explicit, and auditable — the same
philosophy `overlayMapping.ts`'s own header ratifies for domains, applied one
level further along rather than fought:

```ts
// services/companion/overlayMapping.ts — PURE, no I/O
export const SHAPE_CAPABILITY_IDS: Record<OverlayShape, readonly string[]> = {
  'github-repo': [],
  banking: ['cap-moneypenny-financial-services', 'financial-services-capability-suite'],
};
export function capabilityIdsForShape(shape: OverlayShape): readonly string[]
```

`composeBankingCard()` takes that declared id list and keeps only the ids
that are **actually registered** in the Constitutional Capability Registry
and **not deprecated**. No semantic classifier, no free-text query, no
inference over arbitrary apps — the "arbitrary-app classifier" non-goal the
mapping file rules out is respected, not quietly reintroduced.

Three deliberate choices worth recording:

- **`github-repo` is declared-but-empty, not omitted.** That shape already
  carries a capability signal via `recommendProducers('software',
  'operational')`, which reads the *closed `CapabilityId` producer graph* — a
  different system. Mixing CCB registry ids into the same card would put two
  unrelated capability notions side by side. Declaring it empty (rather than
  making the table `Partial<>`) keeps it exhaustive over `OverlayShape`, so
  adding a third shape is a compile error, not a silent gap.
- **Registry-wide matches, not caller-owned ones.** Overlay answers "what
  constitutional capability is relevant to what I'm looking at" — not "what
  did I register". The persona-scoped ownership re-derivation in
  `/api/constitutional/capability-registry/mine` answers the *other*
  question and stays the right tool for it. Note this does **not** weaken the
  sibling admin route's gate: that gate protects *enumeration* of the whole
  constitutional ledger, and this path never enumerates — the hand-declared id
  list is the filter, so nothing outside it can ever reach a response.
- **The id list is not a duplicate of `scripts/register-ccb-capabilities.ts`.**
  It's a relevance selection, and the runtime authority on whether an id
  exists is the registry itself, which the filter queries. If the script's ids
  ever changed, this table would match nothing and the section would vanish —
  honest degradation, not stale data. Deriving the list from a one-shot
  registration script would be the wrong direction of dependency.

**The new type** (`services/companion/overlayComposition.ts`), optional so
every existing consumer of `BankingOverlayCard` keeps working untouched:

```ts
export interface OverlayCapabilityMatch {
  capabilityId: string;
  displayLabel: string;
  description: string | null;
  standingBand: string;
  briefUrl: string | null;   // repo path OR http(s) URL — UI handles both
}
// on BankingOverlayCard:
matchedCapabilities?: OverlayCapabilityMatch[];
```

T2-safe by construction: every field is a capability fact from
`capability_registry`, a table that carries no identity column at all (CFS-032
T2 discipline). No `personaId` enters or leaves this path.

**What renders.** *Registry populated* → a "Constitutional capabilities"
section on the banking card, in the canonical slate house style
(`border-slate-800` / `bg-slate-900/40`, no white hairlines, no solid white
buttons) matching the card's existing sections: capability label + standing
band chip, a short description, and the CCB brief — rendered as a link when
`briefUrl` is an http(s) URL and as plain monospace text when it's a repo
path, mirroring `MySoftwareTab`'s handling of the same
path-or-URL ambiguity rather than forking a second convention. *Registry
empty, migration `20260716000000` unapplied, Supabase unavailable, or none of
the declared ids registered yet* → the section is omitted entirely and the
banking card looks exactly as it does today. Never an error, never a
placeholder, never a fabricated entry — `listRegisteredCapabilities()` is
itself soft-fail (returns `[]`), and the composition wraps it in its own
try/catch that warns and degrades, the same discipline as
`searchFederation`'s per-source `guard()`.

**Practical consequence for MoneyPenny:** once the operator runs
`scripts/register-ccb-capabilities.ts`, a citizen on any banking-shaped page
(`metame.com`, `dev-beta.aigentz.me`, `coinbase.com`, …) sees *MoneyPenny
Constitutional Runtime* surfaced as a relevant constitutional capability with
her standing band and a pointer to her CCB. Before that script runs, nothing
appears — which is the honest state, not a bug.

**Not touched, deliberately:** `types/capabilityGraph.ts`'s closed
`CapabilityId` enum and `services/capability/capabilityGraph.ts`'s
`recommendProducers` — the investigation above established they belong to a
different system, and this is a new, separate read path against the CCB
registry, not a bend of the producer-recommendation one. No DB migration, no
new table.

## Shared runtime

MoneyPenny's Constitutional Capability Brief (CFS-049 format) is written (`2026-07-24_ccb-moneypenny-runtime.md`) and queued for registration into the Capability Registry via the same script mentioned above — not yet run by the operator. Once it is, MoneyPenny's runtime becomes a discoverable, receipted, standing-bearing capability like any other, and (per today's mySoftware Phase 2 work) will show up in the registering persona's own mySoftware tab.

## Navigation / deep linking

MoneyPenny's own cartridge now has real intra-cartridge navigation (the four-domain regroup, `codex:navigate-tab`-compatible — same mechanism just fixed for the Companion side panel today). There is no MoneyPenny-specific cross-cartridge deep-linking beyond what `buildCodexUrl()` already provides generically (e.g. a Venture Lab card linking into `financial-services`).

**Closed 2026-07-25 — the Overlay capability rows are now the way IN.** Operator, on seeing the rows render for the first time: *"I now see the capability but what can be done with them?"* A registered capability with no route to its operating surface is a label, not an affordance. `CAPABILITY_ROUTES` (`services/companion/overlayMapping.ts`) maps each matched capability to `{ slug, tab, label }`; the panel renders an "Open Financial Services →" deep link built with `buildCodexUrl`, attaching the persona at render time exactly as `CompanionSearchPanel` already does.

Both financial capabilities route to the SAME surface — Venture Lab α → Financial Services — because MoneyPenny's runtime *drives* that pipeline; it is the agent mode, not a second console. This is a deep link, deliberately **not** a second operating surface inside the ~400px panel: forking a money-moving surface is the worst possible place for two implementations to drift (`inv.engineering.037`). A capability with no declared route renders exactly as before, unlinked — never an invented route.

The table is a hand-declared projection of two sources of truth (registry ids, codex/tab slugs), so it carries a parity canary — `tests/companion-observer.test.ts` asserts every route resolves to a real, **enabled** tab and that no identifier is baked into the static constant. Indexed in `tests/source-of-truth-parity.test.ts`'s canary register.

**Both deep links 404'd on first live click ("Codex not found") — found and fixed 2026-07-25.** The route table's `slug` field was set to `'venture-lab'` (`VENTURE_LAB_CODEX.slug`). The embed route (`app/(embed)/triad/embed/codex/[codexSlug]/page.tsx`) and its backing API (`app/api/codex/registry/[codexId]/route.ts`) both resolve by appending `-codex` to the URL segment unless it already carries a known suffix, then matching `getCodexById(...) ?? getCodexBySlug(...)`. `'venture-lab' + '-codex'` = `'venture-lab-codex'`, which matches neither `VENTURE_LAB_CODEX`'s real id (`'alpha-knyt-codex'`, kept for historical reasons) nor its slug (`'venture-lab'`, no suffix) — so both lookups failed. `MONEYPENNY_CARTRIDGE` (`id: 'moneypenny-codex'`, `slug: 'moneypenny'`) happened to make slug+suffix equal id, which is why that existing deep-link pattern (`searchFederation.ts`'s MoneyPenny search source) worked and masked the assumption.

The original parity canary passed anyway, because it asserted `route.slug === CodexConfig.slug` — internally consistent with the same wrong value, so it gave false confidence. **Fix, in both the code and the test:** `CAPABILITY_ROUTES.slug` now holds the codex's real `.id` (`'alpha-knyt-codex'`), which survives the embed route's suffix logic unchanged; the canary was rewritten to mirror the ACTUAL resolution function (suffix-append + legacy-alias lookup, matched against `.id`) instead of asserting a field it happened to already agree with. Live-verified: both "Open Financial Services" buttons now land on Venture Lab α's Financial Services tab.

## Remaining gaps (honest list)

1. **Live verification owed**: Venture Lab Phase 1 regroup, MoneyPenny Phase 2 regroup, wallet-agent sync currency — none re-checked live this review.
2. ~~**Companion↔MoneyPenny integration** — does not exist yet.~~ **Closed 2026-07-24 (Companion Search half)**: `searchMoneyPenny` ships as the 7th federated source. ~~**Investigated, not built (Overlay half)**: Overlay's domain→shape mechanism is not generic and does not gain MoneyPenny visibility from CCB registration alone — see "Companion integration" above for the full finding. A MoneyPenny-aware Overlay shape remains a real, scoped-but-unbuilt option if wanted.~~ **Closed 2026-07-24 (Overlay half) on operator go-ahead**: the banking shape now carries `matchedCapabilities`, filled by an explicit shape→capability-id table filtered against the live Capability Registry. Surfaces once the CCB registration script is run; degrades to nothing before then. See "Companion Overlay — BUILT" above.
3. ~~**CCB registration** — script written, not yet run by the operator~~ **CLOSED 2026-07-25.** The operator ran `scripts/register-ccb-capabilities.ts` against the live database; all four capabilities returned `ALREADY REGISTERED` with real refs (`metame-companion` 4896894c714a22a0, `financial-services-capability-suite` 0ef8018d9c08111a, `cap-moneypenny-financial-services` acc23c21ea2b1305, `constitutional-video-audio-pipeline` fe6e6fd9065bbf47). The Overlay capability section was then **live-verified on dev-beta**: the banking card renders MoneyPenny Constitutional Runtime + Financial Services Capability Suite with their brief refs. Original text follows for the record: script written, not yet run by the operator (blocks MoneyPenny's capability from being discoverable/receipted as "hers" in the Capability Registry / mySoftware). Since the Overlay build landed, this script is now ALSO what makes her appear in the Companion Overlay's banking card — the matching path is live, the registry row is what's missing.
4. **Domains 1/2 (money-moving) remain shadow-only** — a deliberate, unresolved pause point, not a bug. Any move past it needs its own explicit go-ahead and ceremony review, same discipline as SPEC-MMC-002 Phase 3's Deploy/Run actions.
5. **No test-suite/typecheck run** across the MoneyPenny increments this session (consistent with this sandbox's pre-existing `npm install` limitation, noted throughout today's other work) — this review is a documentation-level checkpoint, not a QA pass. The new `searchMoneyPenny` source was verified by hand-simulating its match logic against the real `MONEYPENNY_CARTRIDGE.tabs` data (see the follow-up implementation commit), not by a live test run.

## Companion Observer defect found during live verification (2026-07-25)

Live-verifying the Overlay surfaced a real, pre-existing bug worth recording because it will recur for anyone testing the extension.

**Symptom (operator):** *"this overlay, generally speaking, is a bit intermittent, and the refresh button does not seem to work."* The Overlay showed `venice.ai` while the operator was looking at `github.com` and at `dev-beta.aigentz.me` — both of which DO map to a shape.

**Root cause:** Manifest V3 does not inject `content_scripts` into already-open tabs when an extension is installed, updated, or reloaded — injection happens on navigation only. Every tab open at `chrome://extensions` reload time therefore loses its observer permanently. No content script means neither the page-load observation nor `content.js`'s `visibilitychange` re-observation fires, so switching to such a tab writes nothing and `/api/companion/overlay` (which reads `loadLatestObservation` — one row per persona) keeps serving whichever tab still HAD a live script. Refresh correctly re-read that same unchanged row, which reads as a dead button.

**Fix:** `background.js` now heals on `chrome.runtime.onInstalled` + `onStartup` — injecting the same two files the manifest already declares into open http(s) tabs, guarded by a `window.__metameObserverLoaded` probe so a live observer is never double-injected. Not a privilege expansion: it injects exactly what Chrome would have injected on the next navigation, only sooner, and is deliberately unrelated to the `isCompanionAppUrl` guard (which governs reading auth material OUT of a page — a different act).

**Cost governor, on the operator's own question ("unless this has an undesirable cost elsewhere?"):** once re-observation is reliable on every tab focus, the naive path costs a grant-refresh round-trip plus an observation write per tab flick. Three bounds now apply in `content.js`: a 400ms trailing debounce (rapid A→B→A collapses to one), a 15s grant-refresh throttle (chosen against what the refresh is FOR — catching a just-granted capability, a deliberate human action well over 15s of wall-clock), and identical-payload suppression keyed on everything except `observedAt`. Switching away and back with nothing changed now costs zero requests; a genuinely different page always sends. No grant check was weakened — every field still passes the same live `checkGrant()`, and the server still re-validates.

## Outstanding implementation tasks

- ~~Run the CCB registration script (operator, blocked on migration + personaId, both now provided).~~ **Done 2026-07-25** — see gap 3.
- ~~Live-verify the Overlay capability section on dev after running the CCB registration script.~~ **Done 2026-07-25** — banking card verified rendering both capabilities.
- Reload the extension once after the observer-healing fix deploys — the fix cannot heal the very reload that installs it.
- Live-verify the two nav regroups (Venture Lab, MoneyPenny) on dev.
- ~~Decide whether to build Companion↔MoneyPenny integration, and if so scope it~~ — **decided 2026-07-24**: Search source shipped; Overlay content initially deferred (no narrow gap found; required a new capability field on the banking shape), then **built the same day on explicit operator go-ahead** ("Yes to mp overlay"). Both halves of Companion↔MoneyPenny integration now exist.
- Live-verify the Overlay capability section on dev **after** running the CCB registration script — until that script runs there is deliberately nothing to see, so an empty section is not evidence of a defect.
- Any decision to progress Domains 1/2 toward authoritative needs its own explicit operator-authorized ceremony design — not assumed by this review.
