# MoneyPenny Handoff Specs — Import and Crosswalk (2026-09-02)

**Status:** Import complete. Crosswalk complete. No lettered A/B/C spec document was found to
crosswalk against — reported precisely below rather than fabricated.

---

## 0. What was asked, and what direct investigation found

The operator asked to import "the three complete handoff specs" into `docs/specs/moneypenny/`,
preserve the existing SPEC-MPY-002 ledger, and add a crosswalk to their A/B/C requirements —
explicitly: "do not substitute one specification for the others."

A background research pass cloned and searched all three `iQube-Protocol` repos whose names match
"MoneyPenny" — `moneypenny`, `moneypenny001`, `MoneyPenny002` — for anything titled or shaped like a
"handoff spec": file names, full-text content grep for "handoff"/"SPEC-*", A/B/C-lettered
requirement patterns, complete git log across all three repos' history, and GitHub issue/PR search.
**No document literally titled or structured as a "handoff spec" exists in any of the three repos.**
No commit or tag anywhere is titled "handoff." No A/B/C-lettered requirement numbering appears
anywhere in any of the three repos — that pattern (and the specific "A2/B1/C1/C2/C-04–C-06" labels
referenced in this session's own prior turns) is this session's own ad-hoc commit-message/code-
comment shorthand, established while implementing QRP-BRIDGE-ADMIN, not something these three donor
repos define.

**What DOES exist, and what was imported instead** — the closest real, substantive documents each
repo actually contains, kept as four separate, unmodified files (never merged into one, per "do not
substitute one specification for the others"):

| Repo | Real document(s) found | Imported as |
|---|---|---|
| `iQube-Protocol/moneypenny` (earliest prototype, 2025-11-11 — an Astro + Netlify Functions app with separate Node/Python microservices, buried inside a grab-bag of unrelated LiquidMetal/Raindrop demos) | `netlify-raindrop-demo/MONEYPENNY_SETUP.md`, `DEPLOYMENT.md`, `TESTING.md` — three operational setup/architecture/testing guides, no lettered requirements | `docs/specs/moneypenny/01-moneypenny-v1-setup.md`, `02-moneypenny-v1-deployment.md`, `03-moneypenny-v1-testing.md` |
| `iQube-Protocol/moneypenny001` (second iteration, 2025-11-15, Lovable-scaffolded Vite/React/Supabase) | `src/lib/aigent/README.md` — "AgentiQ Thin Client Architecture," a phased (Phase 1 done / Phase 2 wallet adapters / Phase 3 modules) roadmap for a class-based `AgentiQClient` base with a `MoneyPennyClient` subclass | `docs/specs/moneypenny/04-moneypenny001-agentiq-thin-client-architecture.md` |
| `iQube-Protocol/MoneyPenny002` (third iteration, 2025-11-20 — the repo SPEC-MPY-002 already treats as its donor) | No architecture/spec document of its own — same file layout as moneypenny001, but only a boilerplate Lovable `README.md` | **Not imported as a new file** — its real specification already exists in this repo, code-derived rather than doc-derived: `codexes/packs/agentiq/updates/2026-09-02_mpy2-0b-moneypenny002-real-source-audit.md` (referenced, not duplicated, since duplicating a boilerplate README would add nothing and a second copy of the real audit would violate "one authoritative location per concern"). |

All four imported files carry a provenance header naming their exact source repo/path and stating
they are unmodified. `docs/specs/moneypenny/` did not exist before this pass and was created for it.

## 1. SPEC-MPY-002 ledger — preserved, untouched

`codexes/packs/agentiq/updates/2026-09-01_spec-moneypenny-cartridge-capability-harvest-upgrade.md`
is **not modified** by this pass. Its §15 numbered acceptance criteria (1–20) remain the canonical
ledger for the CURRENT MoneyPenny cartridge build. Nothing in this crosswalk changes its content or
its status.

## 2. Crosswalk — three donor repos vs. SPEC-MPY-002 vs. this session's A2/B1/C-labels

None of the three donor repos defines the A2/B1/C1/C2/C-04–C-06 labels this session's own prior
turns used — those labels describe CURRENT AigentZBeta implementation work (QRP-BRIDGE-ADMIN, MPY2-2c),
not anything the donor repos specify. The crosswalk below is therefore a **capability lineage**, not
a requirement-to-requirement mapping — tracing where a SPEC-MPY-002 capability's THINKING originated,
never claiming the donor repos impose obligations SPEC-MPY-002 doesn't already state itself.

| SPEC-MPY-002 §15 criterion (paraphrased) | Donor lineage | This session's label (if any) |
|---|---|---|
| Financial Profile derives bounded risk/trading envelope, never authority (§15.7) | `moneypenny`'s `banking-profile` service (real doc: `03-moneypenny-v1-testing.md`'s wizard flow) and `moneypenny001`'s Phase 3 `Aggregates`/`Memories` modules (`04-...-architecture.md`) — both real precedents for "derive figures from a profile," neither a lettered requirement | Implemented via `riskEnvelope.ts` (unrelated to donor code — audited separately in MPY2-0b and confirmed NOT reused from any donor, per that audit's own §1 finding that `aggregates.ts` has no real formulas) |
| Manual/no-statement profile preparation | No donor repo has this — all three assume a document/statement upload path (moneypenny's banking-profile wizard, moneypenny001/002's `ProfileOverlay.tsx` PDF-only) | MPY2-2c (this session, prior turn) — genuinely new, not donor-derived |
| Multi-chain quote/execution console | `moneypenny`'s `DEPLOYMENT.md` gas-oracle + multi-chain SSE stream architecture (real, cited) is the closest real lineage for `HFTConsole.tsx`'s shape (chain-quote arbitrage), though `HFTConsole.tsx`'s data is confirmed simulated (per the 2026-09-02 audit's own §3 correction) | `HFTConsole.tsx`, unrelated code, simulated per `SimulationNotice` |
| Thin-client / adapter architecture for wallet, quotes, oracles | `moneypenny001`'s `AgentiQClient`/`MoneyPennyClient` phased roadmap (`04-...-architecture.md`) is the clearest real precedent for a modular capability-adapter shape | Not directly adopted in AigentZBeta's MoneyPenny cartridge (which uses `moneypennyCapabilities.ts`'s panel-key registry instead) — flagged as a real architectural alternative worth a future look, not claimed as already-implemented |

**Explicitly NOT crosswalked**: OCR ingestion, real backtest engine, real arbitrage/opportunity
service, real execution/receipt evidence — none of the three donor repos closes these gaps either
(same conclusion the 2026-09-01/09-02 donor audits already reached for MoneyPenny002 specifically;
`moneypenny`/`moneypenny001` were not previously audited for these gaps and, per this pass's direct
reading, also do not close them — `moneypenny`'s gas-oracle is a real price feed shape but for gas,
not asset backtesting; `moneypenny001` has no backtest/execution code, only the architecture README).

## 3. What this import does NOT claim

- It does not claim these three repos are authoritative requirements documents — none of them uses
  requirement language, acceptance criteria, or A/B/C lettering. They are prototypes and their own
  operational docs, imported as historical/architectural reference material.
- It does not substitute any one repo's content for another's — each stays a separate file, clearly
  attributed to its own repo, never merged or paraphrased into a composite.
- It does not modify SPEC-MPY-002 or claim any new criterion is satisfied by virtue of this import.
