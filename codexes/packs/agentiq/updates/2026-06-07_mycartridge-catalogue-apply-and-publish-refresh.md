# myCartridge — Catalogue apply flow + publish refresh + lighter actions UI

**Date:** 2026-06-07
**Status:** shipped

Three improvements to the myCartridge surface following Phase 10 publish-to-myCluster:

1. **"Apply to Publish to metaMe Catalogue"** flow — owner submits a request, metaMe admins review and approve / reject from a new admin tab.
2. **Live published-tab refresh** — clicking Publish to myCluster now surfaces the tab in the strip immediately, no page reload.
3. **Lighter action chrome** — publish and delete buttons are now text/border accents only, matching the rest of the cartridge surface.

Also swapped the order of `myCartridge` ↔ `myLedger` in the myCluster strip so myLedger (the everyday read) comes first.

## DB migration

`supabase/migrations/20260607000000_cartridge_catalogue_requests.sql`

```sql
CREATE TABLE IF NOT EXISTS public.cartridge_catalogue_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_slug            TEXT NOT NULL,
  cartridge_title           TEXT NOT NULL,
  persona_id                UUID NOT NULL,
  auth_profile_id           UUID,
  requester_display_label   TEXT,
  requester_email           TEXT,
  message                   TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                TIMESTAMPTZ,
  decided_by_persona_id     UUID,
  decision_reason           TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cartridge_catalogue_requests_one_pending
  ON public.cartridge_catalogue_requests (cartridge_slug, persona_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS cartridge_catalogue_requests_status_idx
  ON public.cartridge_catalogue_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS cartridge_catalogue_requests_persona_idx
  ON public.cartridge_catalogue_requests (persona_id, requested_at DESC);

ALTER TABLE public.cartridge_catalogue_requests ENABLE ROW LEVEL SECURITY;
```

T0 isolation: `persona_id` and `auth_profile_id` are service-role-only. The admin response surfaces `requester_display_label` + `requester_email` only (both T1-safe — the requester knows their own identity). The unique partial index prevents a persona from spamming pending applications for the same cartridge; re-applying after a rejection inserts a new row so the audit trail stays append-only.

## APIs

| Route | Verb | Purpose |
|---|---|---|
| `/api/cartridge/[slug]/request-catalogue` | POST | Owner submits a catalogue application. Gated by `cartridgeManageGuard requireWrite=true`. Body: `{ message?: string }`. |
| `/api/cartridge/[slug]/request-catalogue` | GET | Owner reads the latest application status. Gated. |
| `/api/admin/cartridge-catalogue/requests` | GET | Admin lists requests by status. Spine-gated on `persona.cartridgeFlags.isAdmin`. |
| `/api/admin/cartridge-catalogue/requests/[id]/decision` | POST | Admin approves or rejects. Body: `{ decision: "approve" \| "reject", reason?: string }`. |

`GET /api/cartridge/[slug]` now also includes a `catalogueRequest` field with `{ id, status, requestedAt, decidedAt, decisionReason }` (or `null`) so MyCartridgeTab can render the application status inline without a second fetch.

## Frontend

### MyCartridgeTab

- Publish and delete buttons recolored to text + border accents (emerald + rose) with **no background fill** — matches the cartridge's chip / tag style.
- New **"Apply to Publish to metaMe Catalogue"** button between publish and delete. Sky-toned to distinguish from publish (emerald). Label and state mirror the application status — "Apply…" → "Submitting…" → "Pending review" → "Listed in Catalogue" or "Re-apply…" after rejection.
- New header chips: `live in myCluster` (emerald), `in metaMe catalogue` (sky), `catalogue review pending` (amber). All transparent — outline only.
- On a successful publish/unpublish toggle, dispatches `window.dispatchEvent(new Event('mycluster:published-changed'))` so the metaMe panel refetches its published tab list without a page reload.

### CodexPanelDynamic

