# Aigent Me Phase 5 — Specialist Routing

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 5
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessors:**
- Phase 4 — Venture Progress (d7460e0)
- Phase 3.5 — Executable NBE cards (d168de7)

---

## What landed

Aigent Me can now actually call its specialists. When a user approves an NBE that names a specialist (Marketa / Quill / Kn0w1 / Aigent Z / Aigent C), the approval flow auto-fires a scoped consultation through the LLM orchestra and surfaces the response as a SpecialistResponseCard.

### Server

| File | Purpose |
|---|---|
| `services/agents/specialistRouter.ts` (new) | `askSpecialist({ specialistId, context })` — the canonical server-side entry point. Builds a system prompt from `app/data/personas.ts` + a structured user prompt from the bounded context packet. Calls OpenAI (gpt-4o-mini, JSON mode) when `OPENAI_API_KEY` is configured; falls back to a deterministic template otherwise so the alpha demo flow stays alive without keys. T0 redaction pass defends against accidental identifier leakage in prompts. |
| `app/api/assistant/ask-agent/route.ts` (new) | `POST { specialistId, intentId?, prompt?, cartridge? }`. Persona resolved from spine; never read from body. Builds the SpecialistContext from the persona's ExperienceQube meta slice (no BlakQube values reach the specialist) + optional IntentQube. Returns the SpecialistResponse shape. |

### UI

| File | Purpose |
|---|---|
| `components/metame/cards/SpecialistResponseCard.tsx` (new) | PRD §9.2 Specialist Request / Partner Proposal / Editorial Recommendation / Mission Recommendation cards collapsed into a uniform render driven by `SpecialistResponse`. Header (specialist label + request type + Template badge when no LLM key), summary, recommendations, suggested artifacts (clickable in Phase 6), confidence + approval-required pills, generated-at timestamp. |
| `AigentMeWelcomeTab.tsx` (extended) | New state: `specialistResponses`, `specialistLoading`, `specialistErrors` keyed by nbeId. `handleApprovalApprove` now auto-fires the specialist call after an `action.specialist`-bearing NBE is queued. New `onDismissSpecialist` handler clears the card. SpecialistResponseCards stack below the queued ApprovalCards. |

---

## End-to-end flow

```
1. Click Act on any NBE that has a specialist (e.g. 'Ask Marketa for a
   partner proposal' — specialist: 'marketa').
2. ApprovalCard appears at the top. Click Approve.
3. POST /api/assistant/intent → IntentQube row written.
4. ApprovalCard flips to 'Queued — Ask Marketa for a partner proposal'.
5. AUTO: POST /api/assistant/ask-agent { specialistId: 'marketa',
   intentId: <new>, cartridge: 'marketa' }.
6. specialistRouter builds the context packet from the user's
   ExperienceQube meta slice + the IntentQube, redacts T0 ids,
   calls OpenAI (or templates), parses JSON, returns SpecialistResponse.
7. SpecialistResponseCard renders inline below the queued chip with
   title, summary, recommendations, suggested artifact chips, confidence,
   and a Template / live badge.
8. User dismisses when done.
```

---

## Privacy contract

- The router only sees the SCOPED context the route assembles. BlakQube values never reach the specialist prompt.
- Persona id resolved server-side; never read from request body.
- Outgoing prompts pass through `redact()` — UUIDs and `handle@domain` tokens replaced with `[redacted]` / `[redacted-handle]`. Defence-in-depth against accidental identifier leakage to the LLM.
- iQube usage disclosure ("Using: PersonaQube, ExperienceQube, IntentQube") renders inside the SpecialistResponseCard.
- T0 identifiers never appear on the wire or in LLM context.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `app/data/personas.ts` — Marketa / Kn0w1 / Aigent Z / Aigent C system prompts | ✓ — sole source of specialist personality |
| `services/iqube/experienceQube.ts` | ✓ — meta slice as context |
| `services/iqube/intentQube.ts::getIntentQube` | ✓ — intent context fed into prompt |
| `services/identity/getActivePersona.ts` | ✓ — persona resolver |
| `personaFetch` (PersonaSpine) | ✓ — client → /api/assistant/ask-agent |
| `IqubeContextDisclosure` (Phase 2.b) | ✓ — composed inside SpecialistResponseCard |
| `ApprovalCard` (Phase 3.5) | ✓ — gating step before the specialist call fires |
| OpenAI HTTP client pattern from `app/api/codex/chat/route.ts` | ✓ — inlined as `callOpenAi()` to avoid coupling the heavy chat module |

No new server resolver. No new table. No protected files (CLAUDE.md identity-spine list) modified.

---

## Quill specifics

Per the locked decisions doc:
- Quill is **Qriptopian's resident triad copilot** — no new cartridge.
- Persona key: still pending registration in `app/data/personas.ts` (a follow-up commit will add it formally). For Phase 5, the router supplies a tight default system prompt + the template path covers it cleanly.

When Quill's persona is registered, drop the `null` in `SPECIALIST_PERSONA_KEY['quill']` and it picks up automatically.

---

## LLM fallback behaviour

- `OPENAI_API_KEY` present in Amplify env → live LLM call (12s timeout). Response in JSON mode; bad shape falls through to template.
- `OPENAI_API_KEY` missing OR call fails / times out → templated deterministic response with shape parity. The `source: 'template'` flag drives a "Template" badge in the UI so operators see which mode produced the response.
- Phase 5.b will add Anthropic (Claude) + Venice fallbacks. Today: OpenAI-only live path. Templates ensure the demo flow never blocks.

---

## What still doesn't happen (deferred to Phase 6)

- **Artifact creation** — clicking a suggested-artifact chip in the SpecialistResponseCard is currently disabled (tooltip points to Phase 6). Phase 6 wires Google Doc / Gmail draft / Calendar creation + the real Approval Card gate before external action.
- **Receipt persistence** — the IntentQube + SpecialistResponse already carry enough metadata to become a receipt, but `activity_receipts` writes land in Phase 6.
- **Anthropic + Venice fallback** — Phase 5.b.

---

## Validation

After this lands on dev:

1. Click `Brief me` or `Move this forward` (or click Act on an NBE inside Venture Progress).
2. Find an NBE with a specialist (`marketa.ask-partner-proposal`, `qriptopian.ask-quill-angle`, `knyt.kn0w1-mission-recommendation`, `knyt.zero-investor-update` etc.).
3. Click **Act** → **Approve**.
4. Watch the queued chip render, then a SpecialistResponseCard load below it.
5. If `OPENAI_API_KEY` is set in Amplify env, the card carries the live LLM response. Otherwise it shows a "Template" badge and the deterministic copy.
6. Verify in Supabase if you want:
   ```sql
   SELECT id, experience_id, created_at
   FROM nbe_plans
   WHERE rationale LIKE '__intent_qube_v1__:%'
   ORDER BY created_at DESC LIMIT 5;
   ```
   Each Approve produces one row; the specialist call doesn't write a separate record yet (Phase 6 wires `assistant_sessions` + receipts).

---

## Files

- `services/agents/specialistRouter.ts` (new)
- `app/api/assistant/ask-agent/route.ts` (new)
- `components/metame/cards/SpecialistResponseCard.tsx` (new)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended)
