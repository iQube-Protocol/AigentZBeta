# MoneyPenny Cartridge Reconstitution

**Specification:** MPY-CARTRIDGE-RECONSTITUTION · **Version:** 1.1 · **Date:** 2026-09-01  
**Companions:** [Financial Services Bridge and Three-Threshold Journey](Financial_Services_Bridge_Spec_v1.md) · [Qriptopian Native Bridge Content Administration](Qriptopian_Bridge_Admin_Spec_v1.md)  
**Status:** Implementation specification for review, derived from the operator-approved direction. This document does not claim implementation, deployment, live trading readiness, or independent constitutional ratification.  
**Delivery order:** Cartridge capabilities and shared interaction contract first; bridge integration and educational packaging second. The third coordinated workstream supplies native Qriptopian bridge content administration; its A0/A1 work proceeds alongside cartridge foundations.

**Version 1.1 addition:** Native Qriptopian Admin → Bridges owns educational content administration, shared asset uploads and bridge placements. See C-17 and the companion administration specification. Existing requirement IDs are preserved.

## 1. Problem and intended result

MoneyPenny's current experience presents overlapping navigation, isolated chat and working panels, technical service categories, and inconsistent demonstrations of financial capability. The supplied screenshots show top-level HFT/Connect/Service/Administer navigation, a second tab row, an additional capability sidebar, and standalone-app modals exposing many of the same functions. A newcomer has to understand the organization before understanding their finances.

Reconstitute MoneyPenny as the financial-services application of the established Agent Me / DevOn / Research Copilot experience: persistent copilot on the left; chips, capsules, and working surfaces on the right; shared top navigation; contextual quick actions; a resumable task journey; reversible full-screen workspaces.

MoneyPenny is the financial-services specialist and delegate. Agent Me, rendered canonically as aigentMe where the existing product uses that name, represents the person's wider intentions and coordinates specialist support. A person can work with MoneyPenny directly or through Agent Me without losing ownership, context, or oversight.

### Success definition

A first-time operator can understand their financial position, choose a goal, make a plan, rehearse an activity, and perform an appropriate bounded real task where the actual service is available. They can explain who acted, under what authority, what it cost, and what happened. An experienced operator can expand the same cartridge into more sophisticated work without relearning the interface.

## 2. Scope and decisions

### Included

- The shared split-pane MoneyPenny workspace and consolidation of existing entry points.
- Financial profile preparation: statements, extraction, review, correction, understanding, and goal setting.
- Fiat and crypto as connected views of the person's financial life.
- Advisor, Architect, and Runtime modes within task-led journeys.
- Educational media, including inline conversational video and right-pane charts/infographics.
- Simulation, evidence replay, bounded live operations, and explicit readiness distinctions.
- Crypto holdings, investment/trading education, route comparison, arbitrage analysis, and HFT simulation; live variants only where their route is verified and governed.
- Bounded delegation to MoneyPenny directly or through Agent Me, and onward handoff to advanced Horizen operations.
- Migration mapping, implementation dependencies, observability, and acceptance criteria.

### Boundaries

This reuses constitutional authority, identity, wallet, settlement, receipt, Standing, Journey Spine, and copilot primitives. It does not introduce a second financial execution engine or a second ledger. Full brokerage integration, tax/insurance services, and every professional automation strategy are mapped as future domain breadth, not launch promises. Creation of the complete educational asset collection is a delivery phase specified here and in the bridge document; it has not occurred as part of writing these specifications.

Existing runtime assurance requirements remain service-specific. A more approachable UI must not waive admission, proof, mandate, Standing, or confidential-attestation requirements. The current operator direction supersedes the old presentation choices; it does not silently rewrite constitutional service contracts.

## 3. Evidence baseline and implementation reconciliation

### Inspection boundary

Repository: `iQube-Protocol/AigentZBeta`, local branch `claude/cs-capstone-estate-and-brief`, commit `f214d2be3` dated 2026-08-25. Inspection performed 2026-09-01. This checkout predates the supplied September 1 screenshots. No authenticated production rehearsal or current deployed-module verification was performed. Existing unrelated working-tree changes were left untouched.

