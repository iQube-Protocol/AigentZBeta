# Marketa Activation Engine — Phase 1 + Fast-Follow Plan

**Version:** v0.1 implementation alignment  
**Status:** Ready for Phase 1 build planning  
**Primary build track:** OpenAI Codex  
**Host cartridge:** Marketa, not a standalone app  
**Parallel dependency:** Polity Passport Bureau Cartridge  
**Golden rule:** Reuse before rebuild; extend what exists before introducing new surfaces, services, schemas, or workflows.

## 1. Operator decisions captured

This plan incorporates the operator's implementation guidance for the Marketa Activation Engine PRD:

1. Build the Activation Engine **inside the existing Marketa cartridge**, not as a standalone engine/package.
2. Label the user-facing tab **"Activation Engine"** so it is not confused with metaMe cartridge activations.
3. Treat both of these as immediate MVP use cases, while stubbing for extensibility to future use cases:
   - **Exec/Vulnerable persons mobility tagging** — internal/top-bottom mobility tagging, user-facing as executive/vulnerable-person mobility.
   - **High-Yield Legal vs Polity Legal Aid** split.
4. Reuse existing aigentMe import/upload and export/download patterns rather than creating new import/export mechanics from scratch.
5. Outreach, Passport, Registry, and Reputation systems already exist in adjacent platform work and should be **integrated**, not rebuilt.
6. Phase 1 should establish the candidate activation spine; Phase 2 should be a fast follow for deeper integrations and workflow automation.

## 2. Reuse / extend / new matrix

| Area | Reuse | Extend | New required |
|---|---|---|---|
| Marketa shell | Existing `/marketa` cartridge and tabbed console | Add `Activation Engine` tab to the existing Marketa tab set | No standalone app/package |
| Import/export | Existing aigentMe import/upload and export/download UX/API patterns | Adapt for candidate JSON/CSV import and activation report export | Candidate-specific validation and mapping |
| Outreach | Existing Marketa proposal/email/campaign drafting patterns | Add candidate-agent outreach drafts and agent-to-agent invitation payloads | Candidate outreach templates and approval status linkage |
| Passport Bureau | Existing/parallel Passport Bureau cartridge/API contracts | Store and sync Passport status stubs | Non-blocking stub fields in candidate record |
| iQube Registry | Existing registry/iQube concepts and future APIs | Store candidate registry status and references | Non-blocking registry stub fields |
| Reputation | Existing reputation/event concepts | Store public standing and restriction summary | Candidate-level reputation stub fields |
| Receipts | Existing activity receipt conventions | Emit activation events when candidates are scored/outreach is drafted/status changes | Marketa activation event taxonomy if existing receipt schema is too narrow |
| Scoring | Existing Marketa campaign/KPI dashboard patterns | Add candidate scoring and configurable weights | `scoreCandidate`, score weights, risk/clean revenue screens |
| Classification | Existing cartridge/campaign categories as reference | Add strategic lanes and verticals | Lane, vertical, legal split, mobility spine classifiers |

## 3. Phase 1 scope — candidate activation spine

Phase 1 should create a usable, operator-controlled MVP without autonomous discovery or outbound sending.

### 3.1 Data model

Create Marketa-owned candidate activation records that can run before Passport Bureau completion.

Required entities:

- Candidate agent record.
- Candidate source metadata.
- Candidate opportunity record.
- Candidate activation event log.
- Configurable score weights.

Required candidate fields:

- Identity and source fields: name, description, source type, source URL, Agent Card URL, MCP/OpenAPI/repository/website URLs, operator name/type.
- Strategic lanes.
- Verticals.
- Capabilities and target users.
- Exec/Vulnerable persons mobility tagging.
- High-Yield Legal vs Polity Legal Aid classification.
- Scorecard values.
- Risk and policy flags.
- Outreach and activation statuses.
- Passport Bureau integration stub.
- iQube Registry integration stub.
- Reputation integration stub.
- Revenue/opportunity tracking summary.

### 3.2 Classification helpers

Implement deterministic classifiers first; LLM-assisted enrichment can come later.

Required helpers:

- `classifyLane`.
- `classifyVertical`.
- `classifyMobilitySpine`.
- `classifyLegalTrack`.

Immediate use-case treatment:

- **Exec/Vulnerable persons mobility** must be first-class in UI language.
- Internally it may continue to map to the top/bottom model:
  - Exec mobility = senior executive / corporate mobility top reference.
  - Vulnerable persons mobility = stateless citizen / refugee / housing-insecure bottom reference.
- **High-Yield Legal** and **Polity Legal Aid** must be separate classifications, not one generic legal bucket.

### 3.3 Scoring and policy

Implement the configurable weighted scoring model from the PRD.

Required helpers:

