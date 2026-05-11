# metaMe Personal Assistant Alpha — Locked Decisions

**Date:** 2026-05-11
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me)
**Status:** Locked by operator. Phase 0 foundation in flight.
**Source PRD:** PRD v0.2 — metaMe Personal Assistant Alpha (Aigent Me: Cartridge-Aware Sovereign Chief of Staff)
**Predecessor brief:** `codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-briefing.md` (handover; reference only)

This doc resolves the open questions in PRD §18 and the architectural route-namespace question. These decisions are binding for all Aigent Me work — they are not to be re-litigated by future agents without operator approval.

---

## 1. Naming — Metayé Media (PRD §18 Q1)

**Decision:** Use **Metayé Media** as the canonical brand name across every user-facing surface (welcome panel, context chips, partner selectors, email copy, runtime cards). Do not display "Metaiye Media" in alpha UI.

**Implications:**
- Welcome cartridge context chip: `Metayé Media`
- Partner selector default option: `Metayé Media`
- Marketa proposal target labels: `Metayé Media`
- Existing Marketa system prompt copy that references "Metaiye / StartEngine" remains as historical investor cohort terminology and is not retroactively renamed in alpha (audit follow-up: Phase 7 polish)

---

## 2. KNYT specialist label — Kn0w1 (PRD §18 Q2)

**Decision:** Use **Kn0w1** as the primary label everywhere a specialist agent is named to the user. The descriptor "KNYT Guide" is permitted as a contextual gloss only — Kn0w1 *is* the KNYT Guide.

**Implications:**
- Specialist Request Card target: `Kn0w1`
- Welcome CTA: `Ask Kn0w1` (not "Ask the KNYT Guide")
- First-mention helper copy may read: `Kn0w1, the KNYT Guide` once per session, then `Kn0w1` thereafter
- Aigent Me persona prompt and charter reference the locked label

---

## 3. Daily Brief sources — opt-in per source (PRD §18 Q3)

**Decision:** Gmail / Calendar / Drive are **opt-in per source**. The first time the user requests `Brief me` with a Workspace source, Aigent Me presents an Approval Card to grant scoped access for that source. Approvals persist per-source until revoked.

**Implications:**
- The brief endpoint never auto-includes Workspace context. It includes cartridge + ExperienceQube context by default and offers Workspace sources as separate connect actions.
- Approval Card per source: Gmail → "Connect Gmail (read-only) for daily briefs"; Calendar → "Connect Calendar (read-only) for daily briefs"; Drive → "Connect Drive (read selected) for artifact source context".
- Revocation surface lives in metaMe cartridge Settings; revoking a source removes future inclusion and any cached scope tokens.

**Google integration plan:**
- Build native OAuth2 connectors from scratch under `services/google/{gmail,calendar,drive}/*` (no MCP for the alpha).
- Drive **may** be re-evaluated for an MCP shim post-alpha — not in alpha scope.
- All Workspace tools default to read-only / draft-only. Sending email, sharing docs, and creating external calendar invites require an Approval Card per action (PRD §10 FR11).

---

## 4. Quill — Qriptopian's resident triad copilot (PRD §18 Q5)

**Decision:** Quill becomes the **resident triad copilot of the existing Qriptopian cartridge**. No new cartridge is created. Quill mirrors the pattern Aigent Me holds in metaMe — home cartridge with cross-cartridge reach when called by Aigent Me.

**Implications:**
- No new pack under `codexes/packs/`. Quill registers inside the Qriptopian cartridge.
- Aigent Me's `ask-agent` flow targets Quill via the same envelope shape as Marketa or Kn0w1.
- Quill's structured response shape is the **Editorial Recommendation Card** (PRD §9.2): headline options, editorial angle, audience, article structure, issue placement, related cartridge journey, CTA, image/media prompt, suggested next best experience.
- Three Quill request types in alpha: `find-qriptopian-angle`, `create-issue-brief`, `turn-into-publishable-article` (PRD §10 FR8).
- Quill's persona registration (`app/data/personas.ts`) and charter (`.claude/agents/quill.md`) are tracked separately from the Aigent Me Phase 0 work — created when Phase 5 (specialist routing) lands.

---

## 5. Architectural — new `/api/assistant/*` namespace

**Decision:** Stand up a new **`/api/assistant/*`** API namespace as the canonical Aigent Me surface. Do **not** fork or extend `/api/codex/chat/route.ts`. The assistant routes delegate internally to existing infrastructure:

- LLM routing → `services/metame/agentLlmOrchestra.ts`
- Persona resolution → `services/identity/getActivePersona.ts`
- Access decisions → `services/access/evaluateAccess.ts`
- Orchestration events → `services/orchestration/orchestrationEvents.ts`
- Receipts → `services/receipts/receiptService.ts`
- Artifact schema → `types/studioArtifact.ts`