Forty screenshot attachments were supplied, including repeated filenames/views. They establish visible UX, not backend functionality. The separate MoneyPenny 002 Lovable source was not inspected; its simulation mode is an operator-reported reuse candidate. Do not declare newer profile or capability surfaces absent because this older checkout lacks them.

| Evidence | What is established | Implementation treatment |
|---|---|---|
| `data/codex-configs.ts`, `MONEYPENNY_CARTRIDGE` | Existing cartridge identity, copilot configuration, grouped navigation, and panel routes | Reuse identity/configuration; evolve navigation with compatibility mapping |
| `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` | Dispatcher reuses HFT, chat, portfolio, strategies, X402, FIO, SmartTriad, CRM, Architect, Runtime, and service-orchestration panels | Wrap/adapt useful panels; consolidate shell ownership |
| `AigentMeWelcomeSplitTab.tsx` and `DevCommandCenterTab.tsx` in the same tabs directory | Existing split-pane patterns; DevOn mounts `SmartTriadCopilotLayer` in panel mode with ground context and layout callbacks | Reuse the pattern and common components; extract only demonstrably common shell seams |
| `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` | `groundContext`, quick-prompt actions, `onSuggestedLayouts`, and proposal callbacks already exist | Extend typed financial layouts and scoped session handling |
| `components/journey/BridgeMediaStage.tsx` | Video/poster presentation already exists | Reuse media mechanics where applicable |
| `app/components/codex/CopilotInferenceBodyRenderer.tsx` | Structured text, table, and Mermaid rendering inspected | Inline educational-video message integration still requires tracing the runtime's existing media path; do not create a duplicate player first |
| `app/api/moneypenny/runtime/route.ts` | Existing persona resolution and constitutional pipeline; distinct authority references for intelligence and settlement | Reuse boundaries. In this snapshot the settlement output is an intent, not proof of signing/broadcast/finality |
| `services/financialServices/serviceCatalog.ts`, `serviceRequestOrchestrator.ts`, `runtimeReadinessProjection.ts` | Advisor, Architect, confidential Runtime, and constitutional Runtime service definitions and orchestration/readiness seams | Preserve service identity and qualification differences |
| `HFTConsole.tsx`, `app/api/moneypenny/quotes/route.ts`, `execution/route.ts` | Inspected HFT/quotes use random data; execution route contains demo behavior | Must not become live execution paths by relabeling or moving them |
| `StrategyBuilder.tsx` | Strategies initialized in local UI state in the inspected version | Reuse visual/editor ideas after reconciling newer persistence and canonical proposal ownership |
| September screenshots | Financial Profile, Understand/Design/Markets/Operate/Monitor sidebar, simulations, research, privacy controls, and rich modal layouts are visible | Locate their current source before building equivalents; verify each backend connection |

**Phase C0 requirement:** On the implementation branch, refresh this inventory against current platform code, the canonical MoneyPenny 002 source, and relevant wallet/provider repositories. Produce a capability-by-capability record: source owner, real service, environment, authorization path, persistence, receipt, limitations. This is reconciliation, not a request to redesign the agreed product.

## 4. Shared interaction contract

The following identifiers are shared with the bridge spec. This document owns their working-surface implementation; the bridge owns how it invokes them.

| ID | Contract |
|---|---|
| SC-01 | One active work context identifies principal/persona, represented agent, provider, domain, task, environment, and current surface. The server verifies identity and authority. |
| SC-02 | Navigation or a chip can select a surface or propose work. Neither grants authority nor completes an evidenced journey stage. |
| SC-03 | One canonical financial profile is referenced across Prepare, Operate, direct cartridge entry, and advanced handoff; no copied bridge profile. |
| SC-04 | Both panes consume the same versioned task context and correlated outcomes. Late responses cannot overwrite a different task, agent, or environment. |
| SC-05 | Simulation, replay, and live operation remain distinct in storage, execution, receipts, metrics, and visible presentation. |
| SC-06 | Educational media is a shared content reference with provenance and accessibility metadata. Native Qriptopian Admin → Bridges and authorized agent uploads manage the same assets and versioned placements through the administration companion A-05–A-09. Playback can guide navigation, never grant permission. |
| SC-07 | Existing receipt/state services establish outcomes. An approved proposal or settlement intent is never rendered as a completed transfer. |
| SC-08 | Intermediary-to-advanced handoff carries references and intent; Horizen re-evaluates its own admission and service requirements. |
| SC-09 | The host and embedded cartridge coordinate copilot ownership so one active conversation is presented; nested duplicate copilots are suppressed. |
| SC-10 | Principal, wallet, agent, task, and environment isolation survives refresh, account changes, embeds, and full-screen transitions. |