- Subscribes to `mycluster:published-changed` on the window and bumps a refetch token. The published-cartridges fetch effect runs again, and the new tab appears in the myCluster sub-strip in the next render cycle.
- Tab order comment updated to reflect the myLedger / myCartridge swap (myLedger order 2, myCartridge order 3, published cartridges at 10+).

### CartridgeCatalogueAdminTab (new)

Lives in the metaMe codex Admin group at `order: 62.5` between Persona 360 and the Experience Framework. Lists pending / approved / rejected requests with a filter chip strip. Each card shows cartridge slug + title, requester display label + email, the operator's optional message, and decision metadata once decided. Approve and Reject buttons are inline; rejection prompts for an optional one-line reason that travels back to the requester.

The tab is registered in `TabRenderer`'s `componentRegistry` and exposed via `config: { component: 'CartridgeCatalogueAdminTab' }`. `adminOnly: true` at the codex config level + spine-gated API enforcement on the server.

### Tab order swap (myCluster strip)

| Position | Before | After |
|---|---|---|
| 1 | myCanvas | myCanvas |
| 2 | myWorkspace | myWorkspace |
| 3 | myCartridge | **myLedger** |
| 4 | myLedger | **myCartridge** |
| 5+ | published personal cartridges | published personal cartridges |

## UX flow

1. Owner clicks **"Publish to myCluster"** in MyCartridgeTab → the tab appears in the myCluster strip immediately (no reload). Clicking again removes it.
2. Owner clicks **"Apply to Publish to metaMe Catalogue"** → POST creates a pending request. The button label flips to "Pending review", and a `catalogue review pending` chip appears in the header.
3. A metaMe admin opens metaMe → Admin → "Catalogue Requests", sees the pending row, and clicks Approve (or Reject with an optional reason).
4. On the owner's next view (or a refresh of `MyCartridgeTab`), the status flips to "Listed in Catalogue" or "Re-apply to metaMe Catalogue" (with the rejection reason surfaced in the button tooltip).

## Files

| File | Status |
|---|---|
| `supabase/migrations/20260607000000_cartridge_catalogue_requests.sql` | new |
| `app/api/cartridge/[slug]/request-catalogue/route.ts` | new (POST + GET) |
| `app/api/admin/cartridge-catalogue/requests/route.ts` | new (GET) |
| `app/api/admin/cartridge-catalogue/requests/[id]/decision/route.ts` | new (POST) |
| `app/api/cartridge/[slug]/route.ts` | adds `catalogueRequest` to GET response |
| `app/triad/components/codex/tabs/CartridgeCatalogueAdminTab.tsx` | new |
| `app/triad/components/codex/tabs/MyCartridgeTab.tsx` | lighter buttons, catalogue apply, refresh dispatch |
| `app/triad/components/CodexPanelDynamic.tsx` | subscribes to refresh event |
| `app/triad/components/codex/TabRenderer.tsx` | registers `CartridgeCatalogueAdminTab` |
| `app/triad/components/codex/iconMap.ts` | adds `PackageCheck`, `Boxes` |
| `data/codex-configs.ts` | swaps myLedger ↔ myCartridge order, adds catalogue admin tab |

## Operator SQL (one paste)

```sql
CREATE TABLE IF NOT EXISTS public.cartridge_catalogue_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_slug            TEXT NOT NULL,
  cartridge_title           TEXT NOT NULL,
  persona_id                UUID NOT NULL,
  auth_profile_id           UUID,
  requester_display_label   TEXT,
  requester_email           TEXT,
  message                   TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                TIMESTAMPTZ,
  decided_by_persona_id     UUID,
  decision_reason           TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cartridge_catalogue_requests_one_pending
  ON public.cartridge_catalogue_requests (cartridge_slug, persona_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS cartridge_catalogue_requests_status_idx
  ON public.cartridge_catalogue_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS cartridge_catalogue_requests_persona_idx
  ON public.cartridge_catalogue_requests (persona_id, requested_at DESC);
ALTER TABLE public.cartridge_catalogue_requests ENABLE ROW LEVEL SECURITY;
```

Paste once in the Supabase SQL editor on the dev project.