- `scoreCandidate`.
- `DEFAULT_MARKETA_SCORE_WEIGHTS`.
- `calculateOverallPriorityScore`.
- `cleanRevenueScreen`.
- `riskFlagger`.

Phase 1 scoring principles:

- Clean revenue potential is important but never overrides policy alignment.
- High-risk candidates should route to review, not outreach.
- Legal, immigration, vulnerable-person, financial, medical, and physical-world claims should raise risk flags.
- Candidate records should preserve why a candidate was flagged.

### 3.4 API endpoints

Add Marketa activation endpoints under the existing app API tree.

Initial endpoints:

- `GET /api/marketa/activation/candidates` — list/filter candidates.
- `POST /api/marketa/activation/candidates` — create manual candidate.
- `GET /api/marketa/activation/candidates/[id]` — candidate detail.
- `PATCH /api/marketa/activation/candidates/[id]` — update candidate/status/stubs.
- `POST /api/marketa/activation/candidates/[id]/score` — score/re-score candidate.
- `POST /api/marketa/activation/import` — import candidates using repurposed aigentMe import/upload patterns.
- `GET /api/marketa/activation/export` — export candidates/report using repurposed aigentMe export/download patterns.

### 3.5 UI

Add an **Activation Engine** tab to the existing Marketa cartridge.

Phase 1 UI panels:

- Candidate list.
- Candidate detail drawer/page.
- Add candidate form.
- Scorecard.
- Activation status dropdown.
- Opportunity summary.
- Clean revenue/risk panel.
- Passport Bureau stub panel.
- iQube Registry stub panel.
- Reputation stub panel.
- Import/upload and export/download controls adapted from aigentMe patterns.
- Filters for lane, vertical, priority score, risk score, clean revenue potential, legal track, and Exec/Vulnerable persons mobility relevance.

## 4. Phase 2 fast-follow scope — integration and execution

Phase 2 should integrate existing systems more deeply; it should not rebuild them.

### 4.1 Outreach integration

- Generate human outreach drafts.
- Generate agent-to-agent invitation payloads.
- Require human approval before outbound outreach.
- Connect to existing Marketa proposal/email/campaign facilities where possible.
- Emit receipts/events for draft creation, approval, and status changes.

### 4.2 Passport Bureau integration

- Connect candidate records to Passport Bureau application URLs/status once the API is available.
- Allow candidate-to-passport application handoff.
- Keep Passport approval out of Marketa; Marketa can recommend and prepare, not issue.

### 4.3 iQube Registry integration

- Sync public candidate registry status where available.
- Store public registry references only.
- Never store private Passport payloads or private blakQube data in Marketa activation records.

### 4.4 Reputation integration

- Pull public standing/restriction state when available.
- Reflect watchlist/restricted/review states in candidate scorecards.
- Route reputation concerns to human review.

### 4.5 Workflow integration

- Add activation summaries and recommended next actions.
- Add candidate-to-opportunity routing.
- Add receipt-backed activation event timelines.
- Prepare for later autonomous discovery, but keep discovery/import operator-controlled until policy gates are complete.

## 5. Phase 1 acceptance criteria

Phase 1 is complete when:

1. Marketa has an `Activation Engine` tab inside the existing cartridge.
2. Candidate agent records can be manually created, listed, viewed, updated, imported, and exported.
3. Candidates can be classified by strategic lane and vertical.
4. Exec/Vulnerable persons mobility tagging is visible in the UI and stored in the candidate record.
5. High-Yield Legal and Polity Legal Aid are separate classifications.
6. Candidates can be scored using configurable weights.
7. Clean revenue and risk screens produce stored flags.
8. Activation status can be changed manually.
9. Opportunity estimates can be associated with candidates.
10. Passport Bureau, iQube Registry, and Reputation stubs are present and editable/sync-ready.
11. The implementation reuses existing aigentMe/Marketa patterns for import/export and outreach where applicable.
12. No outreach is sent automatically.

## 6. Phase 2 acceptance criteria

Phase 2 is complete when:

1. Outreach drafts can be generated from candidate records.
2. Human approval is required before outreach leaves the system.
3. Candidate records can hand off to Passport Bureau application flow when available.
4. Registry and reputation stubs can sync with existing systems when available.
5. Activation events produce receipts or receipt-equivalent audit rows.
6. Candidate opportunities and revenue attribution can be reported by lane and vertical.

## 7. Guardrails

- Do not recreate existing Marketa, aigentMe, Passport, Registry, Reputation, or import/export systems.
- Do not send outreach without human approval.
- Do not issue Participant Passports from Marketa.
- Do not store private blakQube data in candidate activation records.
- Do not perform legal advice, immigration advice, financial advice, medical advice, or final compliance determinations.
- Treat missing policy gates, missing receipts, missing Passport/Registry/Reputation stubs, and UI drift as defects.