### Workspace behavior — C-01

- Desktop default: copilot left, approximately 35–40% width; action space right, approximately 60–65%, using existing layout constraints and resizable behavior where supported.
- One shared top-level menu. Contextual sub-navigation may appear for the selected area; do not retain a competing full capability sidebar.
- Copilot contains conversation, voice/media, quick prompts, and quick links. The right pane contains selected capsules and a short contextual action strip.
- Clicking a quick link navigates in the same workspace. An explicit external-provider action may leave it only where that action requires an external surface.
- The stage strip belongs to the active task. In a bridge embed, the bridge owns the domain-stage strip; a clearly subordinate profile/task stepper may appear within the capsule. Avoid two competing global steppers.
- At narrow widths, switch between Conversation and Workspace views over the same context; preserve task state and show a return affordance. Do not squeeze two unusable columns.
- Full-screen trading or analysis is an in-place takeover. Escape/back restores the earlier layout, selection, scroll position, and conversation. Operational controls, environment, acting agent, and stop/pause remain accessible.

### Copilot-to-capsule loop — C-02

1. A person asks a question or selects a chip.
2. The shared copilot proposes an applicable layout/action using registered identifiers.
3. The host opens the relevant capsule with bounded context.
4. The person edits assumptions, reviews information, or confirms a proposal.
5. The canonical service processes any authorized operation.
6. The resulting state/receipt updates the capsule, conversation context, and journey projection.

Financial layout identifiers must extend the existing typed suggestion system or its current registry successor. Unknown identifiers show a recoverable unavailable state. Free text and model-generated links must not bypass the registered action dispatcher.

## 5. Information architecture — C-03

| Main area | Primary capsules | Natural questions |
|---|---|---|
| Home | Financial brief, current journey, pending decisions, next actions, specialist access | Where am I? What needs attention? |
| My Money | Statements, financial profile, accounts/wallets, income/spending, commitments, debt, transfers/payments | What do I have? What is committed? What can I use? |
| Plan | Goals, budget, savings/reserves, debt repayment, scenarios, longer-term planning | What am I trying to achieve? How do the assumptions change it? |
| Markets | Learning/research, holdings context, investment, trading, route comparison, strategy rehearsal, HFT workspace | What am I considering? What are the costs and possible outcomes? |
| Activity | Proposals, approvals, delegations, transactions, receipts, performance, execution review | Who did what? What happened? What should change? |

Use All / Fiat / Crypto filters where they clarify a combined view. Do not create separate identities, financial profiles, or agent relationships for fiat and crypto.

Account/privacy settings, connections, and privileged administration remain contextual utility access. Administration is permission-gated; it is not a sixth beginner journey. Advanced agent operations can be exposed within the relevant work area after qualification without forcing new users through agent registries.

### Existing-surface relocation

| Existing surface | Destination and treatment |
|---|---|
| Financial Profile / banking documents / privacy panel | My Money; reused by Prepare |
| MoneyPenny chat and MetaVatar | Persistent copilot; coordinated voice/avatar/media controls |
| Research, Learn/Explain | Contextual teaching plus Markets research; references preserved |
| HFT Console / Market Console | Markets; evidence-based live or explicitly simulated presentation |
| Strategy Builder / Trading Intents / Risk & Limits | Markets strategy and Plan/risk capsules over canonical proposals |
| Portfolio / performance | Holdings in Markets/My Money and outcome analysis in Activity; one source |
| Live Insights / Decisions / Memory | Activity review; retain provenance and execution-versus-interpretation distinctions |
| X402 settlement | My Money task entry and Activity settlement status; preserve native service terms |
| FIO identity / wallet addressing | My Money connections and account settings |
| CRM | Contextual relationships; privileged business/service management where applicable |
| Architect / Runtime panels | Registered working capsules entered by task; mode shown in context |
| Service Orchestration | Advanced Activity/agent-operations workspace; not the intermediary landing page |
| SmartTriad overview | Reuse useful summaries in Home, with verified data and functioning links |

