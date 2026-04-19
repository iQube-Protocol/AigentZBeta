# KNYT Cartridge — Architecture and Ops Notes

**Last updated:** 2026-04-18
**Maintained by:** Claude Code / operator

---

## 1. What This Document Is

Running reference for the KNYT Cartridge technical architecture, tab layout, component map, and operational conventions. Update it when tabs are added, components change, or new conventions are established.

---

## 2. Tab Architecture — Full Map

The KNYT Cartridge is defined in `data/codex-configs.ts` as `id: 'knyt-codex'`.

| Order | Slug | Label | Type | Component | Admin-only | Kn0w1 Copilot |
|-------|------|-------|------|-----------|------------|---------------|
| 0 | `codex` | Codex | liquid-ui | `knyt:drawer_grid_v1` | No | ✅ |
| 1 | `scrolls` | Scrolls | liquid-ui | `knyt:motion_stage_v1` | No | ✅ |
| 2 | `characters` | Characters | liquid-ui | `knyt:dual_poster_stage_v1` | No | ✅ |
| 3 | `lore` | Lore | liquid-ui | `knyt:drawer_grid_v1` | No | ✅ |
| 4 | `digiterra` | DigiTerra | liquid-ui | `knyt:motion_stage_v1` | No | ✅ |
| 5 | `terra` | Terra | static | `TerraTab` | No | ✅ |
| 6 | `order` | Order | liquid-ui | `knyt:quest_hud_hub_v1` | No | ✅ |
| 7 | `living-canon` | 21 Sats | liquid-ui | `knyt:living_canon_v1` | No | ✅ |
| 8 | `runtime` | Runtime | static | `KnytRuntimeSurface` | No | ✅ |
| 9 | `treasury` | Treasury | static | `KnytTreasuryTab` | No | ✅ |
| 10 | `knyt-alpha` | Venture Lab α | static | `KnytAlphaTab` | No | ✅ |
| 11 | `experience-dashboard` | Experience | static | `ExperienceDashboardTab` | **Yes** | ✅ |
| 12 | `experience-pack` | Experience Pack | static | `AgentiqCartridgeTab` | **Yes** | ✅ |
| 13 | `wheel` | KNYT Wheel | static | `AgentiqCartridgeTab` | **Yes** | ✅ |
| 14 | `investors` | Investors | static | `InvestorDirectoryTab` | **Yes** | ✅ |
| 15 | `outreach` | Outreach | static | `RelationshipBuilderTab` | **Yes** | ✅ |

Kn0w1 copilot coverage was completed 2026-04-18. All tabs now expose the floating Kn0w1 activation button.

---

## 3. Two Tab Types

### liquid-ui tabs (orders 0–4, 6–7)
- Rendered via `TabRenderer.tsx` → `liquidTemplateRegistry`
- Template registry: `app/triad/components/codex/liquidTemplates/registry.ts`
- Templates are standalone components registered by name (`knyt:drawer_grid_v1`, etc.)
- The floating copilot button is baked into the liquid template base — it comes for free on all liquid-UI tabs
- To add a new liquid tab: register a template, add the tab entry in `data/codex-configs.ts`

### static tabs (orders 5, 8–15)
- Rendered by `TabRenderer.tsx` → mapped directly to a named React component
- Component map is in `TabRenderer.tsx` — any new component must be added there
- Each static component must explicitly include `CodexCopilotLayer` to get the Kn0w1 floating button
- Props passed: `personaId`, `codexId`, `theme`, `density`, `isAdmin`, `isPartner`, `partnerId`

---

## 4. Static Component File Locations

All static tab components live in:
```
app/triad/components/codex/tabs/
```

