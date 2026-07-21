# CFS-045 — Memory Compilation Charter (Post-Inference Knowledge Compression)

**Status: `ratified` (operator, 2026-07-19 — all six checklist items). v1 BUILT the same day: migration `20260729000000_memory_invariants.sql` (operator must run it — see the SQL in the session hand-off), `services/memory/memoryCompilation.ts` (compile / retrieve / compact / self-view), `/api/memory/invariants` (+ `/compact`), chat-route wiring (retrieval into the smart-triad ground block; post-response compilation via next/server `after()`), and the "Compact memory" operation chip. EXP-011 remains chartered-not-run.**
Source: operator direction + Aletheon's memory-as-compression framing (2026-07-19), in response to the SmartTriad Phase 3 sequencing decision (persistent memory first).

---

## Guiding principle (the charter in one sentence)

> The objective of persistent memory is not to maximize retention, but to
> maximize the faithful reconstruction of reasoning from the smallest coherent
> invariant substrate.

This is the direct application of Invariant Intelligence to memory. The
industry default is *memory = remember more*. The Chrysalis hypothesis is
*memory = remember better*.

## Constitutional principle candidate — "Memory is not a transcript"

Proposed for the invariant canon as **doctrine** (a rule about how the
runtime works, ratifiable now under the hypothesis-vs-canon discipline):

> Persistent memory stores invariant knowledge rather than conversational
> history wherever possible. The runtime does not primarily remember
> conversations; it remembers what survived reasoning. Conversation is
> evidence. Memory is conclusion. The two are never confused.

Naming: this capability is called **Memory Compilation** (long form:
Post-Inference Knowledge Compression). The runtime is not remembering — it is
learning. Humans forget conversations and retain what they taught us; that is
the behaviour Chrysalis emulates.

## The lifecycle

Today's SmartTriad turn ends when the answer is generated. Under this charter
the reasoning is not finished when the answer is generated — **it ends when
the learning has been compressed**:

```
Conversation → Intent → Reasoning → Response
                                       ↓
                          Post-Inference Review
                                       ↓
                          Knowledge Compression
                                       ↓
                           Memory Invariants
                                       ↓
                          Persistent Substrate → future reasoning + observer model
```

We store the smallest coherent reconstruction of what was learned — never the
conversation itself.

### The end-of-interaction question

Every compiled interaction answers one question:

> **What invariant, if any, did this interaction reveal?**

— not "what happened", not "what was said". The permitted outcomes form the
compilation taxonomy:

| Outcome | Effect on the substrate |
|---|---|
| `none` | Nothing written. The common case — most turns teach nothing durable. |
| `confirmed` | Existing memory invariant's `support_count` increments; `last_confirmed_at` updates. |
| `strengthened` | Confidence increases (bounded). |
| `candidate` | New memory invariant written with status `candidate`. |
| `refuted` | `refute_count` increments; repeated refutation retires the invariant. |
| `merged` | Two invariants collapse into one; lineage recorded. |
| `split` | One invariant divides; lineage recorded. |

Memory itself undergoes Knowledge Compression over time: a periodic compaction
pass re-asks the question of the substrate itself (merge near-duplicates,
retire refuted/stale entries), so memory stays small instead of growing
without bound. Exactly like biology; exactly like KnowledgeQubes.

## Three memory layers (and what already exists)

| Layer | Content | Lifetime | Platform home |
|---|---|---|---|
| **Episodic** | Conversation history | Expires with the session | Already exists — chat history + Phase 3 slice 2's session `sessionInvariants` (client-held, cap 12) |
| **Semantic** | Facts, relationships, corpus | Retrieved when needed | Already exists — agent KB / KnowledgeQubes / L2 corpus refs |
| **Constitutional** | Invariant discoveries — very small, very stable, rarely changes | Persistent | **This charter builds it.** |

Chrysalis optimizes for the third layer. This charter deliberately builds
ONLY layer 3 — layers 1 and 2 are live and unchanged.

## v1 build scope (bounded; nothing here ships pre-ratification)

1. **Substrate** — one table, `memory_invariants` (Supabase, RLS: service-role
   only):
   - `id` uuid PK · `persona_id` uuid (**T0 — server-internal key, never
     serialised**) · `cartridge_id` text
   - `statement` text — the compiled invariant, T1-safe content only
   - `status` `candidate | active | retired` · `confidence` numeric
   - `support_count` / `refute_count` int · `lineage` jsonb (merged_from /
     split_from) · `source_seed_ids` text[] (platform invariants that
     grounded the discovery)
   - `created_at` / `updated_at` / `last_confirmed_at` / `last_cited_at`