Preserve existing deep links through aliases/adapters. Changing a label does not authorize renaming persisted service IDs, wallet asset codes, agent IDs, or receipt references.

## 6. Financial profile and preparation — C-04 to C-06

**C-04: Ingestion.** Support existing PDF/CSV paths and extend scanned-statement/OCR handling where missing. Provide source selection/upload, processing progress, account/period recognition, confidence and exception review. Do not promise six months of completeness when fewer periods exist. Provide manual entry for a limited profile and sample data for learning, visibly distinguished from personal evidence.

Treat uploaded documents as data, not instructions to the copilot. Enforce existing file permissions and processing boundaries. Raw statements are not automatically sent to every specialist or placed in analytics events.

**C-05: Review and computation.** Detect duplicate and overlapping statements; distinguish transfers from income/spending; handle account currency, date conventions, sign conventions, missing balances, recurring commitments, and uncertain classifications. Make aggregates traceable to source records. Flag partial coverage rather than filling gaps with plausible data. Corrections produce a new profile version and invalidate dependent proposals where their assumptions changed.

Do not infer the person's willingness to accept investment risk from surplus or bank activity. Explain observed capacity separately and ask for relevant preferences when the task requires them.

**C-06: Profile readiness.** The person reviews their financial picture and confirms what is understood or incomplete. Store/reuse canonical references for source documents, reviewed profile version, coverage, goals, consent choices, and review time. This is preparation evidence, not permission to trade. A limited profile can support appropriate tasks; sensitive-document upload is not a prerequisite for watching educational content or exploring public research.

The product must expose how raw documents, aggregates, and excerpts are used. Redacted excerpt access is a distinct choice. Apply the platform's actual encryption, deletion, retention, and access controls; do not label information sealed or confidential without backing from those controls. Determine the applicable existing retention/deletion service in C0 rather than inventing a parallel store.

## 7. Agency and authority — C-07 to C-09

### Actor model

| Role | Responsibility |
|---|---|
| Human principal | Defines intent and authorizes applicable delegation/actions |
| Agent Me | Constitutional companion; coordinates the person's wider work within granted authority |
| MoneyPenny | Financial specialist; advises, designs, and acts only under applicable authority |
| Additional specialist | Introduced for a concrete need; admission, scope, provenance, and authority are verified |

**C-07:** Show an understandable actor summary at consequential decisions: on whose behalf, which agent is requesting, which provider is serving, proposed action, data shared, limits, and how to pause/revoke. Direct MoneyPenny interaction and Agent Me-mediated interaction preserve the same principal and distinguish the requesting agent from the provider.

**C-08:** Advisor returns explanations; Architect produces proposals; Runtime carries authorized operations through existing services. Read-only, proposal, and money-moving scopes remain distinct. A lesson, chat response, financial profile, experience level, or successful simulation cannot authorize a transfer. Onward delegation is permitted only within explicitly applicable authority.

**C-09:** Intermediary presentation does not waive existing service admission or eligibility requirements. For a beginner, use a properly established Agent Me/MoneyPenny service relationship and resolve any required prerequisites through the actual platform. Do not fabricate an admitted agent, sponsor, Standing score, or principal binding to simplify the journey. If the current APIs cannot support the intended beginner relationship, record the adapter/service extension and keep the affected action unavailable until it is implemented correctly.

Keep system readiness, provider readiness, requesting-agent eligibility/Standing, current mandate, and confidential assurance separate. Preserve confidential and constitutional Runtime service identities. A missing confidential attestation does not disable unrelated non-confidential capabilities; a non-confidential service cannot be mislabeled confidential to conceal that absence.

## 8. Experience depth, mode, and environment — C-10

These are independent dimensions:

