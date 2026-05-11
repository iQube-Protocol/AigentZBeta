# Aigent Me Phase 6.b — Google Workspace Alignment Backlog

**Date:** 2026-05-12
**Workstream:** Aigent Me Phase 6.b — Google Workspace OAuth + connectors + DVN anchoring
**Status:** Backlog. Scope-locked here per the operator's instruction so the implementer can pick up the work without re-litigating.
**Operator instruction (verbatim):**
> "One thing I would add to 6B is without complicating things we do want to align the google workspace with the studio skills and services and with the marketa campaign activation tools such as partners proposing campaigns, campaign execution via mailjet, etc. We don't want to get into complex multi-agent swarms and the like per the brief but we do not want these google services integrations to be isolated from the current studio, campaigning and relationship building toolset. For example the google workflow tools would also be made available as workflowQubes in the ingestion factory and the key thing here is ensuring they can be used in concert with other skills and tools in the factory."

---

## Why this matters

Phase 6 (commit `8f977db`) shipped the artifact + receipt pipeline with `destination='runtime'` only. Phase 6.b wires Google Workspace as the first real external destination. The instruction is to **align**, not isolate:

- Google connectors register as **workflowQubes** in the Ingestion Factory alongside existing studio skills.
- They are **composable** with Studio + Marketa primitives — a campaign partner proposal (Marketa) can chain into a Gmail draft (Google) and a Mailjet sequence (Marketa) without bespoke wiring.
- They are **not** routed through a multi-agent swarm. The IntentQube + ApprovalCard pipeline (Phase 3.5) already gives the user a single coordinator (Aigent Me). Phase 6.b extends that, doesn't replace it.

---

## Scope — what Phase 6.b ships

### 1. Google OAuth + per-source consent

Per the locked decision Q3 (`2026-05-11_metame-personal-assistant-alpha-decisions.md`): **opt-in per source**. Gmail, Calendar, and Drive each get a separate consent + token scope.

- `services/google/oauth.ts` — OAuth2 flow + token storage per persona
- New table `persona_google_tokens` keyed on `(persona_id, source)` — single row per persona per source. Encrypted at rest (re-uses `services/content/encryption.ts` per CLAUDE.md, no fork)
- `app/api/assistant/connect-google/route.ts` — initiate flow + return consent URL
- `app/api/assistant/google-callback/route.ts` — OAuth callback handler
- `app/api/assistant/disconnect-google/route.ts` — token revocation per source

### 2. Connector services (composable)

Each connector exposes the same shape so studio skills can chain them:

```ts
interface WorkflowConnector<I, O> {
  id: string;                         // e.g. 'google.gmail.draft'
  label: string;
  category: 'communication' | 'scheduling' | 'storage' | 'document' | 'presentation';
  inputs: WorkflowInputSchema;        // JSON Schema
  outputs: WorkflowOutputSchema;
  requiredScopes: GoogleScope[];      // gmail.compose, calendar.events, drive.file, etc.
  execute(input: I, ctx: ExecutionContext): Promise<O>;
  /** PRD §10 FR11 — approval-required for any send / share / publish. */
  requiresApproval: boolean;
}
```

Phase 6.b connectors:

| id | What it does | requiresApproval |
|---|---|---|
| `google.gmail.draft` | Create a Gmail draft from text | false (drafts aren't sent) |
| `google.gmail.send` | Send a Gmail message | **true** |
| `google.calendar.create-event` | Create a Calendar event | false if no external attendees |
| `google.calendar.invite-external` | Calendar event with external attendees | **true** |
| `google.drive.create-doc` | Create a Google Doc from content | false (private by default) |
| `google.drive.share-doc` | Add a share permission to an existing Doc | **true** |
| `google.drive.search` | Search Drive (read-only) | false |
| `google.docs.append` | Append to an existing Doc | false (if owned) / **true** (if shared) |
| `google.slides.create` | Create a Slides deck from outline | false |

### 3. WorkflowQubes in the Ingestion Factory

Each connector also registers as a **workflowQube** in the existing Ingestion Factory so it surfaces alongside studio skills and Marketa partner activation tools:

- Type: `WorkflowQube` (new type — slot into existing `services/registry/*` types). NOT a new iQube category — extends the existing skill/workflow registry.
- Discovery: standard Factory intake; admin promotes to live registry.
- Composition: workflowQubes accept upstream skill/workflow outputs as input. The Factory's existing **chain runner** picks up workflowQubes the same way it picks up studio skills.
- Permission: every workflowQube execution goes through `evaluateAccess()` with the connector's `requiredScopes`; missing scope → friendly "connect Google source" prompt.

### 4. Marketa integration — campaign chain

The operator's example: "partners proposing campaigns, campaign execution via mailjet". Phase 6.b composes:

```
Marketa.propose-partner-campaign
  → IntentQube created (Phase 3.5 path)
  → ApprovalCard #1 (queue the intent)
  → Aigent Me asks Marketa for the proposal (Phase 5)
  → SpecialistResponseCard renders with suggestedArtifacts: ['brief', 'gmail-draft']
  → User clicks 'gmail-draft' chip
  → google.gmail.draft workflowQube runs (Phase 6.b)
  → ArtifactCard renders with draft link
  → User clicks 'Send' on the ArtifactCard
  → ApprovalCard #2 — second-tier gate before external action
  → mailjet workflowQube fires (existing Marketa primitive)
  → Receipt emitted: artifact_sent (DVN-pending)
```

Key wiring: **the same ApprovalCard component** (Phase 3.5) gates both the IntentQube creation and the external send. The second-tier gate is a new state on the existing card — not a new component.

### 5. Studio skills alignment

The existing Studio skill catalogue (`services/composer/studioSkillCatalog.ts`) gets a new `workflowQubes` source. Studio's ComposerStudio can now use:

- `google.docs.append` to extend a draft
- `google.drive.search` to find source material
- `google.calendar.create-event` to schedule a review block

…the same way it uses today's article, image, and video skills. No new orchestration — the Factory's chain runner already handles tool composition.

### 6. DVN anchoring for receipts

Phase 6 left all receipts at `receipt_status: 'local'`. Phase 6.b wires the DVN finalizer:

- `services/dvn/receiptFinalizationService.ts` (existing) extends to consume `activity_receipts` rows where `receipt_status='dvn_pending'`.
- Receipts flagged for anchoring: `artifact_sent`, `approval_granted`, anything that touches external state.
- Receipts that stay `'local'`: `intent_queued`, `experience_model_updated`, `specialist_consulted` (these are user-side coordination, not external action).
- Anchoring path: batch finalizer flips `dvn_pending → dvn_recorded`, populates `dvn_receipt_id`.

### 7. Second-tier Approval Card

The Phase 3.5 ApprovalCard gates IntentQube creation. Phase 6.b adds a second gate before external action (send / share / publish). Same component, different state:

```
state: 'intent-pending' | 'intent-queued'                  // Phase 3.5
state: 'external-pending' | 'external-approved'            // Phase 6.b — new
```

Surface: appears below the ArtifactCard once the user clicks Send / Share / Publish. Shows: recipient list, content preview link, iQube context, second confirmation.

---

## Out of scope — kept explicit

Per the operator instruction:

- **No multi-agent swarms.** Phase 6.b extends Aigent Me's single-coordinator model. Specialists return structured recommendations; workflowQubes execute scoped actions; Aigent Me coordinates. No autonomous agent-to-agent loops.
- **No bespoke per-cartridge integration.** Workspace connectors register once in the Factory; cartridges consume them through the existing skill catalogue. KNYT, Qriptopian, Marketa, AVL all use the same `google.*` workflowQubes.
- **No background scheduler.** Each connector executes in response to an explicit user-approved intent. Phase 7-equivalents (scheduled sends, recurring digests) are deferred behind a separate operator decision.

---

## Cross-references

- `codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-decisions.md` — Q3 (per-source opt-in) and Q5 (Quill as Qriptopian copilot) decisions
- `codexes/packs/agentiq/updates/2026-05-12_aigent-me-phase-6-7-artifacts-receipts.md` — the Phase 6/7 pipeline this extends
- `services/composer/studioSkillCatalog.ts` — Studio skill registry to align with
- `services/registry/*` — Ingestion Factory primitives
- `services/dvn/receiptFinalizationService.ts` — DVN finalizer to extend
- `app/api/codex/chat/route.ts` — chat route the Aigent Me copilot uses (Phase 5.b can use the same LLM fallback chain Anthropic + Venice)

---

## Estimated effort

| Pass | Scope | Effort |
|---|---|---|
| P1 — OAuth + tokens | per-source consent flow + token storage + encryption | ~2 days |
| P2 — Connectors | 9 connectors (Gmail / Calendar / Drive / Docs / Slides) | ~2 days |
| P3 — WorkflowQube registration | Factory + chain runner integration | ~1 day |
| P4 — Marketa + Studio compose | wire Mailjet + Studio skills through workflowQubes | ~1 day |
| P5 — Second-tier ApprovalCard | new state on existing component + send-gate flow | ~0.5 day |
| P6 — DVN anchoring | finalizer extension + batch tests | ~1 day |

Total: ~7.5 days for one engineer.

---

## Pre-flight operator decisions (still pending)

Before Phase 6.b starts:

1. **OAuth client credentials** — Google Cloud Console project + OAuth client id + secret. Operator action.
2. **Scope policy** — which scopes does the user grant when connecting? Recommend the minimum-needed set per connector (already itemised above).
3. **Token storage encryption key** — re-use `services/content/encryption.ts` keying? Per CLAUDE.md identity-spine rules, this needs operator sign-off.
4. **DVN receipt allowlist** — confirm `artifact_sent` and `approval_granted` are the only externally-visible receipts that need DVN anchoring in alpha.

---

## Owner

Unassigned. This doc is the work-intake brief for whoever picks Phase 6.b up.
