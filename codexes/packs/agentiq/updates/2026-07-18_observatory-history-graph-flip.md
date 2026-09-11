# Constitutional Observatory — history, graph, and the flip control (CFS-035 §12)

**Date:** 2026-07-18
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Workstream:** CFS-035 The Invariant Engine — Observatory amendment (Level 3, OBSERVATION)

Three follow-ons on the Constitutional Observatory Field view, each a committed,
independently-deployable phase.

## 1. Persisted shadow observations (history)

Observations were per-instance (in-memory); now they persist so Platform Health
reads a real time series.

- **migration `20260718000000_invariant_shadow_observations`** — node_id, kind,
  rank_agreement/top_agreement (rank nodes), value_delta (value nodes), cited_ids,
  observed_at.
- `services/invariants/observationStore.ts` — `persistObservation` (best-effort,
  fire-and-forget, never throws) + `getObservationHistory` (per-node rollup; reports
  `persistenceAvailable: false` honestly when the table is absent).
- `engine.recordObservation` fires the persist fire-and-forget — never blocks or
  throws on the observed surface (CFS-035 §11). Serverless caveat: a post-response
  write may not always flush; acceptable for a statistical history, a durable flush
  queue is a further follow-on.
- Observatory Health prefers persisted means over the in-instance snapshot; the UI
  shows an Observations count + per-node history and an amber prompt to apply the
  migration when persistence is unavailable.

## 2. Graph perspective (the field as a node-link graph)

- **`/api/invariants/graph?view=field`** — a whole-field mode added to the existing
  root-traversal endpoint (extended, not forked): top invariants by standing + the
  edges among them. T1-safe, bounded to 80 nodes.
- FieldView fifth **Graph** perspective, lazy-loaded on first open: a self-contained
  SVG node-link diagram (namespace-clustered rings, deterministic layout, no external
  lib), node size ∝ standing, colour = namespace, click-to-inspect statement, legend.

## 3. Operator-gated shadow→authoritative flip control

The ratification step: flipping a node makes the runtime serve its projection
instead of the incumbent heuristic.

- **migration `20260718010000_invariant_node_flips`** — node_id (pk), authoritative,
  rationale, flipped_by_persona (T0 audit — server-internal, never serialised to the
  client), flipped_at.
- `services/invariants/flipStore.ts` — `isNodeAuthoritative` + `isNodeAuthoritativeCached`
  (30s TTL, hot-path safe, **defaults faithful/false** on any miss), `getNodeFlip`,
  `listNodeFlips`, `setNodeFlip`. Client-safe projections exclude the personaId.
- **`/api/invariants/flip`** — GET (list flips + viewer isAdmin); POST **admin-gated
  via the identity spine** (`persona.cartridgeFlags.isAdmin` — never a parallel gate),
  validates the node is registered, records who/why.
- **Capsules route (`/api/runtime/capsules`)** — always shadow-observes; when
  `discovery.ranking` is authoritative it serves the projection's order (cached,
  fail-faithful). Default is unchanged behaviour (incumbent served).
- FieldView Projection perspective — an **admin-only** flip toggle + an
  AUTHORITATIVE/shadow badge; the control is hidden for non-admins and the POST is
  server-gated regardless (defense in depth).

## Operator steps (two migrations)

Apply both in the Supabase SQL editor (or via your migration runner):

```sql
-- 20260718000000_invariant_shadow_observations.sql
-- 20260718010000_invariant_node_flips.sql
```

Both are additive and safe to run anytime. Until applied, the engine degrades
gracefully: observations stay in-memory (Health shows the amber prompt), and every
node stays in shadow (the incumbent is served) — no behaviour change.

## Discipline honoured

- **Reads the engine, never re-instruments**; metrics derived from existing signals.
- **Faithful by default / fail-faithful**: absent tables ⇒ in-memory + shadow.
- **Spine admin gate** for the flip (CLAUDE.md Access Gates); flip is consequential,
  so it's admin-only + audited.
- **T0 discipline**: flipped_by_persona is server-internal audit, never in a client
  response.

## Remaining follow-ons

- Durable observation flush queue (serverless-reliable persistence).
- DVN-anchor the flip as a receipt (chain-of-provenance for the ratification act).
- Extend the flip control to the other nodes (nbe / standing / journey) once they
  earn divergence evidence.
