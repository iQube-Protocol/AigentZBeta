# Financial Services Bridge and Three-Threshold Journey

**Specification:** MPY-BRIDGE-RECONSTITUTION · **Version:** 1.1 · **Date:** 2026-09-01  
**Companions:** [MoneyPenny Cartridge Reconstitution](MoneyPenny_Cartridge_Spec_v1.md) · [Qriptopian Native Bridge Content Administration](Qriptopian_Bridge_Admin_Spec_v1.md)  
**Status:** Implementation specification for review, derived from the operator-approved direction. It specifies an extension of the existing Journey Spine; it is not evidence that the extension is built or deployed.  
**Delivery order:** Define/build the cartridge's working surfaces first, then compose bridge education, preparation, operation, and advanced handoff from those surfaces. Content planning, journey reconciliation and native administration phases A0/A1 run alongside cartridge work; A2 supplies shared upload and publication before educational population.

**Version 1.1 addition:** B-17 establishes native Qriptopian Admin → Bridges as the editorial home, with shared upload, placement and publication for UI and agent workflows. Existing requirement IDs are preserved.

## 1. Purpose and division of responsibility

The current financial on-ramp presents Discover, Learn, Explore, Prepare, and Cross, but its visible Prepare step selects an agent candidate and its Cross step sends the user toward advanced FS admission. It does not provide the substantial middle period in which a person establishes their financial picture and becomes comfortable working with Agent Me and MoneyPenny.

Introduce **Prepare → Operate → Cross**. Prepare establishes the person's financial profile. Operate is an enduring home for useful, guided financial work, including sophisticated crypto learning, simulations, and bounded live activities. Cross deliberately enters advanced agent operations through the existing Horizen FS journey.

The bridge teaches and coordinates. The MoneyPenny cartridge owns financial working surfaces. Existing constitutional services own authorization, actual operations, receipts, and Standing. The Journey Spine resolves progression from authoritative state; it does not grant authority.

### Document ownership

| This bridge specification owns | Companion cartridge specification owns |
|---|---|
| Three-threshold journey organization | Persistent copilot/workspace shell |
| CI/KNYTS domain entry and presentation | Financial capabilities, profiles, plans and activity |
| Discover/Learn/Explore curriculum | Capsule behavior and shared media integration |
| Prepare/Operate stage composition | Ingestion, computation, proposals and operational calls |
| Stage satisfaction and handoff references | Actor, task, environment and operation isolation |
| Cross into advanced Horizen | Advanced working surfaces over existing services |
| Reusable domain journey configuration | Finance-specific implementation and acceptance |

Shared contracts SC-01 through SC-10 are defined in the companion document and incorporated here. The third companion owns native content administration, media uploads and bridge placements; this document owns curriculum and destination semantics. No document creates a second owner for the same state.

## 2. Three thresholds — B-01 and B-02

### B-01: Common model

| Threshold | Human question | Experience and result |
|---|---|---|
| Entry | What does personhood, sovereignty, representation, and delegation mean for me? | Existing general CI/KNYTS onboarding: Passport and relationship with Agent Me, with explicit delegation where requested |
| Intermediary | How do I work in this domain with my agent and specialist support? | Discover → Learn → Explore → Prepare → Operate → Cross; useful domain work can continue indefinitely in Operate |
| Advanced | How do I authorize sustained operations, coordinate specialists, or provide professional services through agents? | Domain-specific advanced journey; finance uses the existing Horizen admission/qualification framework |

Entry is shared grounding. Each domain has its own intermediary preparation, task experience, and advanced requirements. Financial expertise does not establish research readiness; a writing task does not create trading authority. Founder Operator is a composition of domain work coordinated through Agent Me, not a fourth mandatory threshold.

### B-02: Meaning of depth

The intermediary level includes fiat and crypto finance, holdings, investment, trading, arbitrage concepts, and HFT simulation. It can include sophisticated live tasks or a specifically bounded automated exercise when the exact service, amount, actor and mandate permit it.

The advanced threshold is chiefly about sustained delegated responsibility, continuing automation, agent coordination, and third-party service provision. Do not use a simplistic beginner-versus-complex-product division. A small amount does not eliminate a service's authorization requirements; a complex lesson does not force professional admission.

