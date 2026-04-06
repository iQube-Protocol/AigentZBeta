# AgentiQ Alpha — Build Plan (Codex Summary)

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

> Full detail: `docs/alpha/build-plan.md`  
> This is the codex-surfaced summary for stakeholder tracking.

---

## Gate status at program start

| Gate | Name | Status | Key gap |
|------|------|--------|---------|
| 1 | Structural coherence | ✅ Done | Charters + architecture memo complete |
| 2 | Builder coherence | ❌ Pending | AgentiQ OS public docs package needed |
| 3 | Governance coherence | ⚠️ Partial | Factory pipeline exists; no visible intake trace UI |
| 4 | Production coherence | ⚠️ Partial | Studio + Registry connected in code; not in UX |
| 5 | Sovereignty coherence | ⚠️ Partial | Experience model exists; PCS ladder not user-visible |
| 6 | KNYT coherence | ⚠️ Partial | Voting + remix live; like/spark + $KNYT wallet missing |
| 7 | Economic coherence | ❌ Pending | No surface distinguishing Q¢ from $KNYT |
| 8 | Flywheel coherence | ❌ Pending | No golden-path demo artifact |

---

## Phased delivery

### Phase A — Freeze truth *(Gate 1)* ✅ Complete

- [x] Aigent C charter (`.claude/agents/aigent-c.md`)
- [x] Kn0w1 charter (`.claude/agents/kn0w1.md`)
- [x] Marketa charter (`.claude/agents/marketa.md`)
- [x] Architecture memo (`docs/alpha/architecture-memo.md`)
- [x] Asset placement map (`docs/alpha/asset-placement-map.md`)
- [x] Build plan (`docs/alpha/build-plan.md`)
- [x] Alpha Program tab in AgentiQ codex

### Phase B — Package the upstream layer *(Gate 2)*

- [ ] `docs/agentiq-os/README.md`
- [ ] `docs/agentiq-os/quickstart.md`
- [ ] `docs/agentiq-os/contribution-categories.md`
- [ ] `docs/agentiq-os/packaging-standards.md`
- [ ] `docs/agentiq-os/submission-guide.md`
- [ ] SDK export audit and Aigent C persona registration
- [ ] AgentiQ OS docs added to codex pack

### Phase C — Stitch the system loop *(Gates 3+4)*

- [ ] Factory intake trace route + `FactoryIntakeTab.tsx`
- [ ] Registry supply route + `RegistrySupplyTab.tsx`
- [ ] Studio artifact receipt emission on composition save
- [ ] Artifact state visible in ExperienceDashboardTab

### Phase D — Activate sovereignty and world layer *(Gates 5+6)*

- [ ] PCS seed migration (stage labels in `experience_matrices.depth_ladder`)
- [ ] PCS ladder section in `ExperienceDashboardTab.tsx`
- [ ] Like signal route (`app/api/codex/knyt/living-canon/like/route.ts`)
- [ ] Spark signal route (`app/api/codex/knyt/living-canon/spark/route.ts`)
- [ ] NBE → KNYT routing in `SmartTriadProvider.tsx`
- [ ] $KNYT balance in `SmartWalletDrawer.tsx`

### Phase E — Demo and launch *(Gates 7+8)*

- [ ] `EconomicSplitBanner` component
- [ ] `docs/alpha/golden-path-demo.md`
- [ ] Launch package (`docs/alpha/launch/`)

---

## Already built (no work needed)

- Registry Ingestion Factory — full pipeline
- Studio composition — full workflow
- SmartTriad Runtime — ownership, wallet, content delivery
- $KNYT voting + remix — reward emission and lineage
- Experience model schema — full DB schema + API
- Aigent Z + metaMe Guardian charters

---

## Delivery ownership

| Workstream | Primary owner |
|-----------|--------------|
| WS1 — Architecture freeze | Claude |
| WS2 — Topology alignment | Claude + Codex |
| WS3 — AgentiQ OS packaging | Claude |
| WS4 — Factory/Registry/Studio stitching | Codex (+ Claude support) |
| WS5 — metaMe sovereignty alignment | Claude |
| WS6 — KNYT live world activation | Claude |
| WS7 — Economic framing | Claude |
| WS8 — Golden-path demo | Claude + Product owner |
| WS9 — Launch packaging | ChatGPT + Claude |
| WS10 — Internal Aigent operating model | Claude |