**Routes (PRD §12):**
- `GET  /api/assistant/bootstrap`
- `POST /api/assistant/experience-model`
- `POST /api/assistant/brief`
- `POST /api/assistant/move-forward`
- `POST /api/assistant/venture-progress`
- `POST /api/assistant/ask-agent`
- `POST /api/assistant/create-artifact`
- `POST /api/assistant/approvals/:approval_id/resolve`
- `POST /api/assistant/receipts`

**Why a separate namespace:** Codex chat is a generic Q&A surface across cartridges. Aigent Me is a structured-card assistant with stateful sessions, IntentQube binding, approval gates, and receipt obligations. Sharing the route would force generic chat to carry obligations it does not need, and force Aigent Me to live behind a chat route that does not match its semantics.

---

## 6. Out-of-scope confirmations (PRD §17)

These remain locked out of alpha and require fresh operator approval to revisit:

- Autonomous email send / publishing / social posting
- Long-running background agent work
- Multi-agent autonomous negotiation
- Payment / reward execution
- Voice-first assistant mode
- CohortQube full segmentation engine (stub-only OK; PRD §7.3)

---

## 7. Phase 0 — Foundation work in this commit set

| Artifact | Purpose |
|---|---|
| `.claude/agents/aigent-me.md` | Aigent Me charter — role, authority, output contract, iQube discipline, locked rules |
| `app/data/personas.ts` (extended) | Aigent Me persona entry registered with the agent LLM orchestra |
| This decisions doc | Operator-locked answers to PRD §18 + route lock |
| `codexes/packs/agentiq/collections.json` (extended) | Decisions doc registered in `col_updates` |

**Not in Phase 0 (deferred to subsequent phases):**
- `assistant_sessions` table migration → Phase 1 (when bootstrap endpoint needs it)
- `/api/assistant/*` route stubs → Phase 1
- ExperienceQube / IntentQube service layer → Phase 2
- Brief / Move Forward endpoints → Phase 3
- AVL Venture Progress flow → Phase 4
- Specialist routing (Marketa, Quill, Kn0w1) → Phase 5
- Google Workspace connectors → Phase 6
- Receipt UX cards → Phase 7

---

## 8. Reuse-first reminders

Before any code lands in Phases 1–7, the implementing agent **must** check:

| Surface | Existing primitive — extend, don't rebuild |
|---|---|
| Active persona | `services/identity/getActivePersona.ts` |
| Persona session token | `services/identity/personaSessionToken.ts` |
| Access gate | `services/access/evaluateAccess.ts` |
| Content descriptor | `services/content/getContentDescriptor.ts` |
| Orchestration event emit | `services/orchestration/orchestrationEvents.ts` |
| LLM routing | `services/metame/agentLlmOrchestra.ts` |
| Studio artifact shape | `types/studioArtifact.ts` |
| Receipts | `services/receipts/receiptService.ts` |
| Codex nav | `utils/codex-nav.ts::buildCodexUrl()` |
| ExperienceModel tables | `supabase/migrations/20260402000000_experience_model_journey_state.sql` (already creates `experience_models`, `experience_goals`, `experience_matrices`, `journey_states`, `nbe_plans`) |
| iQube routes | `app/api/iqube/persona/{qripto,knyt}/route.ts`, `app/api/iqube/memory/route.ts` |

Files that **must not** be modified without operator approval (per CLAUDE.md identity spine rules):

- `services/identity/getActivePersona.ts`
- `services/identity/personaSessionToken.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/content/getContentDescriptor.ts`
- `services/content/encryption.ts`
- `services/content/stateCDelivery.ts`
- `types/access.ts`

Aigent Me extends these by composition. It never forks them.

---

## 9. Verification gate before each phase ships

```
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<a-persona-you-own> \
  --owned=<an-asset-the-persona-owns> \
  --txGuard=<an-asset-id>
```

If the implementing agent introduces new spine surface area, extend `verify-spine.mjs` rather than building parallel verification.

---

## 10. Open follow-ups (deferred, not blocking)

- **Q4 (PRD §18)** — Receipt DVN-readiness: implementer's choice in Phase 7. Default to local-with-DVN-ready-fields unless operator overrides.
- **Q6 (PRD §18)** — AVL scoring model: simple KPI status cards in Phase 4; existing venture lab x/y model layered in if/when AVL operator confirms it is canonical.
- **CohortQube** (PRD §7.3) — out of alpha scope. Stub the type if needed for Marketa's response shape; do not implement segmentation logic.

---

**End of decisions doc.** Future Aigent Me work picks up at Phase 1 (Personal command surface) — assistant bootstrap endpoint, metaMe welcome tab extension, Aigent Me identity component.