The threshold names are presentation and journey-organization concepts. They do not replace existing constitutional admission, service eligibility, Standing, or assurance axes.

## 3. Implementation evidence and reusable foundations

Inspected source: `iQube-Protocol/AigentZBeta`, local branch `claude/cs-capstone-estate-and-brief`, commit `f214d2be3` dated 2026-08-25. Inspection date: 2026-09-01. The September 1 screenshots are newer than this checkout; visible differences require current-source reconciliation, not an assumption that the screenshots are wrong or that the local snapshot is live.

| Existing seam | Verified role / reuse |
|---|---|
| `types/journey.ts` | Journey definitions, surface references, prerequisites/evidence, and separate constitutional milestones |
| `components/journey/JourneyRunSurface.tsx` | Shared stage runner, registered component/embed surfaces, foreground overrides, and journey copilot host |
| `services/journey/journeySurfaceRegistry.ts` | Canonical destination descriptors; reuse stable refs and embed behavior |
| `journeyCopilotResolver.ts` | Resolves guide identity from cartridge configuration; fails on unknown identity rather than inventing one |
| `interactionContextAssembly.ts` | Bounded state projection for guidance; recommendations remain distinct from authorization |
| `resolveJourneyState.ts`, `conditionEvaluator.ts`, `stageResolution.ts` | Existing progression/state seams; extend rather than maintaining browser-local completion |
| `constitutionalInternetBridgeJourney.ts`, `knytsBridgeCrossingJourney.ts` | Existing entry journey definitions; preserve their established semantics and references |
| `components/journey/BridgeMediaStage.tsx` and CI/KNYTS media surfaces | Existing video/poster/explainer presentation |
| `components/journey/FinancialServicesBridgeFrontDoor.tsx` | Both FS front-door aliases compose `PilotJourneyTab`; foreground override points at MoneyPenny orchestration for the existing advanced Operate stage |
| `services/journey/horizenMoneyPennyJourney.ts` | Existing advanced admission journey, including Register, Claim, Passport, Activate, Delegate, Operate, Ratify, Ingest and Stand surfaces; preserve exact current semantics |
| `services/journey/agentStateAxes.ts` | Separates admission, factory participation/Standing eligibility, and specialist verification |
| `horizenMoneyPennyJourneyAdapted.ts` | Migration proof artifact in the inspected snapshot; do not assume it is the authoritative active runtime |

The new intermediary Operate must not be implemented by loosening the existing advanced `aigentme` stage or copying its orchestration page. The inspected advanced stage currently has delegation prerequisites and particular completion evidence; it has a different job.

Before implementation, inspect the current branch containing the newer financial extension visible in screenshots, current active stage definitions, and the referenced SPEC-MPY-002 material. Reconcile identity/route compatibility before changing stage order. Keep broad reusable capabilities already built under alternate paths.

## 4. Host composition and navigation — B-03

Use the established bridge frame and Journey Spine. Present only the active stage's primary experience. Maintain a persistent bridge identity, stage indicator, and understandable next action.

- Entry retains the established CI/KNYTS media-led visual grammar and existing Passport/Agent Me surfaces.
- Discover/Learn/Explore use videos, infographics, brief copy and optional focused interaction. They prepare people for actual work.
- Prepare and Operate embed the canonical MoneyPenny split-pane experience with the relevant capsule selected and domain context supplied.
- Agent Me remains the person's constitutional companion. MoneyPenny appears as the financial specialist. Guide identity and any handoff are explicit; never silently switch agents.
- Coordinate host/embedded copilot ownership using existing hosting/suppression mechanisms. Do not show a floating guide plus an unrelated embedded MoneyPenny chat plus another Agent Me conversation.
- Stage navigation can revisit content without resetting financial or constitutional facts. Page navigation is never an authorization event.
- Task-specific substeps such as Upload/Review/Understand are subordinate to Prepare. They do not form a second global threshold bar.
- Focus/full and trading takeovers stay in the same frame with a reliable return. Preserve the principal, task, environment, selected agent, and profile references.
- Users can pause, resume, jump to available learning, or continue using Operate. The framework recommends an order without turning every introductory page into a compulsory gate.

