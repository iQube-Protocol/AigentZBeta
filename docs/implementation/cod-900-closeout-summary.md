# COD-900 — Closeout Summary (Codex App-Surface Stream)

## Scope completed
- Studio Experience app surfaces: Strategy/Model/Matrix/NBE/Status/Analysis sub-tabs
- Parity modal + pipeline visualization (app-side, COD-208/209)
- Runtime journey cards: goals/stage/matrix/NBE/why/unlocks/handoff (COD-401..409)
- KNYT runtime recognition/progression (COD-409)
- Admin/Codex operational surface: ExperienceDashboardTab (COD-301..307)
- Guardian binding + telemetry + investor reactivation (COD-501..504)
- Registry-facing UI state + traceability + hardening scaffolds (COD-601..603)

## Boundary confirmation
- Lovable owns shell mechanics and outer wrapper behavior.
- Codex owns iframe/Next.js app surfaces and journey rendering.
- Claude owns harness/plumbing/policy/deploy enforcement.

## Deploy gate note
Proceed only after relay refresh confirms packet visibility and no unresolved blocker packets.

---

## Operational notes (post-deploy)

### Adding new tenants to the Experience Dashboard
The `TENANT_NAMES` map in `app/triad/components/codex/tabs/ExperienceDashboardTab.tsx`
controls the human-readable tenant label shown in individual CRM cards.

To add a new tenant:
1. Add an entry to `TENANT_NAMES` in `ExperienceDashboardTab.tsx`:
   ```ts
   const TENANT_NAMES: Record<string, string> = {
     nakamoto: "Nakamoto | KNYT",
     "jmo-knyt": "JMO KNYT",   // ← example
   };
   ```
   The key is the `tenantId` slug passed as a prop (see `data/codex-configs.ts`).
2. Ensure the corresponding slug exists in the `tenants` DB table.
3. Deploy — no DB migration required.

### PostgREST row-limit pagination pattern
Supabase PostgREST hard-caps responses at **1000 rows per request** regardless of
`.limit()` values. Any query that may return >1000 rows must paginate with `.range()`:
```ts
let all = [];
let offset = 0;
const PAGE = 1000;
while (true) {
  const { data: batch } = await supabase.from('table').select('...').range(offset, offset + PAGE - 1);
  if (!batch || batch.length === 0) break;
  all.push(...batch);
  if (batch.length < PAGE) break;
  offset += PAGE;
}
```
The franchise and cohort views in `app/api/runtime/experience/dashboard/route.ts` use
this pattern. Apply it in any new route that aggregates over a large tenant dataset.