| Component | File |
|-----------|------|
| `TerraTab` | `tabs/TerraTab.tsx` |
| `KnytRuntimeSurface` | `tabs/KnytRuntimeSurface/index.tsx` |
| `KnytTreasuryTab` | `tabs/KnytTreasuryTab.tsx` |
| `KnytAlphaTab` | `tabs/KnytAlphaTab.tsx` |
| `ExperienceDashboardTab` | `tabs/ExperienceDashboardTab.tsx` |
| `AgentiqCartridgeTab` | `tabs/AgentiqCartridgeTab.tsx` |
| `InvestorDirectoryTab` | `tabs/InvestorDirectoryTab.tsx` |
| `RelationshipBuilderTab` | `tabs/RelationshipBuilderTab.tsx` |

---

## 5. `AgentiqCartridgeTab` — Document Viewer Pattern

The tabs at orders 12 (`experience-pack`) and 13 (`wheel`) both use `AgentiqCartridgeTab`. This is a shared document viewer component, not a KNYT-specific component. It takes:

```ts
{
  packId: string;           // e.g. 'knyt'
  collectionId: string;     // e.g. 'col_experience_pack'
  defaultPath: string;      // first doc to open
  editable?: boolean;       // default false
}
```

It reads from the pack's `collections.json` and serves the markdown files via `/api/codex/packs/:packId/collections/:collectionId`. To add a doc to the Experience Pack or KNYT Wheel tab: add a file to `codexes/packs/knyt/items/` and register it in the relevant collection in `codexes/packs/knyt/collections.json`.

Collections for this cartridge:
- `col_experience_pack` → Experience Pack tab
- `col_knyt_campaign` → KNYT Wheel tab

---

## 6. Admin-gated Tabs

Tabs at orders 11–15 are `adminOnly: true` in `data/codex-configs.ts`. They are hidden from all non-admin users.

**Security rule:** Never remove the `adminOnly: true` flag without explicit operator authorisation. If a tab is inaccessible to a legitimate admin, fix the upstream auth flow — do not remove the gate.

The `isAdmin` prop is resolved in the embed page via `useCodexEmbedAuthBridge` and passed down through `CodexPanelDynamic` → `TabRenderer` → each tab component.

---

## 7. Kn0w1 Copilot — Integration Pattern

Every static tab that should expose the Kn0w1 floating activation button must include the following pattern:

```tsx
// 1. Import
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";

// 2. State (inside component)
const [copilotOpen, setCopilotOpen] = useState(false);
const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);

// 3. Component (at end of JSX, before closing div)
<CodexCopilotLayer
  isOpen={copilotOpen}
  onClose={() => setCopilotOpen(false)}
  onOpen={() => setCopilotOpen(true)}
  variant="floating"
  enableInferenceRendering
  personaId={personaId}          // pass if available
  contextId="knyt-<tab-slug>"
  messages={copilotMessages}
  onMessagesChange={setCopilotMessages}
/>
```

For tabs with skill CTAs that pre-populate a query (e.g. `KnytAlphaTab`), also add:
```tsx
const [copilotInitialMsg, setCopilotInitialMsg] = useState<string | undefined>();
// Then: initialMessage={copilotInitialMsg} on the component
// And: setCopilotInitialMsg("..."); setCopilotOpen(true); on the CTA button
```

Liquid-UI tabs get the copilot button through their template — no additional work needed.

---

## 8. Protocol Economics KB

All four Kn0w1-family agents (`aigent-c`, `aigent-z`, `aigent-kn0w1`, `aigent-marketa`) have a two-layer ground truth for `$KNYT` and `QriptoCENT (Qc)`:

**Layer 1 — Always-on:** `PROTOCOL_GROUND_TRUTH` constant injected directly into each agent's system prompt in `app/data/personas.ts`. Covers canonical names, one-sentence distinction, fallback answers, and forbidden phrases. Cannot be missed regardless of retrieval.

**Layer 2 — Searchable KB:** 6 chunks in `codex_kb_chunks` table with `domain='protocol'`, seeded by `supabase/migrations/20260417000008_protocol_kb_chunks.sql`. NULL embeddings — searched via ILIKE keyword fallback in `embeddingService`. Surfaced when a user message pattern matches `isProtocolQuery()` in `app/api/codex/chat/route.ts`.