2. **Compilation pass** — after a smart-triad turn completes, an async
   fire-and-forget review (routed through the Model Router / `callSovereign`
   seam) answers the end-of-interaction question against the operator's
   existing substrate and applies exactly one taxonomy outcome. It never
   blocks or slows the chat hot path; a compilation failure is silent to the
   operator and logged.
3. **Retrieval** — at turn start the route loads the top-N (≤8) `active`
   memory invariants for (persona, cartridge) by confidence × recency into
   the ground block as a distinct section ("Operator memory invariants —
   compiled from prior sessions"), under the existing invariant cap so L1
   platform invariants are never crowded out.
4. **Sovereignty controls** — owner-authenticated self-view route to list and
   delete one's own memory invariants (owner self-view exception applies;
   Bearer-scoped; nothing cross-persona). Memory of a sovereign operator is
   itself sovereign: inspectable and erasable by its subject, v1.
5. **Compaction** — the periodic self-compression pass (merge/retire). May be
   operator-triggered in v1 (an admin operation chip) before being scheduled.

### T-discipline and receipts

- `persona_id` keys the substrate server-side and NEVER appears in
  browser-bound JSON, receipts, or chain payloads (spine tiers apply
  unchanged). Client surfaces receive statements + ids of the *memory rows*
  only via the owner self-view.
- Compiled statements must be T1-safe content: no third-party identifiers, no
  raw case/persona references. The compilation prompt instructs this and the
  write path rejects obvious violations.
- v1 writes **no DVN receipts** (memory is private working knowledge, not a
  provenance-bearing act). Whether compilation events become receipt-eligible
  is a ratification question deferred to v2 — flagged, not assumed.

## Observer modelling implication (next slice consumes this)

With this substrate, the observer stops modelling *what the user did* and
starts modelling *how the user's invariant model is evolving*:

```
Observed behaviour → Inference → Invariant update → Observer model
```

The observer becomes a student of stable patterns, not transient actions.
This is why memory precedes observer modelling in the Phase 3 sequence — the
observer model is a **view over the constitutional memory layer**, not a
second store.

## EXP-011 — Invariant Memory vs Conversational Memory (chartered, not run)

The performance claim is an **empirical hypothesis and stays `proposed`**
until this experiment produces evidence (hypothesis-vs-canon discipline):

- **Hypothesis (proposed):** an invariant-compiled memory substrate matches or
  exceeds a conversational-transcript memory on reasoning fidelity and
  personalization while being materially smaller and cheaper to carry in
  context.
- **Arms:** (A) transcript memory — last-K conversation turns persisted and
  replayed; (B) invariant memory — the CFS-045 substrate.
- **Metrics:** retrieval quality · personalization · reasoning fidelity ·
  storage size · context length consumed · latency.
- **Discipline:** results publish through the canonical experiment pipeline
  (`experiment_results`, registry completeness guard); calibration metrics
  report as proxies with model config, never pass/fail scores; no
  entanglement with structural-thesis evidence.

## Convergence observation (recorded as `proposed`, not canon)

The same lifecycle — *experience → inference → invariant discovery →
knowledge compression → persistent substrate → future reasoning* — now
appears independently in KnowledgeQubes, ExperienceQubes, constitutional
memory, observer modelling, and the research programme itself (CIRS).
Recurrence across independent domains is a strong signal of a stable
architectural pattern. It does **not** prove a universal principle; the claim
enters the canon as `proposed` and earns promotion only through evidence
(EXP-011 among others).

## Ratification checklist (operator)

1. Ratify the constitutional principle **"Memory is not a transcript"** (doctrine).
2. Ratify the guiding principle sentence as the CFS-045 charter objective (doctrine).
3. Approve the v1 build scope §1–5 (schema, compilation pass, retrieval, sovereignty controls, compaction).
4. Confirm v1 ships **without** DVN receipts for compilation events (deferred to v2).
5. Register the convergence observation and the EXP-011 hypothesis as `proposed`.
6. Approve chartering EXP-011 (build follows the memory substrate, not before).