CI and KNYTS use the same financial stage definitions, requirements, and capabilities. Their introductory examples, accents, media selection and narrative emphasis may differ. KNYT COYN ($KNYT) education is available through both; KNYTS may feature it more prominently.

## 5. Common stage and content model — B-04

Each stage defines:

1. The person's question and a concrete learning/task objective.
2. Primary media/content references, including versions and provenance.
3. Registered capsule/surface references and contextual quick actions.
4. Available guide/agent role and bounded context.
5. Actual prerequisites, permissible navigation, task requirements and any evidence-based satisfaction condition.
6. Primary next action, optional deeper exploration, and resume behavior.
7. Honest empty, unavailable, blocked and error states.

Use the common JourneyDefinition/registry/interaction-context model, extending it where necessary after reconciliation. Proposed fields such as domain, threshold and sourceBridge describe the desired contract; they are not a requirement to create new tables or a second routing engine.

Free exploration can be recorded as learning engagement, with that provenance. Do not call it constitutional completion. A watched video, clicked card, selected answer, or hypothetical simulation result is not a mandate or earned operational Standing.

## 6. Discover — B-05

**Question:** What can financial services help me do, and how can my agent help?

**Main experience:** A short visual introduction to financial agency across daily money, planning, markets and activity. Explain Agent Me and MoneyPenny through an everyday example. Avoid presenting four backend service classes as the user's first decision.

| Topic | Visual | Optional interaction |
|---|---|---|
| My financial picture | Income, spending, commitments and available cash | Open an illustrative financial-profile capsule |
| Work toward a goal | A goal and the choices that affect it | Select a goal interest without committing funds |
| Fiat and crypto | Combined financial-life overview | Inspect examples of accounts, wallets and assets |
| My agent and specialist | Person → Agent Me → MoneyPenny relationship diagram, including direct specialist access | Walk through who proposes and who authorizes |

**Primary next action:** Learn how it works.  
**Output:** Optional interests and saved context, never mandatory disclosure of finances.  
**Limits:** No fabricated personal profile, no implied returns, no claim that every pictured service is live.

## 7. Learn — B-06

**Question:** What do I need to understand before preparing and operating?

Organize short modules around the user's chosen interests. Pair video and infographic explanations with "ask about this" prompts. Allow revisiting without making the whole library a prerequisite.

| Module | Essential distinction | Preparation/operation it supports |
|---|---|---|
| Financial position | Balance versus cash flow; income versus transfers; commitments versus available funds | Reviewing statements and profile |
| Person, companion, specialist | Human authority; Agent Me coordination; MoneyPenny specialization | Understanding delegation choices |
| Advice, proposal, action | Advisor explains; Architect proposes; Runtime acts under authority | Reviewing and approving work |
| Fiat, crypto and units | Reference value, market value, denomination, settlement network | Understanding what a balance or quote means |
| QriptoCENT and micro-transactions | Q¢ reference conversion and explicit costs | Small-value practice |
| Bitcent and Base Q¢ | Native ledgers, reference parity, settlement fees and market observations | Route comparison and settlement understanding |
| KNYT COYN ($KNYT) | Verified pricing relationship, uses and rights; ETH/USD exposure where applicable | Holdings, purchase and trading examples |
| Trading mechanics | Quote, spread, slippage, liquidity, fees, pending versus settled | Simulated and bounded live exchanges |
| Delegated operations | Scope, duration, limits, oversight, pause/revocation | Intermediary work and later Horizen entry |

**Primary next action:** Explore an example.  
**Output:** Optional module progress/preferences and questions; comprehension feedback is guidance, not financial suitability or authority certification.

## 8. Explore — B-07

**Question:** What does this feel like in practice?

Open focused interactions from the real cartridge components with example data or a declared simulation environment. Closing an interaction returns to the same stage with progress/context preserved.

| Experience | Interaction | State boundary |
|---|---|---|
| Example financial picture | Select income/spending bars; inspect how a total is derived | Example data is not stored as the person's real profile |
| Savings/planning scenario | Adjust an assumption and compare outcomes | Scenario is a proposal/illustration |
| Denomination explorer | Compare units and reference/market value | No fixed KNYT numerical example until its source discrepancy is resolved |
| Transaction walkthrough | Inspect a quote, cost, resulting balance and receipt | Use a labeled illustration/replay/simulation |
| Trading and arbitrage | Compare executable-route requirements and rehearse a strategy | Simulation has separate balances and performance |
| HFT animation | Observe orders, fills, latency and limits with pause/explanation | Animation renders real session events or an explicitly labeled scenario |

