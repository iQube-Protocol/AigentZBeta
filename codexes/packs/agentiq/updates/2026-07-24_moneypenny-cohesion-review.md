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

**Gap, not yet built.** MoneyPenny has no Companion-specific integration today. She's reachable indirectly — the Capability Graph search source in `services/companion/searchFederation.ts` could in principle surface her registered capability (once/if `cap-moneypenny-financial-services` is registered — it's one of the four capabilities queued in `scripts/register-ccb-capabilities.ts`, not yet run) — but there is no MoneyPenny-specific Companion affordance (no MoneyPenny quick-action, no MoneyPenny-aware Overlay content). This is a real, open gap if Companion↔MoneyPenny cohesion is wanted.

## Shared runtime

MoneyPenny's Constitutional Capability Brief (CFS-049 format) is written (`2026-07-24_ccb-moneypenny-runtime.md`) and queued for registration into the Capability Registry via the same script mentioned above — not yet run by the operator. Once it is, MoneyPenny's runtime becomes a discoverable, receipted, standing-bearing capability like any other, and (per today's mySoftware Phase 2 work) will show up in the registering persona's own mySoftware tab.

## Navigation / deep linking

MoneyPenny's own cartridge now has real intra-cartridge navigation (the four-domain regroup, `codex:navigate-tab`-compatible — same mechanism just fixed for the Companion side panel today). There is no MoneyPenny-specific cross-cartridge deep-linking beyond what `buildCodexUrl()` already provides generically (e.g. a Venture Lab card linking into `financial-services`).

## Remaining gaps (honest list)

1. **Live verification owed**: Venture Lab Phase 1 regroup, MoneyPenny Phase 2 regroup, wallet-agent sync currency — none re-checked live this review.
2. **Companion↔MoneyPenny integration** — does not exist yet.
3. **CCB registration** — script written, not yet run by the operator (blocks MoneyPenny's capability from being discoverable/receipted as "hers").
4. **Domains 1/2 (money-moving) remain shadow-only** — a deliberate, unresolved pause point, not a bug. Any move past it needs its own explicit go-ahead and ceremony review, same discipline as SPEC-MMC-002 Phase 3's Deploy/Run actions.
5. **No test-suite/typecheck run** across the MoneyPenny increments this session (consistent with this sandbox's pre-existing `npm install` limitation, noted throughout today's other work) — this review is a documentation-level checkpoint, not a QA pass.

## Outstanding implementation tasks

- Run the CCB registration script (operator, blocked on migration + personaId, both now provided).
- Live-verify the two nav regroups (Venture Lab, MoneyPenny) on dev.
- Decide whether to build Companion↔MoneyPenny integration, and if so scope it (likely: a Companion Search source, an Overlay content type, or both).
- Any decision to progress Domains 1/2 toward authoritative needs its own explicit operator-authorized ceremony design — not assumed by this review.
