# Backlog: ingest Polity Paper series as constitutional commentary

**Date:** 2026-06-17
**Status:** backlog
**Owner:** Polity Core / metaCommons workstream

## Task

**Proof of Work Potential (PoWP)** and **Proof of Time Saved (PoTS)** are defined
and enshrined in the **Polity Paper series** within the **Qriptopian codex**. The
Standing Charter and metaCommons Charter reference these concepts but do not
define them authoritatively.

Ingest the relevant Polity Paper series documents into the **Polity Core
cartridge** as **constitutional commentary** documents, in both **human-readable**
(markdown in `codexes/packs/polity-core/items/`) and **machine-readable**
(`services/polity/frameworks/*.json` + accessor + `GET /api/polity-core/constitution`)
formats, and publish them to Autodrive for immutability.

These should be classified as **commentary** (interpretive, authoritative
definitions) distinct from the **charters** (ratified constitutional documents),
but cross-referenced from the Standing and metaCommons charters where PoWP/PoTS
are mentioned.

## Source

- Polity Paper series — Qriptopian codex (`knyt` / `qripto` packs — confirm exact
  location and the specific papers covering PoWP and PoTS).

## Acceptance

- PoWP and PoTS definitions surfaced in Polity Core as commentary (human + machine
  readable), cross-linked from the two charters.
- Autodrive CIDs recorded in the Amendment Records.
