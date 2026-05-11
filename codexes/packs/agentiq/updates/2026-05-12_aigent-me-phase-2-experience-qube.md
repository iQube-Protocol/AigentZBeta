# Aigent Me Phase 2 — ExperienceQube + IntentQube + setup endpoint

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 2 of the phased build plan
**Status:** Data layer + API shipped. Setup wizard UI ships as Phase 2.b.
**Predecessors:**
  - `codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-decisions.md` (locked decisions)
  - Phase 0 — charter, persona registration (commit 8aadd00)
  - Phase 1 — bootstrap endpoint + welcome surface (commit a502a40)
  - PersonaSpine + parent contract (commits b220a1b, 3f7eb36)

---

## What landed

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/20260513000000_experience_qubes.sql` | new | Per-persona `experience_qubes` table — meta slice (T1) + blakQube jsonb (T0). Service-role RLS. Auto-touched `updated_at`. |
| `services/iqube/experienceQube.ts` | new | Canonical reader/writer. `getExperienceQube`, `upsertExperienceQube`, `getExperienceQubeBootstrapHint`. Validates enums; sanitises BlakQube patches against an allowlist; merges per-key. |
| `services/iqube/intentQube.ts` | new | Bounded task scope. `createIntentQube`, `getIntentQube`, `setIntentQubeStatus`. Stored in `nbe_plans` (existing table) via a sentinel-prefixed jsonb pack — public API stays clean for the Phase 5 pivot to a dedicated `intent_qubes` table. |
| `app/api/assistant/experience-model/route.ts` | new | `GET` returns the meta slice + a counts-only blakQube summary (never raw values). `POST` upserts. Persona resolved from the spine; never read from the body. |
| `app/api/assistant/bootstrap/route.ts` | extended | Reads ExperienceModel state via `getExperienceQubeBootstrapHint` instead of an ad-hoc `journey_states` peek. The "Set up my ExperienceModel" CTA flips from `preview` → `available`. |

---

## Data model decisions

1. **One ExperienceQube per persona.** `UNIQUE` constraint on `persona_id`. Setup is upsert; updates are partial.
2. **Two slices, two privacy tiers.**
   - `meta` columns are T1-safe: surface to the browser via the API and bootstrap.
   - `blak_qube` is T0: stored as `jsonb` in alpha; encryption wires in via `services/content/encryption.ts` in Phase 2.5 (no schema change required at that point).
3. **No new IntentQube table now.** Phase 2 stores bounded-intent extras inside `nbe_plans.rationale` behind a `__intent_qube_v1__:` sentinel. The IntentQube service exposes a clean record shape independent of storage; Phase 5 pivots to a dedicated `intent_qubes` table when specialist routing needs richer typing. Public API stays unchanged.
4. **Optional FK into `experience_models`.** A persona may either follow a curated catalog model (FK populated) or author their own (FK null). The choice doesn't change downstream code.

---

## Privacy contract

- `personaId` resolved at the route boundary via `getActivePersona(request)`. **Never** read from the request body.
- The `GET /api/assistant/experience-model` response contains:
  - the **meta slice** (public-safe — name, type, primary goal, stage, progress model, active cartridges, confidentiality default)
  - a **counts-only blakQube summary** (`goalsCount`, `priorityPartnersCount`, `hasConfidentialNotes`, …) so the welcome surface can render "5 goals set" UI without disclosing values
  - the `updatedAt` timestamp
- The blakQube payload itself is **never** serialised to a JSON response. Reading it requires an explicit `evaluateAccess()` decision — that flow lands in Phase 5 specialist routing.
- Server-side service `getExperienceQube()` returns the raw blakQube to the route layer; routes are responsible for redaction. The default API surface enforces that.

---

## Operator action required

Run the new migration in Supabase SQL editor. Single block:

```bash
# /home/user/AigentZBeta/supabase/migrations/20260513000000_experience_qubes.sql
```

Paste the file contents into the Supabase SQL editor and run. After that:
- `GET /api/assistant/experience-model` returns `{ configured: false, meta: null, blakSummary: null, updatedAt: null }` for any persona until the first POST.
- Bootstrap shows "ExperienceModel: not yet set up" for unconfigured personas, and "ExperienceModel: <name> · stage: <stage>" once the first POST lands.

---

## Reuse-first audit

Per CLAUDE.md golden rule.

| Existing primitive | Used? |
|---|---|
| `services/identity/getActivePersona.ts` | ✓ — sole personaId source at the route boundary |
| `services/iqube/*` directory | ✓ — new services live here alongside future iQube types |
| `experience_models` (global catalogue table) | ✓ — optional FK from per-persona qube |
| `nbe_plans` (existing table) | ✓ — IntentQube extras packed in via sentinel; no new table |
| `app/api/_lib/supabaseServer` | ✓ — single client factory |
| `services/content/encryption.ts` | will be wired in Phase 2.5 (no API change) |
| `personaFetch` / PersonaSpine | will be used by the Phase 2.b setup wizard UI |

No code was forked. No protected files (CLAUDE.md identity-spine list) were modified. Net new lines: ~700 (migration + 2 services + 1 route + bootstrap delta).

---

## What does NOT ship in Phase 2

Deferred to Phase 2.b (next commit):
- ExperienceModel **setup wizard UI** — multi-step flow (project / cartridges / outcome / confidentiality / agents) that calls `POST /api/assistant/experience-model`
- ExperienceModel **Card** for the welcome surface — replaces the inline "ExperienceModel: not yet set up" line
- iQube **context disclosure panel** — "Using: PersonaQube, ExperienceQube, IntentQube. Not shared: …" UI strip per PRD §9.2

Deferred to later phases:
- Phase 2.5 — BlakQube encryption (wraps `services/content/encryption.ts`)
- Phase 3 — Brief / Move-forward (uses `createIntentQube`)
- Phase 5 — Specialist routing (extends IntentQube to a dedicated table when richer scope is needed)

---

## Companion: PersonaSpine migration sweep #1

Same PR also lands the first migration sweep target per `docs/architecture/persona-spine-client-protocol.md`:

| File | Change |
|---|---|
| `services/access/spineGateClient.ts` | Inline `readJwt()` localStorage scan replaced with `personaFetch()`. ~15 lines removed; behaviour unchanged. First adoption of the protocol outside the Aigent Me reference implementation. |

11 migration targets remain.

---

## Files

- `supabase/migrations/20260513000000_experience_qubes.sql`
- `services/iqube/experienceQube.ts`
- `services/iqube/intentQube.ts`
- `app/api/assistant/experience-model/route.ts`
- `app/api/assistant/bootstrap/route.ts` (extended)
- `services/access/spineGateClient.ts` (migrated)
