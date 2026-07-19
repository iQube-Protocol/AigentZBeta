# PRD — SmartTriad Context-Aware Copilot (Phase 1)

**Status: `ratified` (operator, 2026-07-19). Phases 1a/1b/2 SHIPPED (incl. the 1b registry→cartridge-metadata follow-on). Phase 3 in progress: Actions slice 1, L2 corpus layer, inference-driven navigation, and constitutional memory v0 shipped 2026-07-19.**
Source: operator direction + Aletheon's architectural framing (2026-07-19).

## Objective

Transform SmartTriad from a static embedded chat into a **context-aware
constitutional copilot** whose UI, knowledge context, retrieval behaviour, and
navigation adapt dynamically to the active cartridge, the user's state, and the
constitutional context. First phase toward an **Invariant-Driven Constitutional
Copilot**.

Aletheon's separation of concerns (adopted):
1. **SmartTriad UI** — placeholder, floating launcher, deep links, rendering consistency.
2. **SmartTriad Context Engine** — what knowledge the copilot has available.
3. **SmartTriad Intelligence Layer** — invariant-driven retrieval via the IRE.

---

## 1. Dynamic contextual prompt — ✅ SHIPPED (Phase 1a)

The input placeholder was hardcoded (`"Ask about KNYT content..."`) and leaked
onto unrelated cartridges (observed on IRL OS doc tabs).

**Shipped:** `CARTRIDGE_COPILOTS` registry in `CodexPanelDynamic` — curated
placeholder/persona/copy per cartridge; every uncurated cartridge derives
`Ask about <cartridge display name>...` automatically. The layer default is now
neutral (`"Ask a question..."`). Copy authored per cartridge:
IRL OS → "Ask about IRL OS research...", metaMe IRL → "Ask about metaMe IRL
research...", Passport Bureau, Marketa, metaMe, HMS keep their curated lines.

**Follow-on shipped (2026-07-19):** the `CARTRIDGE_COPILOTS` registry was
deleted; copilot copy now lives on cartridge metadata (`codex.copilot` /
`CodexCopilotConfig` in `data/codex-configs.ts` + `types/codex.ts`) so
cartridge authors own their copy.

## 2. Floating copilot consistency — ✅ SHIPPED (Phase 1a)

The launcher was mounted by five hardcoded `codexId` blocks; IRL OS
(welcome/dashboard) and most cartridges had none, and cartridges whose TABS
self-mount specialized copilots could double-mount.

**Shipped:** one generic mount in the cartridge shell for EVERY cartridge
(config-disable available), plus the **CopilotHostContext dedupe**: tab-level
specialized floating copilots register themselves (no call-site changes across
~70 usages); the shell's generic copilot yields while one is mounted. The
specialized copilot always wins; the generic one fills every gap.

## 3. Cartridge-aware ground truth — Phase 1b (build next)

Three knowledge layers per copilot session:
- **L1 Platform Ground Truth** — constitutional principles, platform ontology,
  shared terminology, standing, passports, bounded delegation, registry concepts.
- **L2 Cartridge Ground Truth** — the active cartridge's domain corpus (IRL:
  experiments/canon/papers/glossary/lab state; Passport: lifecycle/steward
  workflows/participation/invitations; etc.).
- **L3 Observer Context** — the caller's live state: passport, standing,
  delegation, current cartridge/tab/capsule, current experiment/workflow.

Budgeting rule (operator): each copilot must keep room for BOTH platform-wide
and domain knowledge — L1 is compact-by-selection (see §5), never the full canon.

Implementation seam: the copilot layer already accepts `groundContext`; the
chat route (`/api/codex/chat/*`) composes the system context. Phase 1b wires a
`SmartTriadContext` object (below) through that seam.

## 4. Observer-aware assistance — Phase 1b