| Dimension | Values / meaning |
|---|---|
| Threshold/depth | Entry, intermediary, advanced; plus task-relevant guidance preferences |
| Financial area | My Money, Plan, Markets, Activity |
| Provider mode | Advisor, Architect, Runtime |
| Execution environment | Simulation, replay, live; live data may support a simulation but must be labeled as such |
| Authority state | Current policy outcome for the exact action, principal, agent, and mandate |

A complex strategy can be simulated at intermediary level. A tightly limited live exercise may use explicitly approved short-lived automation. Sustained agent operations and third-party service provision belong to the advanced journey. No amount threshold alone makes an action authorized, and no global expert toggle overrides service qualification.

For any authorized automated session, expose the exact agent, strategy/proposal version, permitted actions/assets/venues, amount and cumulative budget limits, duration/expiry, operating schedule, applicable loss/exposure constraints, oversight and stop conditions. Enforce the applicable limits and revocation server-side, including concurrent requests; a client-side slider is not the control boundary. Use the existing governed job/execution mechanism. Closing the viewport must not silently stop required monitoring/reconciliation, and reopening it must not restart an operation. Sustained automation remains attributable to human authority, not an agent acting as an independent principal.

## 9. Simulation and bounded live activity — C-11 to C-13

**C-11: Simulation.** Inspect and reuse the MoneyPenny 002 simulation implementation if it is fit for purpose. Every session records source data, time horizon, assumptions, initial balances, fee/slippage model, strategy version, and outcome. Use reproducible scenarios or recorded data for meaningful comparison. The existing random console can only be an identified illustration until replaced/adapted; random numbers are not backtesting evidence.

Simulation balances, orders, execution records, and performance cannot enter live ledgers or live Standing projections. Resuming or expanding the view preserves simulation labeling. A live-data simulation still has simulated fills. Evidence replay identifies the original period and provenance.

**C-12: Live exercise.** Where a verified route supports it, the person may choose a small actual amount, such as 1,000 Q¢ ($10 reference value before fees). Show asset quantity, reference/market value, fees, expected receipt, price source/freshness, applicable limits, and total exposure together. Small monetary scope is not a claim of guaranteed safety or returns. Never emphasize large token counts to obscure actual value.

Simulation-to-live transition creates a new reviewed proposal with fresh executable terms and live authority checks. Reuse ideas and strategy versions, never simulated funds, fills, or execution consent.

**C-13: Lifecycle.** Distinguish proposal, authorized intent, submitted operation, provider acceptance, partial execution, settlement pending, settled, failed, cancelled, and reconciliation-required outcomes according to each actual service. Requests use existing idempotency/receipt mechanisms. A timeout yields unknown/pending until reconciled, not an automatic repeat payment. Stop/pause prevents further work under its defined scope; it does not claim to reverse a finalized transaction.

## 10. Asset and denomination model — C-14

Canonical public spellings: **QriptoCENT**, **Bitcent**, **KNYT COYN ($KNYT)**. Existing code identifiers remain unchanged unless a separately scoped migration requires it.

| Subject | Evidence and required treatment |
|---|---|
| Q¢ pricing/display unit | Inspected `credit-from-usdc` code uses 1 USDC = 100 Q¢. Teach/display 1,000 Q¢ = $10 reference value before costs; distinguish reference conversion from a guaranteed market redemption |
| Bitcent and Base Q¢ | Inspected settlement contract defines 1 B¢ = 1 Base Q¢ at one cent of reference value, with explicit fees and literal protocol parity `1:1` |
| Cross-denomination settlement | Existing model uses authenticated inter-ledger settlement with native destination liquidity, not wrapped-token lock/mint bridging; settlement itself does not create issuance |
| KNYT COYN ($KNYT) | Operator discussion stated 0.005 ETH; inspected `knytPricingService.ts` contains `KNYT_ETH_RATE = 0.0005`. Resolve this tenfold mismatch against current canonical pricing before numeric education or execution |
| Asset rights and stability | Price quotation, denomination, backing, redemption, settlement network, and ownership rights are distinct fields. ETH linkage is not USD stability; do not label the asset equity without established rights |

An arbitrage capsule must distinguish protocol settlement parity from external market observations. It must not insert a fluctuating exchange rate into the canonical Bitcent/Base Q¢ settlement path. An external price discrepancy is a candidate opportunity only if executable venue quotes, liquidity, fees, transfer timing, and both legs support it. Model partial-leg exposure and failed settlement; do not imply automatic atomicity across Bitcoin and Base.