**Primary next action:** Prepare my financial profile.  
**Output:** Saved interests, scenario references and selected next task.  
**Boundary:** Genuine personal financial work is entered explicitly through Prepare/Operate; viewing an example must not call a live transaction endpoint.

## 9. Prepare — B-08

**Question:** What is my financial position, and what do I want help with?

Prepare is financial-profile setup. It does not primarily ask a beginner to choose, build, register or deploy an advanced agent.

Use the MoneyPenny cartridge's profile workflow (C-04–C-06):

1. **Bring information:** select existing records, upload PDF/CSV statements, scan documents, or enter a limited profile manually.
2. **Review extraction:** confirm accounts, dates, currencies and classifications; identify duplicate/overlapping periods and uncertain records.
3. **Understand my position:** inspect income, spending, commitments, holdings, available cash, and coverage limitations with Agent Me/MoneyPenny guidance.
4. **Personalize:** record goals and relevant preferences; show how documents, aggregates and optional excerpts can be used.
5. **Review readiness:** confirm the profile version and next useful task. Display what is incomplete and which tasks that affects.

**Primary next action:** Start operating with MoneyPenny.  
**Output:** Canonical profile reference/version, source and coverage references, review event, goals, consent choices and intended task.  
**Satisfaction:** Actual reviewed-profile state from the owning service, supporting limited readiness where appropriate. File upload alone is not profile review; profile review is not permission to trade.

No raw statement is carried in a URL or copied into bridge state. A person may still access public research or learning without completing personal-profile preparation. The relevant operating task determines how much preparation is actually required.

## 10. Operate — B-09

**Question:** How do I use this to do something useful?

Operate is a continuing workspace, not an obstacle to clear before the "real" product. It reuses the MoneyPenny cartridge and the same profile, plans, agent relationships and activity history as direct entry.

Suggested initial actions:

- Understand a spending pattern or commitment.
- Make or revise a goal plan.
- Ask Agent Me to consult MoneyPenny and explain the result.
- Work directly with MoneyPenny on a financial question.
- Rehearse a transfer/exchange or compare a trading strategy.
- Review and authorize a bounded actual task on a verified route.
- Inspect an outcome/receipt and decide what to change.

Three relationships become familiar through use: the person acting with guidance; Agent Me coordinating a task; MoneyPenny acting as the financial specialist under the applicable delegation. Do not force an artificial sequence if the person already has the necessary relationship and qualification.

Fiat and crypto are available across financial areas. Crypto teaching can use QriptoCENT, Bitcent and KNYT COYN ($KNYT), including sophisticated trading, arbitrage analysis and HFT simulation. Small-value live exercises remain governed actual operations; the label intermediary does not weaken execution rules.

**Primary action:** Continue the selected financial task.  
**Secondary action:** Explore advanced operations with Horizen.  
**Output:** Real task artifacts, proposals, authorized operation references and outcome evidence, according to what the person actually did.  
**Progress semantics:** Individual tasks can complete. Operate itself remains available; do not require a trade, deposit, gain, arbitrary transaction count, or recurring automation to make Cross discoverable.

## 11. Cross — B-10

**Question:** Do I want my agent to undertake advanced financial operations, or provide services to others?

Cross is the advanced threshold. It presents the expanded responsibility clearly, carries forward relevant existing context, and invokes the actual Horizen journey. It does not itself claim admission, qualification, registration, or new delegated authority.

| Advanced path | Intent | Subsequent qualification |
|---|---|---|
| Operate for me | Establish sustained bounded automation or coordinate financial specialists on my behalf | Existing/selected agent and current mandate evaluated under the actual applicable services |
| Provide services to others | Deploy an agent to deliver financial services | Agent control/admission plus provider/service requirements, authority, operations and evidence obligations |

The second path may require extensions to existing provider journeys; do not present it as available simply because the registration UI exists. Expose unavailable requirements honestly and retain the person's intent.

The page shows:

- The selected path, current principal/agent relationship and relevant preparation.
- What the person is asking the agent to do and what new responsibilities are involved.
- Reusable existing facts and requirements still to be established by Horizen.
- **Continue with MoneyPenny** and **Enter the Horizen FS Bridge** as deliberate choices.

Returning to intermediary use is always available subject to ordinary access. A refusal or incomplete advanced requirement does not erase the Passport, profile, valid existing delegation, or completed financial work.

## 12. Handoff contract — B-11

Pass references through the platform's existing navigation and server-owned journey context mechanisms. Do not create a second admission record or treat a client payload as evidence.

| Logical field | Meaning / constraint |
|---|---|
| Source journey instance/version and bridge | CI/KNYTS provenance and return location |
| Domain and threshold | Financial services; intermediary → advanced intent |
| Principal/persona reference | Resolve and verify server-side; commitment/privacy rules follow existing platform contracts |
| Agent Me / selected agent references | Existing identities where present; absence is a real state, not a fabricated agent |
| Intended relationship/path | Own-account automation or provision to others |
| Financial profile reference/version | Reuse only with the required access; no statement payload in navigation |
| Task/proposal reference | What the person wants to continue; not an execution instruction by itself |
| Existing mandate references | Inform the destination; revalidate current validity and scope |
| Environment | Preserve simulation/replay context explicitly; never silently promote to live |
| Evidence references | Canonical receipts/facts for the destination to verify |
| Return context | Same intermediary task and capsule on return |

Changing an agent, mandate, amount, environment or proposal after review invalidates the applicable approval state. Horizen selects the next genuine requirement from current authoritative state; it does not replay already-established ceremonies or skip missing ones based on a "crossed" flag.

## 13. State and satisfaction rules — B-12

| Stage type | How to represent it | What must not happen |
|---|---|---|
| Discover/Learn/Explore | Available/current/revisitable; optional engagement evidence with provenance | Turning views into constitutional proof or compulsory blanket gates |
| Prepare | Profile readiness/coverage/review projected from its owner | Independent bridge copy or completion on upload click |
| Operate | Persistent destination with task-level states and real outcomes | Global "done" state that forces the person onward |
| Cross | Advanced intent/handoff status plus observed destination state | Claiming registration/delegation because navigation occurred |
| Advanced stages | Existing Horizen evidence and service requirements | Replacing domain-specific qualification with a lesson score |

Keep learning progress, profile readiness, task status, admission, participation, service eligibility, current authority, Standing and assurance distinguishable. Existing historical constitutional facts do not regress because another axis fails. Current authorization can expire or be revoked and must still be rechecked.

Use one authoritative journey projection. Client preferences may remember selected stage, open capsule or playback position; they cannot satisfy evidence conditions. Refresh, browser history and account switching must not fabricate completion. Handle unavailable state separately from false/zero state.

The existing `agentStateAxes.ts` separates admission, factory participation/Standing eligibility and specialist verification. This specification retains those distinctions. Standing accrues only under existing qualifying-action rules; neither watching content nor simulating gains invents Standing.

## 14. Migration and compatibility — B-13

1. Inventory the active CI/KNYTS financial extension, stage IDs, persisted evidence, destination aliases, current front-door behavior and screenshot-era additions.
2. Preserve entry-stage identities and real receipts. Public names and ordering do not justify wholesale renaming of stored keys.
3. Reconstitute the current financial Prepare presentation into profile setup. A previously selected agent candidate can be retained as an optional advanced preference; it cannot count as a reviewed financial profile.
4. Add intermediary Operate with its own scoped stage identity in the financial extension. Do not reuse the advanced Horizen `aigentme` stage as the same entity simply because both display Operate.
5. Evolve Cross into the two-path advanced handoff; retain the existing advanced FS route aliases and canonical journey definition.
6. Map old deep links to the appropriate new stage/capsule. A pre-existing Cross navigation event is not proof of advanced admission.
7. Existing admitted users can open advanced operations directly where qualified. Do not make them repeat the introductory curriculum.
8. Existing returning intermediary users resume their last task using profile and task references; browser-local state alone cannot establish readiness.
9. Roll out the new presentation using the platform's existing release/configuration mechanism. Reverting the presentation must preserve profiles, receipts, mandates and operations; it must not reset constitutional state.