The copilot understands what the user is trying to achieve and grounds
accordingly. Example (operator's canonical case): a first-time Research Lab
joiner's copilot carries the passport application + claim + optional delegation
+ participation flow, so it can walk them through accession. Passport
application → participation/invitations/sponsorship/steward review. Founder
Office → VentureCube/operator progression/portfolio.

Shipped precursor: the IRL copilot config's quick prompts are onboarding-aware
("How do I claim my passport?", "How do I get research access?"). Full observer
grounding (reading `/api/participation/my-access`, wallet, delegation state into
L3) is the Phase 1b build.

## 5. Invariant-driven retrieval (IRE) — Phase 2

Replace manually-defined per-cartridge platform context with:

```
Intent → IRE → relevant platform invariants + relevant cartridge invariants → ground truth
```

The IRE (`resolveConstitutionalField`, already live as the p0-shadow) curates
WHICH platform invariants are relevant for the cartridge/intent — the operator's
"use the IRE to curate what platform invariants are relevant per cartridge".
Ratified content (the canonical invariant corpus) becomes the shared ground
truth, selected per interaction rather than bulk-loaded. This becomes the
default retrieval strategy once validated (ties to IRV-001 instrument
calibration — don't make the IRE load-bearing for copilot truth before its
Stage-0 validation).

## 6. Deep-link intelligence — Phase 1b/2

Copilot responses preferentially NAVIGATE rather than describe. Quick links use
the existing seams: `codex:navigate-tab` (same-cartridge) and `buildCodexUrl()`
(cross-cartridge, identity-propagating). Examples: "Claim Passport" → Passport ›
Claim; "Delegate Agent" → Passport › Delegation; "Read EXP-010" → IRL OS ›
Research; cross-cartridge → Founder Office › VentureCube.

Phase 1b: a `deepLinks` section in `SmartTriadContext` the chat route can cite;
the inference renderer already renders suggestion chips — extend them to
dispatch navigation instead of only inserting prompt text.

**Shipped (2026-07-19), two mechanisms:**
1. *Deterministic chips* (Phase 1b) — the deep-link catalog renders as a
   single-row carousel above the prompt input, always available.
2. *Inference-driven navigation* (the §6 full goal) — the smart-triad system
   prompt instructs the model to embed `[[nav:<label>]]` markers inline when
   directing the operator to a cataloged destination. `CodexCopilotLayer`
   validates each marker against the `deepLinks` catalog (verbatim label,
   case-insensitive): matched markers render as clickable `→ Label` chips
   under the reply; unknown labels degrade to plain text — never a dead chip.
   Navigation execution stays deterministic (`navigateDeepLink`): the model
   chooses WHEN to navigate, the layer controls WHERE navigation can go.

## 7. The SmartTriadContext contract — Phase 1b

```ts
interface SmartTriadContext {
  platform: { ontologyVersion: string; principles: string[] };   // L1 (IRE-curated)
  cartridge: { id: string; name: string; tab: string; corpusRefs: string[] }; // L2
  observer: {                                                     // L3 (T1-safe)
    standing?: string; passportState?: string; delegationActive?: boolean;
    participation?: { domain: string; role: string }[];
    currentIntent?: string;
  };
  deepLinks: { label: string; tab?: string; codexSlug?: string }[];
  capabilities: string[];
}
```

T-discipline: observer context is T1-safe surface only (labels/booleans/slugs —
never personaId/authProfileId), matching the spine's identifier tiers.

**Contract as shipped (2026-07-19, `types/smartTriadContext.ts`):** all PRD
fields are live — `cartridge.corpusRefs` (L2 domain-corpus surfaces, rendered
in the ground block as "answer FROM these surfaces"), `capabilities` (what the
copilot can DO on this surface), plus two fields the PRD didn't anticipate:
`operations` (Phase 3 Actions — admin-only confirm-gated chips) and
`sessionInvariants` (constitutional memory v0, below). The `platform.principles`
field was superseded by the stronger Phase-2 mechanism (IRE-resolved
`platformInvariants` injected per message).

## 8. SmartTriad as the user-facing IRE (Aletheon §9) — Phase 3 (architectural principle)

Define the embedded copilot as the **presentation layer of the IRE**, not "chat":

```
User Intent → Observer Context → Cartridge Context → IRE → Ground Truth Assembly
  → SmartTriad → Guidance → Deep Links → Actions
```

Every embedded copilot is one constitutional intelligence, specialized by
context, not by hardcoded prompts — so IRE improvements lift every cartridge's
copilot simultaneously. Future: ResearchQube/CapabilityQube retrieval,
constitutional memory, observer modelling, persona-aware + bounded-delegate
conversations, cross-cartridge orchestration.

### Phase 3 slice log

- **Slice 1 — Actions (shipped 2026-07-19):** `SmartTriadOperation` chips
  (amber, confirm-gated, `personaFetch`-executed, ALWAYS re-gated server-side;
  surfaced only when `observer.isAdmin`). First operations: backfill repo
  records, regenerate canonical report (IRL).
- **Slice 2 — Constitutional memory v0 (shipped 2026-07-19):** the chat route
  echoes the invariants that grounded each turn (`resolved_invariants`,
  T2-safe seed ids + statements); the layer accumulates them per session
  (dedupe by seedId, cap 12) and sends them back as
  `groundContext.sessionInvariants`; the route merges them with the current
  turn's IRE resolution (current turn leads, memory tops up) so guidance stays
  constitutionally consistent across the session. Memory is session-scoped and
  client-held — nothing persists server-side.
- **Slice 3 — Inference-driven navigation (shipped 2026-07-19):** see §6.

**Remaining Phase 3 scope (unbuilt):** ResearchQube/CapabilityQube retrieval,
persistent constitutional memory, observer *modelling* (vs. today's snapshot),
persona-aware + bounded-delegate conversations, cross-cartridge orchestration.

## Architectural principle (for ratification)

> Every SmartTriad copilot shall be context-aware, observer-aware and
> constitutionally grounded. Its responses shall be derived from dynamically
> assembled constitutional context rather than static prompts or hardcoded
> cartridge knowledge. The Invariant Resolution Engine will progressively become
> the primary mechanism for assembling this contextual ground truth, ensuring
> that every copilot receives the minimum sufficient constitutional knowledge
> required for the user's current intent.

## Phasing summary

| Phase | Scope | Status |
|---|---|---|
| 1a | Dynamic placeholder · launcher on every cartridge · dedupe | ✅ shipped 2026-07-19 |
| 1b | SmartTriadContext contract · observer grounding · deep-link chips | ✅ shipped 2026-07-19 (incl. the registry → cartridge metadata follow-on: `codex.copilot` in `data/codex-configs.ts`) |
| 2 | IRE-curated L1 platform ground truth | ✅ v1 shipped 2026-07-19 (gate passed: IRV-001 stability 1.0 / IPV-001 100% reproducible, Stage-0 record 2026-07-18; smart-triad surfaces resolve each message through the IRE and ground on up to 8 governing invariants, cited by seed id) |
| — | L2 corpus layer (`corpusRefs` + `capabilities` in the contract + ground block) | ✅ shipped 2026-07-19 |
| 3 | SmartTriad as the user-facing IRE (full runtime) | in progress — slices 1 (Actions), 2 (constitutional memory v0), 3 (inference-driven navigation) shipped 2026-07-19; see the Phase 3 slice log in §8 for remaining scope |