The canonical source doc for operators is: `codexes/packs/aigency/items/knowledge/protocol-economics.md`

**To run the KB migration** (run once in Supabase SQL editor):
```
supabase/migrations/20260417000008_protocol_kb_chunks.sql
```

---

## 9. Key Files for Cartridge Maintenance

| Task | File |
|------|------|
| Add / remove / reorder a tab | `data/codex-configs.ts` → `KNYT_CODEX` |
| Register a new static component | `app/triad/components/codex/TabRenderer.tsx` |
| Register a new liquid-UI template | `app/triad/components/codex/liquidTemplates/registry.ts` |
| Add a doc to Experience Pack | `codexes/packs/knyt/collections.json` → `col_experience_pack` |
| Add a doc to KNYT Wheel | `codexes/packs/knyt/collections.json` → `col_knyt_campaign` |
| Kn0w1 agent system prompt | `app/data/personas.ts` → `aigent-kn0w1` |
| All agent protocol ground truth | `app/data/personas.ts` → `PROTOCOL_GROUND_TRUTH` |
| Chat route (skills, KB, live context) | `app/api/codex/chat/route.ts` |

---

## 10. Adding a New Tab — Checklist

1. Add tab entry in `data/codex-configs.ts` under `KNYT_CODEX.tabs` with correct `order`, `type`, `slug`, `adminOnly` if needed
2. **If liquid-ui:** register the template in `liquidTemplates/registry.ts` — copilot button is automatic
3. **If static:** create the component in `tabs/`, register it in `TabRenderer.tsx`, add `CodexCopilotLayer` using the pattern in §7
4. **If it shows a document viewer:** add files to `codexes/packs/knyt/items/` and register the collection in `collections.json`
5. If admin-only, set `adminOnly: true` — never gate-strip without authorisation


---

## 11. Inter-Cartridge Identity — How personaId Travels

**Decision (2026-04-18):** personaId and access rights must travel explicitly via URL params on every cross-cartridge navigation link. This is a platform-wide canonical rule, not a KNYT-specific concern.

### Why

When a user moves between the KNYT Cartridge and Venture Lab α (or any other cartridge), their persona context must arrive with them. Without it:
- Tab components cannot load personalised data (balance, journey state, participation)
- Access gates (`adminOnly`, `partnerOnly`) cannot be bootstrapped for optimistic client UI
- The back-button cannot reconstruct correct breadcrumbs

### How it works in KNYT

| Link | Source | Target | Carries |
|------|--------|--------|---------|
| Back-button in `KnytAlphaTab` | knyt-codex / knyt-alpha | alpha-knyt / alpha-programme | `personaId`, `from=knyt`, `fromTab=knyt-alpha` |
| KNYT Wheel card in `AlphaProgrammeTab` | alpha-knyt / alpha-programme | knyt-codex / knyt-alpha | `personaId`, `from=alpha-knyt`, `fromTab=alpha-programme` |

### Code

```tsx
import { buildCodexUrl } from "@/utils/codex-nav";

// Back-button (KnytAlphaTab)
href={buildCodexUrl("alpha-knyt", {
  tab: "alpha-programme",
  personaId,        // from component props
  from: "knyt",
  fromTab: "knyt-alpha",
})}

// Deep-link card (AlphaProgrammeTab → KNYT Wheel)
buildCodexUrl("knyt-codex", {
  tab: "knyt-alpha",
  personaId,        // from component props
  from: "alpha-knyt",
  fromTab: "alpha-programme",
})
```

### Access gate rule

`isAdmin` and `isPartner` flags in the URL are **optimistic only** — the server re-validates from the persona record on every load. Access gates cannot be bypassed via URL manipulation. Only propagate these flags dynamically when the current session holds them.

### Full platform rule

See `CLAUDE.md` § "Inter-Cartridge Navigation — Identity Propagation" and `codexes/packs/agentiq/items/SYSTEM_MAP.md` § 5.