### Capability availability and teaching claims — B-14

Discover and Learn can explain broader financial concepts, but any "try it" or live CTA derives from actual capability readiness. Each experience declares informational, simulation, replay, live read, or live action status. Declaring a whole cartridge connected is insufficient evidence that every feature is live.

The companion spec's D-01 through D-07 are shared dependencies. In particular:

- The inspected KNYT price constant is 0.0005 ETH versus the discussion's 0.005 ETH. Numerical graphics and execution must use a resolved, current canonical source.
- Bitcent/Base Q¢ reference parity must remain distinct from market prices and fees. Do not teach protocol-rate arbitrage that contradicts the settlement contract.
- Local HFT/quote/demo execution paths are not live-market evidence; newer routes and MoneyPenny 002 require inspection.
- No bridge copy promises sealed statements, confidentiality, settled transfers, profitable arbitrage, or a working live route unless its source supports that claim.

These dependencies constrain the affected feature/content release; they do not prevent the shared shell, profile work, or broader curriculum from being specified and built.

## 15. Educational asset manifest — B-15

The following are production briefs, not claims that assets already exist. Reuse suitable CI/KNYTS materials first. Produce new content only for genuine gaps. Store one versioned asset per concept with CI/KNYTS presentation variants where useful.

| Asset ID | Topic and learning objective | Format / paired capsule | Stage |
|---|---|---|---|
| FS-M01 | Your financial life: connect income, commitments, goals and choices | Short video + structured overview infographic / sample profile | Discover |
| FS-M02 | You, Agent Me and MoneyPenny: understand representation and specialist help | Video + actor/authority diagram / role walkthrough | Discover, Learn |
| FS-M03 | Reading your financial picture: distinguish cash flow, balances and transfers | Video + interactive bar chart / profile review | Learn, Prepare |
| FS-M04 | Fiat, crypto, stablecoins and micro-units: distinguish reference value from market exposure | Explainer + denomination graphic / converter | Learn, Explore |
| FS-M05 | QriptoCENT, Bitcent and Base Q¢: explain native ledgers, parity and fees | Structured diagram + optional narration / settlement walkthrough | Learn, Explore |
| FS-M06 | KNYT COYN ($KNYT): verified use, rights, price relationship and exposure | Video/infographic / asset card | Learn, Explore; gated on canonical facts |
| FS-M07 | A transaction from quote to receipt: show costs and pending/final outcomes | Video + annotated receipt / transaction rehearsal | Explore, Operate |
| FS-M08 | Arbitrage and HFT: distinguish apparent spread, executable opportunity and net result | Pauseable animation + cost/route panel / simulation | Explore, Operate |
| FS-M09 | Prepare your profile: explain processing, corrections and data choices | Inline walkthrough / upload-review capsule | Prepare |
| FS-M10 | From one task to continuing delegation: understand limits and oversight | Video + mandate diagram / advanced readiness review | Operate, Cross |

For every asset, supply title, objective, duration where applicable, version, source/canonical references, captions/transcript, accessible alternative, target stage, related capsule IDs, review status and availability prerequisites. Pricing graphics use structured data/configuration; avoid baked-in stale market values. Publish matching text/audio/visual meaning.

Inline conversation playback follows cartridge C-15. In media-led stage layouts, use the same content references. The educational story must remain understandable if video cannot play. Modal interactions answer one focused question and return to the stage; they must not recreate a whole parallel application.

### Native bridge content administration — B-17

Manage this curriculum through **platform-native Qriptopian cartridge → Admin → Bridges**, as specified in [Qriptopian Native Bridge Content Administration](Qriptopian_Bridge_Admin_Spec_v1.md). The Bridges tab selects each registered bridge and its journey/stage/slot. CI and KNYTS modal editors migrate there with their existing copy, media and defaults preserved. The intermediary financial-services sequence and advanced Horizen editorial slots use the same framework; advanced stage identities and gates remain unchanged.

The native editor reuses article/Codex asset tools and the existing content-upload primitive, including Auto-Drive/Autonomys and Supabase paths where applicable. A shared placement service connects asset identity to the actual journey slot. The FS-M01–FS-M10 briefs are content work items, not new storage types. Video, infographic, animation and thumbnail publication must be observable in the actual bridge renderer and cartridge media view.