The older local ledger and settlement code include simulation-only Bitcent paths. That is evidence about those paths, not a conclusion that current live Bitcent infrastructure elsewhere is absent. C0 must trace the current canonical implementation and actual route. Each asset/route's UI readiness is independent.

Arithmetic uses canonical minor units and decimal-safe representation; no binary-float money arithmetic in new execution/projection logic. Reference prices and market prices retain source, timestamp, denomination, and quality indicators.

## 11. Conversational video and structured learning — C-15

Extend the shared copilot message/media path after inspecting the existing metaMe runtime player integration. The capability belongs to the common framework, not a MoneyPenny-only iframe workaround.

Required message-level behavior:

- Inline playable video with poster, title, duration, captions, transcript, accessible controls, and source/content version.
- User-controlled playback; coordinated voice/TTS so narration and video do not speak over each other.
- Pause and ask about the current segment; send bounded asset/chapter/timestamp context to the copilot.
- Explicit chapter chips can open a related right-pane capsule while preserving the conversation. Playback alone does not initiate financial operations.
- Resume playback position when returning to the message; stop playback on principal/session change.
- Unavailable video presents a transcript or other available equivalent with an honest error state.
- Informational videos use published content references; private material requires the appropriate viewer authorization.

The right pane hosts accurate charts, tables, diagrams, calculators, and infographic panels. Monetary charts derive from the displayed dataset and assumptions. Do not use generated bitmap numbers as authoritative financial data. Illustrative imagery can accompany educational diagrams, but numerical/relationship-heavy graphics should be rendered from structured content.

Shared content contract: content ID/version, domain, learning objective, intended stage, media kind, source/provenance, captions/transcript, related capsule/action IDs, prerequisites for any action, and review status. This is a proposed extension to existing content ownership, not a second media CMS.

### Native educational content administration — C-17

Use the platform-native Qriptopian cartridge **Admin → Bridges** for educational copy and assets used by MoneyPenny journeys. Do not add a second editorial CMS to MoneyPenny or use the thin-client admin as the implementation home. Existing financial service/operations administration retains its own authority and purpose.

The third specification, [Qriptopian Native Bridge Content Administration](Qriptopian_Bridge_Admin_Spec_v1.md), owns asset upload/selection, versioned bridge placements, preview, publication, and the authorized agent/Studio workflow. Cartridge C-15 consumes the published shared references in the copilot and action pane. The same lesson asset can be reused by a bridge without copying files or maintaining a second catalog. Private profile/statement uploads remain outside this editorial path.

Upload success does not establish bridge publication. Renderers must resolve the intended published placement; preserve thumbnail relationships, accessibility metadata, actual delivery status and existing task context. Unknown future presentation primitives stay disabled.

## 12. State ownership and integration seams — C-16

The implementation maps these conceptual fields to existing types/services after C0. This table is a contract, not a declaration that new tables are required.

| State | Owner | Projection / rule |
|---|---|---|
| Principal, persona, wallet, agent identities | Existing identity/persona/wallet spines | Verify server-side; no model-invented identifiers |
| Journey instance/version and stage | Journey runtime and resolver | Both panes/bridge consume one projection; navigation is not evidence |
| Financial profile and source references | Reconciled canonical profile/document service | Versioned reference, coverage, correction history, consent |
| Financial task | Existing task/intent/artifact owner extended as needed | Task ID, domain, selected capsule, proposal version, outcome refs |
| Delegation/mandate | Constitutional authority/agreement service | Read current scope, expiry, revocation, permitted onward delegation |
| Operations and receipts | Existing executors, wallets, receipts and reconciliation | Distinguish intent from final settlement; exactly-once handling |
| Simulation session | Reconciled simulation owner | Environment-scoped, separate from live balances and evidence |
| Copilot context | Host projection into shared copilot | Minimum necessary data; principal + domain + agent + task + environment isolation |
| Educational content | Existing content registry/runtime | References, permissions, versions and provenance |
| Display preferences | Existing presentation state | Layout, active capsule, playback position; no authority meaning |

