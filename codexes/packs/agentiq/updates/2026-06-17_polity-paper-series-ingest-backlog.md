# Backlog: ingest the Polity Paper series as constitutional commentary

**Date:** 2026-06-17
**Status:** backlog
**Owner:** Polity Core / metaCommons workstream

## Task

The **Polity Paper series** (in the **Qriptopian codex**) is a broad foundational
corpus — the interpretive, authoritative body of work underpinning the Polity. It
is **much wider than any single concept**; **Proof of Work Potential (PoWP)** and
**Proof of Time Saved (PoTS)** are just two of the many elements defined within
it (and the ones the Standing and metaCommons charters currently reference).

Ingest the Polity Paper series into the **Polity Core cartridge** as
**constitutional commentary** — the full series, not only the PoWP/PoTS papers —
in both **human-readable** (markdown in `codexes/packs/polity-core/items/`) and
**machine-readable** (`services/polity/frameworks/*.json` + accessor +
`GET /api/polity-core/constitution`) formats, and publish to Autodrive for
immutability.

## Classification

- **Charters** (ratified constitutional documents) — e.g. the Constitution, Agent
  Charter, Delegation Framework, Standing Charter, metaCommons Charter.
- **Commentary** (interpretive, authoritative — the Polity Paper series) —
  distinct from charters but cross-referenced from them where their concepts
  (PoWP, PoTS, and the rest of the series) are invoked.

## Source

- Polity Paper series — Qriptopian codex (`knyt` / `qripto` packs — confirm the
  exact location and enumerate the full set of papers to ingest, not just the
  PoWP/PoTS ones).

## Acceptance

- The Polity Paper series surfaced in Polity Core as constitutional commentary
  (human + machine readable), structured so individual papers/concepts (including
  PoWP and PoTS) are addressable and cross-linkable from the charters.
- Autodrive CIDs recorded in the Amendment Records.