Studio or an authorized connected agent can create/upload an asset and place/publish it through the same service when instructed and authorized. An upload receipt alone is not a publication receipt. Keep published/draft state, versions, accessibility metadata, actor and failure evidence aligned between the native editor and agent tools. Richer presentation primitives and microservices remain disabled extension points for later work.

Routine content publication requires no bridge code redeployment after the integration ships. Public playback and editorial operations never alter progression evidence, Passport, delegation, Standing or financial-operation readiness.

## 16. Reusable domain pattern — B-16

| Domain | Domain copilot | Prepare artifact/context | Intermediary Operate | Advanced direction |
|---|---|---|---|---|
| Finance | MoneyPenny | Financial profile and goals | Plan, research, transact, review | Sustained agent operations; service provision |
| Development | DevOn | Intent, code/project context, constraints | Design, implement, validate | Governed development orchestration and deployment |
| Research | Research Copilot; name pending | Question, sources, methods and permissions | Investigate, experiment, evaluate | Advanced programmes and specialist coordination |
| Writing/creative | Quill | Brief, audience, source material and rights | Draft, revise, produce, publish | Coordinated production and creative services |
| Marketing | Marketa | Positioning, audience, assets and permissions | Develop campaigns and review results | Sustained campaign operations and services |

The table identifies reuse targets, not simultaneous build commitments. Implement finance first; document the shared configuration contract so a subsequent domain uses the same runner, media, chips, capsule host and state principles. Domain-specific qualification and work artifacts remain owned by that domain.

The research/IRL and DevOn branches should consume the same transferable person/agent context and link back to their own canonical journeys. They do not need finance-specific balances, trading qualification, or Horizen admission to perform unrelated work. Advanced research experiments conducted within a financial runtime remain subject to both the experiment's and financial service's applicable requirements.

Candidate architectural refinement: this three-threshold domain pattern. Candidate capability: shared inline educational video coordinated with capsules. Candidate experiment: whether the MoneyPenny first-use journey improves independently demonstrated understanding and successful bounded task completion. This specification records these candidates; it does not claim they were registered into the separate prospective-evolution pipeline or ratified as invariants.

## 17. Correlated implementation phases

| Phase | Bridge work | Cartridge dependency | Exit evidence |
|---|---|---|---|
| B0 | Reconcile active stages/routes and preserve existing evidence semantics | C0 | Current-source mapping and compatibility plan |
| B1 | Register intermediary domain composition and reusable host contract | C1 | CI/KNYTS open the same scoped cartridge with one copilot |
| B2 | Build content references and Discover/Learn/Explore; embed profile Prepare | C2/C3 | Media/capsule continuity and reviewed profile readiness |
| B3 | Establish enduring Operate and first-use journey | C3/C4 | Useful task completion; live task only when backed by actual route and receipts |
| B4 | Cross with two advanced intents and return path | C5 | Existing facts reused; missing qualification remains visible; no authority by navigation |
| B5 | Validate both bridges, returning users, advanced users and reusable template | C6 | Acceptance evidence and documented next-domain configuration |

Administration phases A0/A1 run alongside B0/B1; A2 is a dependency of content population in B2; A3 enables agent/Studio delivery; A4 validates destination coverage alongside B5/C6. Preserve the native editing home and compatibility mappings before retiring modal editors.

Pilot with Dele as the first beginner operator. Observe where explanations fail, which financial questions arise, and whether the person can describe the actor, asset/value, action, costs, limits and outcome. Do not infer competence solely from completing the visual stepper.

## 18. Acceptance criteria