The inspected shared copilot persists messages with a persona-based key. Verify current conversation scoping before reuse so different agents/domains or simulation/live tasks do not inherit misleading context. Extend the shared session owner rather than adding disconnected MoneyPenny histories.

Known service seams to reuse include `/api/moneypenny/chat`, `/architect`, `/runtime`, `/service-orchestration`, the constitutional agreement route, existing wallet services, and Journey Spine state routes. Route names alone do not certify production readiness. Do not promote the inspected demo `/quotes` and `/execution` endpoints into the new live path.

## 13. Delivery sequence and bridge dependencies

| Phase | Cartridge deliverable | Bridge dependency / exit evidence |
|---|---|---|
| C0 | Current-source reconciliation; route/capability ledger; asset-rate discrepancy resolution | B0 can map existing stages and references; live claims remain gated by evidence |
| C1 | Shared shell, menu, scoped context, copilot/capsule interactions, full-screen return | B1 embeds one cartridge and verifies copilot ownership |
| C2 | Profile preparation, correction, goals, privacy choices, resumable state | B2 Prepare uses the same profile and stepper contract |
| C3 | Educational media integration, planning, research, reproducible simulations | B2 Discover/Learn/Explore content invokes real registered capsules |
| C4 | Verified bounded live task and accurate receipt/reconciliation presentation | B3 Operate can offer that exact supported task; readiness remains per route |
| C5 | Advanced handoff and qualified operations workspace | B4 Cross invokes the existing Horizen journey with preserved references |
| C6 | Pilot review, navigation retirement/aliases, common-template documentation | B5 validates CI/KNYTS parity and reusable domain pattern |

Do not call C4 complete with a simulation or intent-only result. A blocked live route can coexist with released learning/planning features, but the specification's live acceptance requirement remains open and visible.

Content-administration phases A0/A1 run with C0/C1; A2 supplies asset selection and publication for C2/C-15; A3 connects agent uploads; A4 is included in C6/B5 release verification. Reuse the shared media publication canary rather than implementing another uploader.

### Concrete first vertical slice

Dele enters through Agent Me or directly, prepares/reviews a financial profile, identifies one goal, asks MoneyPenny to explain the relevant concept with inline video, opens its structured capsule, rehearses a small exchange, and—only on a verified available route—reviews and authorizes a bounded real task. Activity shows the true outcome. Dele returns later and resumes with the same profile and context. No advanced agent deployment is required merely to learn or plan.

## 14. Acceptance criteria

| Test ID | Scenario and required evidence |
|---|---|
| AC-C01 | Direct, Agent Me, and bridge entry reach the same cartridge/profile; one visible copilot; current actor remains clear |
| AC-C02 | Selecting a tab/chip opens the expected capsule; editing it changes the next copilot's bounded context without copying raw statements unnecessarily |
| AC-C03 | Late responses after agent/task/environment changes cannot populate or execute in the new context |
| AC-C04 | Refresh and full-screen exit preserve task, environment, selected surface, and conversation; mobile alternation uses the same state |
| AC-C05 | PDF/CSV and scanned-statement fixtures exercise duplicates, transfers, partial periods, currencies and uncertain classifications; corrected totals are traceable |
| AC-C06 | Declining raw-document access permits appropriate learning/manual-profile work; unauthorized principal cannot read another profile or media |
| AC-C07 | Profile correction invalidates stale dependent proposals; review readiness never grants trading authority |
| AC-C08 | Advisor/Architect outputs cannot move funds; service calls independently reject missing, expired, revoked, mismatched or insufficient authority |
| AC-C09 | Beginner presentation still enforces real service admission/eligibility; confidential-attestation requirements remain scoped to the correct service |
| AC-C10 | Simulation/replay records never mutate live balances or live Standing; live-data simulation retains simulated-fill labels |
| AC-C11 | Live transition obtains fresh terms and authorization; replayed request/idempotency key cannot create a second operation; concurrent requests cannot exceed applicable cumulative caps |
| AC-C12 | Timeout, rejected quote, partial execution, and pending settlement render honestly; an intent receipt never appears as settled funds |
| AC-C13 | Monetary display uses correct denomination and explicit fees; KNYT pricing mismatch is resolved before its numerical live examples are enabled |
| AC-C14 | Bitcent/Base settlement preserves reference parity and exactly-once destination credit; market observations cannot alter protocolRate |
| AC-C15 | Inline video plays in the conversation, offers captions/transcript and pause/question, opens a related capsule through an explicit chip, and survives normal return navigation |
| AC-C16 | Screen reader/keyboard can navigate panes and media; focus returns after overlays; reduced-motion alternative exists for trading animation |
| AC-C17 | Existing HFT, Architect, Runtime, X402, FIO and orchestration deep links resolve through documented aliases with unchanged underlying authority semantics |
| AC-C18 | Cross preserves references and context while Horizen independently verifies admission; returning preserves profile/work; closing the UI neither disables required reconciliation nor restarts a governed operation |
| AC-C19 | The complete first-use slice is observed with Dele; record points of confusion, successful tasks and genuine outcome evidence rather than inferred learning |
| AC-C20 | Media published through native Qriptopian Bridges or an authorized agent resolves to the same asset/placement in MoneyPenny copilot and capsules; private profile documents and financial authority remain separate |

