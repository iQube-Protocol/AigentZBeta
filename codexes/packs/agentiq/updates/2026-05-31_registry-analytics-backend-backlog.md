# Registry Analytics Backend — Backlog

**Date:** 2026-05-31
**Status:** Backlog. Page retired/commented at the start of the legacy `/registry` integration (Phase A); build-back when there's a real analytics workstream window.
**Triggered by:** 2026-05-31 operator decision on the legacy `/registry` integration plan (§0 item 3).

---

## Why this exists

The legacy `/registry/analytics` page (`app/(shell)/registry/analytics/page.tsx`, 206 LOC) was always mocked. `GET /api/registry/analytics` returns hardcoded mock totals with a simulated 1.2s latency (per `app/api/registry/analytics/route.ts:25-47`). It has never been wired to real data.

The legacy `/registry → canonical SoT integration plan` retires the page during Phase A. The page becomes either:
- A redirect to the cartridge `Health` tab (the closest live analog), or
- A "coming soon" placeholder with a backlog reference

The decision on which UX to ship at retirement is part of Phase A A5.

---

## What a real analytics backend needs

When this backlog item is picked up, the analytics surface should:

### Data sources (all canonical, already populated)

1. **`iqube_id_map`** — total counts per primitive_type + tool_subtype, growth over time (via created_at)
2. **`content_qube_editions`** — minted vs unissued; rarity distribution; per-qube ownership concentration
3. **`orchestration_events`** — receipt activity per cartridge / per primitive / per event_type; canonization rate; mint completion rate
4. **`mint_sagas`** — saga state distribution; failure rate per failure state; reconciliation backlog
5. **`dvn_receipt_blocks`** — block sealing cadence; receipts-per-block trend; per-cartridge-scope velocity
6. **`iqube_canonization_requests`** — pending / approved / rejected / withdrawn ratios; time-to-decision distribution

### Suggested KPIs

| KPI | Source |
|---|---|
| Total iQubes by primitive type | `iqube_id_map GROUP BY primitive_type` |
| Canonization rate (last 30d) | `iqube_canonization_requests WHERE status='approved' AND decided_at > now() - 30d` |
| Mint success rate (last 30d) | `mint_sagas WHERE current_state='MINT_COMPLETE' AND updated_at > now() - 30d` vs total |
| Average receipt volume per cartridge per day | `orchestration_events GROUP BY active_cartridge, date_trunc('day', created_at)` |
| Top primitives by receipt activity | join `orchestration_events.iqube_id` → `iqube_id_map.primitive_type` GROUP BY primitive_type |
| Pending sagas / canonization queue depth | counts on each table |
| ContentQube edition issuance velocity | `content_qube_editions WHERE issued_at IS NOT NULL` |

### Suggested charts (replacing the mocked placeholders)

1. **Primitive distribution donut** — total iQubes by primitive_type
2. **Receipts timeline** — daily receipt counts (last 30d), stacked by event_type
3. **Canonization funnel** — submitted → approved/rejected/withdrawn over time
4. **Mint saga health** — pie of current_state distribution
5. **Top cartridges** — receipt volume per cartridge, last 30d
6. **Block sealing cadence** — blocks sealed per day per scope

### Implementation outline

- New service `services/registry/analytics.ts` with aggregator functions per KPI
- New route `GET /api/registry/analytics?range=<7d|30d|90d|1y|all>&group_by=<...>` (replaces the mock)
- Caching: 5-minute server-side cache (analytics queries are expensive but the data isn't time-sensitive)
- UI: rebuild `/registry/analytics` page consuming the real route, OR add an `analytics` tab to the iqube-registry cartridge (operator preference)
- Authority compliance: analytics never decides access; aggregations use T2-safe fields only (`actor_alias_commitment`, never `persona_id`). The aggregator runs with service-role and only emits aggregate counts; per-row T0 data never leaves the service.

### Estimated effort

3–4 days for a v1 analytics surface (aggregator + route + 6 charts + caching). Larger if the operator wants per-user / per-persona analytics (those require additional privacy-careful filtering).

---

## Cross-references

- Legacy page being retired: `app/(shell)/registry/analytics/page.tsx`
- Mock route being retired: `app/api/registry/analytics/route.ts`
- Closest live analog today: `/triad/embed/codex/iqube-registry/health` (per-source backfill status)
- Authority constraints: `codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.0.md` §3 Source-of-Authority Matrix
- Receipts ledger: `services/registry/dvnBlocks.ts` (Stage 6)
- Saga state: `services/registry/mintSaga.ts` (Stage 5)
- Canonization queue: `app/api/registry/canonization/route.ts` (Stage 3)

---

**End of backlog item.**