| Test ID | Scenario and required outcome |
|---|---|
| AC-B01 | CI and KNYTS expose the same financial Discover/Learn/Explore/Prepare/Operate/Cross sequence with narrative variants and matching functionality |
| AC-B02 | Entry Passport/Agent Me facts and existing delegation remain intact; selecting a domain does not silently create authority |
| AC-B03 | Each introductory stage has a distinct purpose, suitable media/text equivalent, focused exploration and clear next action |
| AC-B04 | Closing media/modals or returning from full screen restores the correct stage, context and playback/selection state without duplicate copilots |
| AC-B05 | Prepare opens the canonical financial-profile workflow; uploads/corrections become the same reviewed profile in direct MoneyPenny and Operate |
| AC-B06 | Limited/manual preparation and missing statements yield honest task-specific readiness, not invented balances or universal exclusion |
| AC-B07 | Educational browsing and public research are not gated behind an irrelevant personal-statement upload or advanced agent deployment |
| AC-B08 | Operate remains usable indefinitely; no obligatory trade, profit, funding amount or automation is required to discover advanced options |
| AC-B09 | A sophisticated intermediary simulation remains clearly simulated; a live task is checked against real service/actor/mandate requirements |
| AC-B10 | Cross distinguishes own-account advanced operation from providing services to others and identifies unavailable requirements accurately |
| AC-B11 | Handoff verifies identity and authority server-side, reuses profile/agent/evidence references, and retains environment and return context |
| AC-B12 | A failed advanced verification cannot erase entry facts, intermediary profile or valid existing work; expired authority still prevents prohibited actions |
| AC-B13 | Navigation/video/learning events cannot grant Standing, registration, profile readiness, delegation, or settlement completion |
| AC-B14 | Old deep links and returning users resume through explicit mappings; a prior agent candidate selection does not become a completed profile |
| AC-B15 | Existing advanced users reach qualified work without repeating introductory content; intermediary Operate does not alter advanced stage IDs/requirements |
| AC-B16 | Screens remain usable with keyboard/screen reader, captions/transcripts, reduced motion, narrow viewport and unavailable media |
| AC-B17 | Content uses Bitcent and KNYT COYN ($KNYT), resolved denomination/pricing facts, and accurate live/simulation/replay claims |
| AC-B18 | The first complete Dele journey produces observable useful outcomes and questions; telemetry does not contain raw private statements |
| AC-B19 | A second-domain configuration exercise reuses the same stage/host/media contract without a copied journey runner or separate state authority |
| AC-B20 | Native Qriptopian Bridges and authorized agent publishing update the same registered CI/KNYTS/FS placement; existing content survives migration, the actual reader reflects the published revision, and no constitutional state changes |

These are implementation acceptance requirements. No browser, financial, or deployment acceptance test is claimed as completed by delivery of these documents.

## 19. Requirement correlation

| Bridge requirements | Cartridge requirements / shared contract |
|---|---|
| B-01/B-02 threshold model | C-07–C-10; SC-01/02/08 |
| B-03 host composition | C-01/C-02/C-16; SC-04/09/10 |
| B-04–B-07 curriculum and exploration | C-03/C-11/C-14/C-15; SC-05/06 |
| B-08 Prepare | C-04–C-06; SC-03 |
| B-09 Operate | C-03/C-07–C-13; SC-01/04/05/07 |
| B-10/B-11 advanced crossing | C-07–C-10/C-16; SC-08/10 |
| B-12/B-13 state and migration | C-01/C-16; SC-02/03/07/10 |
| B-14/B-15 truthful capability/media presentation | C-11–C-15; D-01–D-07; SC-05/06/07 |
| B-16 reusable domain pattern | Common shell/contract in C-01/C-02/C-15/C-16 |
| B-17 native editorial administration | C-17; SC-06; administration companion A-01–A-10 |

## 20. Handoff checklist for the implementer

- Start with the companion cartridge specification and its C0 inventory.
- Reconcile newer source before deleting, replacing or recreating screenshot-visible capabilities.
- Preserve entry and advanced constitutional semantics while adding the missing intermediary experience.
- Implement the shared SC contracts once and reference them from both products.
- Resolve pricing/source discrepancies before numerical educational publication or live use; retain other deliverables' forward progress.
- Keep real live-operation acceptance open until the relevant route is proven; do not substitute animation, demo fills or an intent receipt.
- Deliver a correlated acceptance report identifying which AC-C, AC-B and AC-A cases passed, remain blocked, or are not yet implemented.
- Implement B-17 through native Qriptopian Admin → Bridges; reuse the existing content-upload primitive and shared placement service for UI and agent workflows.
- No deployment or live transaction is requested by this specification-writing task. When implementation is separately released, follow the user's direct-deployment preference rather than the legacy QubeTalk relay workflow.