These are required implementation tests, not tests claimed to have run during specification authoring. Prefer behavioral and end-to-end cases that detect isolation, authority, state, or settlement failures; reuse existing suites where they already cover the invariant.

## 15. Measurement and release decisions

Measure time to reviewed profile, correction rate, resumptions, successful first useful task, video-to-capsule transitions, explainable refusals, simulation-to-reviewed-live transitions, and outcome comprehension. Instrument only permitted metadata; raw financial documents and sensitive prompt contents do not belong in generic telemetry.

Operational measures include quote freshness failures, duplicate-request prevention, unresolved settlements, actor/context mismatches, and completion confirmed by real receipts. Transaction volume, profitable simulation, video completion, and higher token counts are not proxies for trust or learning.

### Dependencies that must be closed, without blocking specification delivery

| ID | Dependency | Resolution owner / consequence |
|---|---|---|
| D-01 | Local source predates screenshots and current deployed implementation | Implementer reconciles current platform/Lovable/canonical repositories in C0 |
| D-02 | KNYT 0.005 vs 0.0005 ETH discrepancy | Current canonical pricing authority and operator resolve; numerical content and trade quotes use one verified source |
| D-03 | Current Bitcent/Base/KNYT executable routes and settlement evidence | Wallet/settlement owners verify per route; no global live badge from a balance or UI button |
| D-04 | Existing statement/OCR/profile ownership and MoneyPenny 002 simulation quality | Locate/reuse current source; extend gaps instead of cloning visible screens |
| D-05 | Beginner Agent Me/MoneyPenny relationship against present admission APIs | Identity/authority/service owners verify supported binding and gates |
| D-06 | Existing inline runtime media integration and shared session scoping | Shared copilot/content owners verify and extend common implementation |
| D-07 | Existing policy for persistent storage, deletion, private-media access, and data sharing | Use platform-owned controls and expose their actual behavior |
| D-08 | Native bridge editorial migration and upload-to-placement integration | Administration companion A0–A4 reconciles current writers, authorization, media delivery and shared publication; no second CMS |

## 16. Correlation and implementation handoff

| Cartridge requirements | Companion bridge sections |
|---|---|
| C-01–C-03, SC-01/02/04/09/10 | B-03 host composition and B-04 common content/stage model |
| C-04–C-06, SC-03 | B-08 Prepare and B-12 authoritative state |
| C-07–C-10 | B-02 thresholds, B-09 Operate, B-10 Cross |
| C-11–C-14, SC-05/07 | B-07 Explore, B-09 Operate, B-14 readiness/content claims |
| C-15, SC-06 | B-04 through B-07 and the educational asset manifest |
| C-16, SC-08 | B-11 handoff contract and B-13 migration |
| C-17, SC-06 | B-17 and Qriptopian administration A-01–A-10 |

Implementation begins with C0/C1; no deployment, live transaction, pricing change, or new constitutional policy is authorized merely by this document. Preserve the user's current direct-deployment preference when a later implementation release is authorized; do not introduce the legacy QubeTalk relay as a delivery prerequisite.
