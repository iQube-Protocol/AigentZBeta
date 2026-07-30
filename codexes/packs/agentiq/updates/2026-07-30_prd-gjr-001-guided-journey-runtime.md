# PRD-GJR-001 — Guided Journey Runtime (Alpha)

**Initial implementation: Horizen × MoneyPenny Constitutional Admission Pilot**

- **Status:** Operator-directed implementation specification — DRAFT for review before build begins.
- **Target:** Demo-ready alpha (rehearsal + live walkthrough).
- **Class:** A reusable platform capability (journey bar + surface orchestration + authoritative state
  resolver + Companion context + receipts), demonstrated via ONE configured journey. NOT a new
  identity, wallet, delegation, admission, or settlement system — every sovereign mechanism it
  orchestrates already exists or is already partially built.
- **Sibling PRD (format precedent):** PRD-MPY-001 (MoneyPenny — the Constitutional Financial Services
  Agent). This PRD's canonical use case is MoneyPenny's own admission, so treat PRD-MPY-001 as the
  authority on what MoneyPenny IS; this PRD only orchestrates her admission journey.
- **Constitutional parents:** the Control–Authority–Mandate doctrine
  (`2026-07-30_control-authority-mandate-constitutional-security-model.md`) — this journey makes that
  doctrine's three-part model *visible in the UI*, not just enforced in code. The Passport Non-Bearer /
  Unique Continuous Personhood doctrine (`2026-07-30_constitutional-authority-supremacy-passport-security.md`).
  MoneyPenny's Horizen presence + external-agent admission model
  (`2026-07-30_moneypenny-horizen-presence-and-external-agent-admission.md`) — the code this journey
  orchestrates, built earlier the same day.
- **Authors:** operator (intent, canonical pilot narrative) + Claude Code (spec reconciliation).

---

## 0. Framing — why this is orchestration, not a new build

The platform already has: an Agent Card route for MoneyPenny, a real (unexecuted)
`register-moneypenny-horizen.ts` script implementing Horizen's documented MCP registration flow, a
provisional external-agent admission model (`services/passport/externalAgentAdmission.ts`), an
operator-claim/binding route (`services/horizen/operatorClaim.ts`), a DVN receipt pipeline, and —
ratified the same day — the Control–Authority–Mandate doctrine this journey exists to *teach*.

What is missing is not any of those mechanisms. It is a **coherent, presentable sequence across
them** — a thin orchestration layer that a partner can watch unfold, where every stage transition is
backed by real state and a real receipt, never a client-side illusion of progress.

```
Journey bar → live existing platform surface → contextual Companion guidance
→ authoritative state transition → receipt → next stage
```

---

## 1. Purpose

Build a lightweight Guided Journey Runtime that carries a person, agent or partner through a live
sequence of platform actions using: a compact interactive journey bar; existing authoritative
platform surfaces; a context-aware Companion; real platform state and receipts; a defined
destination.

The first journey demonstrates MoneyPenny's progression from a payment-capable metaMe agent into a
Horizen-registered, transparency-enabled, constitutionally delegated Financial Services agent whose
services ultimately become available through the Founder Office.

**This is not a separate demo application. The journey coordinates the platform. It does not
duplicate it.**

## 2. Product proposition

> A live journey, guided by an agent, executed on real infrastructure and proven at every step.

```
Journey map + live modular surfaces + contextual Companion + authoritative state + constitutional receipts
= Guided Constitutional Execution
```

The journey bar tells the participant where they are. The live viewport shows the relevant platform
capability. The Companion explains what is happening, what remains required, and what comes next.
The receipts prove that each transition actually occurred.

---

## 3. The canonical initial use case — MoneyPenny × Horizen (operator-ratified narrative)

This section is the authoritative pilot narrative. Everything in §7 (the seven-stage bar) is a
condensed presentation of exactly this sequence — nothing in §7 may contradict it.

### 3.1 Why MoneyPenny's current passportless state is the perfect starting point, not a defect

MoneyPenny is **registered but not yet passport-bearing** right now — a real Agent Card with Horizen
metadata, `tokenId: null`, `status: pending_registration`. The binding/claim/receipt/DVN path is
built but not executed. This is the exact **before** state the demonstration needs:

```
Discoverable agent → assessed candidate → sponsored agent → delegated constitutional actor
```

`registered externally ≠ authorised internally` is the distinction the whole journey exists to make
visible.

### 3.2 She enters Horizen already payment-capable — this is the strengthened proposition

MoneyPenny does not enter Horizen with an empty Agent Card and a generic wallet. Her controlling
wallet is a **metaMe constitutional wallet**, already capable of:

- x402 payments
- CryptoSent settlement orchestration
- Base Q¢ activity
- **Bitcent (B¢) activity on Bitcoin testnet** — the real testnet Rune issuance broadcast the same
  day (`2026-07-30_bitcent-testnet-etch-broadcast.md`; three confirmations at time of writing,
  awaiting full indexer visibility — the issuance, not "the contract," and indexer recognition
  remains the honest completion gate, not the confirmation count alone)
- bounded delegation
- receipts and proof correlation

So the outbound proposition is:

> MoneyPenny enters Horizen as a payment-capable, constitutionally delegated Financial Services
> agent; Horizen adds verifiable P&L transparency and performance proofs to that existing capability
> envelope.

```
metaMe wallet + x402 + CryptoSent + Base Q¢ + testnet Bitcent/B¢ + bounded authority
→ MoneyPenny registered in Horizen
→ Pulse/P&L transparency activated
→ Horizen produces verifiable financial proofs
→ Agent Card is enriched
→ Marketa assesses eligibility
→ operator passport and delegation activate authority
→ MoneyPenny enters the Financial Services Runtime
```

This proves capability accumulation across ecosystems, not merely registry interoperability.
**Horizen does not replace MoneyPenny's wallet, settlement system, or constitutional authority. It
adds a new, independently verifiable financial-state layer.**

### 3.3 She declares P&L observability, never fabricated P&L history

MoneyPenny does not need existing trading history before registration. Her card declares that she
*supports* Pulse monitoring, *consents* to P&L disclosure, *exposes* verification references, and
*accepts* Horizen-generated performance proofs — evaluable as activity accumulates. **She does not
claim P&L performance she does not have.** Represent this literally as:

```
pnlDisclosureAuthorized: true
pulseEnabled: true | false
proofRefs: []            ← empty until real proofs exist
```

### 3.4 The Agent Card as a composable interoperability envelope

The single most strategically important artifact in the pilot. It must carry stable **references
and commitments**, never duplicate mutable proof bodies:

```
Agent Card → identity and capability declaration → registry bindings
           → proof commitments and resolvable references → authority and delegation state
```

**metaMe constitutional fields:** agent root identity, passport class, sponsor/operator reference,
delegation requirements, permitted authority scope, Standing, revocation state, DVN receipt
references, runtime jurisdiction.

**Horizen fields:** ERC-8004 network, registry contract, token/agent ID, registry alias, owner
wallet, Pulse status + authorization reference, P&L proof references, proof-service status,
verification timestamps.

This lets Horizen enrich the card without becoming the source of metaMe constitutional authority,
and lets metaMe consume Horizen proofs without pretending to generate them.

**Schema (namespaced envelope — extensions must never allow one ecosystem to overwrite another's
authority fields):**

Before the cycle:
```json
{
  "core": { "name": "MoneyPenny", "capabilities": [], "serviceEndpoints": [] },
  "capabilities": {
    "payments": { "x402": true, "cryptoSent": true, "baseQCent": true, "bitCentTestnet": true },
    "financialTransparency": { "horizenPulseSupported": true, "pnlDisclosureAuthorized": true }
  },
  "metame": {
    "passportClass": "agent-participant",
    "sponsorRef": null,
    "delegationRef": null,
    "standingRef": null,
    "runtimeAuthority": "inactive"
  },
  "authority": { "delegatePassport": null, "delegationStatus": "not-yet-activated", "runtimeAuthority": "inactive" },
  "horizen": {
    "network": "base-sepolia",
    "registryContract": "...",
    "tokenId": null,
    "registryAlias": null,
    "pulse": { "enabled": false, "authorizationRef": null },
    "pnl": { "disclosureAuthorized": true, "proofRefs": [] }
  },
  "evidence": {
    "bitCentIssuanceRefs": ["<testnet-proof-ref>"],
    "horizenPnlProofRefs": [],
    "standingStatus": "gateway-enabled"
  }
}
```

After the cycle:
```json
{
  "metame": {
    "sponsorRef": "<commitment>",
    "delegationRef": "<commitment>",
    "delegatePassportRef": "<commitment>",
    "runtimeAuthority": "active-bounded"
  },
  "authority": {
    "delegatePassport": "<ref>",
    "delegationStatus": "active-bounded",
    "runtimeAuthority": "financial-services-pilot"
  },
  "horizen": {
    "tokenId": "<id>",
    "registryAlias": "<alias>",
    "pulse": { "enabled": true, "authorizationRef": "<proof-ref>" },
    "pnl": { "disclosureAuthorized": true, "proofRefs": ["<proof-ref>"] }
  },
  "evidence": {
    "horizenPnlProofRefs": ["<proof-ref>"],
    "standingStatus": "accruing",
    "standingSignals": ["pnl-transparency-enabled", "verified-disclosure-completed"]
  }
}
```

### 3.5 The refined ten-step canonical sequence

This is the authoritative sequence — §7's seven bar-labels are a **condensed grouping** of these ten,
never a contradiction of their order:

1. **Horizen Registry Presence** — MoneyPenny enters as an active external agent: resolvable Agent
   Card, Horizen registry identity, controlling wallet, declared capabilities — **no** metaMe
   delegate passport, **no** operator-to-MoneyPenny delegation yet. Visible and technically
   controllable, not constitutionally authorised.
2. **Pulse and P&L Transparency** — activation moves the card from "financial-services capabilities
   claimed" to "capabilities + Horizen verification integration + Pulse consent + externally
   resolvable proof references."
3. **Marketa Eligibility** — Marketa rediscovers MoneyPenny as she would any external agent: identity
   resolves, wallet proven, card coherent, capabilities evidenced, Pulse/P&L enabled, sponsorship
   eligibility, authority boundable/revocable. Output: `RECOMMENDED FOR POLITY-BOUND DELEGATE
   ADMISSION`. **She is not approving Financial Services jurisdiction — only constitutional
   eligibility to become a delegated actor.**
4. **Operator Passport** — the operator's own continuing Polity Passport resolves: valid, continuing,
   not revoked, sponsor-eligible. **The authority source is not MoneyPenny's wallet — it is the
   continuing personhood of her operator.**
5. **Sponsorship and Control Proof** — a one-time wallet-control challenge; the operator signs with
   the agent wallet; the signer must match the wallet bound to the registered Agent Card; a
   proof-of-control receipt issues; sponsorship is recorded. **Wallet control proves the operator
   controls the registered agent — it does not by itself authorize the agent.**
6. **Bounded Delegation** — the proposed delegation (permitted/prohibited actions, networks, expiry)
   is displayed in full and approved with a contextual mandate.
7. **Delegate Passport** — MoneyPenny moves from *external registered agent* to *polity-bound delegate
   agent*; the delegate passport visibly links her Horizen identity, the operator's passport, the
   sponsorship, the delegation, the runtime, expiry/revocation, and Standing eligibility.
8. **FS Runtime Bootstrap** — because MoneyPenny would otherwise be both candidate and admitting
   authority for her own first admission, use the bootstrap rule (§3.6). **MoneyPenny does not
   self-authorize — her authority is activated by her operator following independent eligibility
   review.** After bootstrap, she becomes the FS Runtime's jurisdictional authority for *subsequent*
   agent admissions.
9. **Standing Gateway** — P&L transparency activation opens Standing eligibility (§3.7); it does not
   itself grant Standing.
10. **Evidence Chain** — one consolidated view of every receipt in the chain, plus DVN anchor/pending
    status.

### 3.6 The bootstrap rule (self-admission paradox, resolved)

```
Marketa recommendation
+ valid operator passport
+ proof of control
+ bounded delegation
+ explicit operator bootstrap ratification
+ Aigent Z or Platform Aletheon observation
= initial MoneyPenny FS Runtime activation
```

Aigent Z or Platform Aletheon observes and receipts the activation. This is the same
observer/required-signatory shape already built for Bitcent's pilot treasury authority gate
(`services/treasury/pilotTreasuryAuthority.js`) — reuse the pattern, do not invent a second one.

### 3.7 Standing pathway — transparency is a gateway, never a grant

```
P&L transparency activation           = Standing gateway (eligibility, not accrual)
complete and timely disclosure        = positive Standing signal
Horizen-verified P&L proof            = evidence-backed Standing accrual
consistent disclosure over time       = continuity/reliability signal
missing/contradicted/manipulated disclosure = refusal, attenuation, or penalty
```

**An agent can lose money honestly and still earn Standing through accurate disclosure. An agent can
be profitable and lose Standing by concealing risk or misrepresenting results.** Standing rewards the
truthfulness and reliability of reporting — never profitability alone (echoes V-10, the existing
Standing-contamination guard already ratified for the venture substrate).

### 3.8 Right-sized mandate strength applied to this journey

```
low-risk proof retrieval    → standing mandate
new payment route           → fresh contextual mandate
material settlement         → transaction-specific mandate
treasury or Mainnet action  → stronger proof + agentic approval + observation
```

MoneyPenny arrives payment-ready but exercises capability only in proportion to her current authority
and Standing — the Control–Authority–Mandate doctrine's §III.1 (Right-Sized Mandate Strength) made
concrete.

---

## 4. Alpha scope

**In scope:** a reusable journey definition; a compact stage bar; a stage viewport; state-aware
Companion guidance; authoritative stage completion; navigation among existing surfaces; evidence and
receipt summaries; the Horizen–MoneyPenny journey configuration.

**Out of scope for alpha:** a fully dynamic AI-generated journey compiler; generalized journey
authoring UI; a new wallet; a new Passport system; replacement of existing cartridges; redesign of
existing core surfaces; full mobile optimization; production-grade cross-origin iframe management;
generalized partner white-labeling.

Preserve extension points, but keep this slice thin.

## 5. Constitutional principles

### 5.1 Journey Guidance Principle
> A journey may guide execution, but it shall not manufacture completion.

```
button clicked ≠ stage complete
authoritative state + required receipt = stage complete
```

### 5.2 Surface Reuse Principle
> Existing authoritative surfaces must be reused unless modifying the native surface produces
> durable platform value beyond the pilot.

Do not alter a wallet, card, modal, tab, drawer or cartridge merely to make the pilot appear
smoother. Journey-specific presentation goes through orchestration, framing, overlays, controlled
viewport rendering, or contextual Companion guidance.

### 5.3 One-State Principle
> The journey bar, embedded surface and Companion must derive from the same authoritative journey
> state.

The UI must not say a stage is complete when the underlying runtime does not.

### 5.4 Guided Sovereignty Principle
The Companion may explain, prepare, summarize, navigate, surface evidence, propose bounded
parameters. It may **not** silently perform sovereign acts: claiming, passport acceptance,
sponsorship, delegation, consequential mandate approval.

### 5.5 Control–Authority–Mandate Principle
```
Proof of Control ∩ Proof of Authority ∩ Contextual Mandate = Constitutional Permission to Act
```
The journey should visibly teach: *Control says can. Authority says may. Mandate says this, now.*

### 5.6 Cross-Ecosystem Capability Enrichment Principle (new, this pilot)
> An agent may carry capabilities, authority references and proof commitments across interoperable
> registries. External systems may enrich its verifiable state, but may not manufacture or enlarge
> its constitutional authority.

### 5.7 Payment-Capable Admission Principle (new, this pilot)
> Payment capability establishes operational capacity, not unrestricted authority. A payment-capable
> agent may execute only within an active bounded delegation and a right-sized contextual mandate.

### 5.8 Transparency-to-Standing Principle (new, this pilot)
> An agent's voluntary submission to verifiable financial transparency may establish eligibility to
> accrue Standing. Standing shall accrue from the completeness, timeliness, consistency and veracity
> of subsequent disclosures — not from profitability alone.

---

## 6. Journey architecture

### 6.1 Partner navigation

Add a durable Pilot area within the Partner workspace:

```
Partner
├── Operate
├── Pilot
│   ├── Journey
│   ├── Evidence
│   ├── Activity
│   └── Administration
└── Existing partner views
```

For the alpha, only **Journey** and a minimal **Evidence** view need to be fully functional.

### 6.2 Journey layout

```
[ Journey bar ]
[ Stage title and explanation ]
[ Live stage viewport                      ][ Companion ]
[ Evidence summary / receipt status ]
```

Supported alpha surface modes: `iframe`, `component`, `modal`, `drawer`, `receipt-view`. Where the
Companion is already provided by the shell, do not duplicate it inside the journey page.

---

## 7. The seven-stage journey bar (condensed presentation of §3.5's ten steps)

| Bar stage | Groups (§3.5 steps) | Completion (authoritative) |
|---|---|---|
| **1. Register** | Horizen Registry Presence | tokenId exists ∩ registry reread succeeds ∩ owner wallet matches ∩ Agent Card resolves |
| **2. Verify** | Pulse and P&L Transparency | Pulse authorization verified ∩ P&L transparency enabled ∩ Agent Card enrichment committed |
| **3. Claim** | Marketa Eligibility + Sponsorship & Control Proof | Marketa recommendation ∩ fresh proof of wallet control |
| **4. Passport** | Operator Passport + Delegate Passport | valid operator passport ∩ sponsor binding ∩ agent delegate credential issued |
| **5. Delegate** | Bounded Delegation + FS Runtime Bootstrap | delegate credential ∩ active bounded delegation ∩ contextual mandate ∩ bootstrap approval ∩ observer receipt ∩ FS Runtime activation |
| **6. Transact** | Standing Gateway + a bounded payment | Standing gateway enabled ∩ (bounded payment prepared + mandate validated) or (executed + receipt) |
| **7. Founder Office** | Evidence Chain + Founder Office landing | MoneyPenny active in Founder Office ∩ bounded FS capabilities visible ∩ complete evidence chain readable |

Companion narratives (per stage, templated for alpha):

- **Register:** "MoneyPenny is now discoverable in Horizen. Registry presence proves identity and
  discoverability, but not constitutional authority."
- **Verify:** "Horizen has enriched MoneyPenny's verifiable operational state. It has not created or
  enlarged her constitutional authority."
- **Claim:** "Control has been proven without revealing the private key. Control does not yet equal
  authority."
- **Passport:** "The wallet proved control. The Passport now establishes the human source from whom
  authority may originate."
- **Delegate:** "Control says can. The Passport and delegation say may. The mandate says what
  MoneyPenny may do now."
- **Transact:** "MoneyPenny entered Horizen capable of paying. Horizen made her financial activity
  independently observable. Verified transparency now opens her pathway to Standing."
- **Founder Office (closing):** "MoneyPenny is no longer merely an agent in a registry. She is a
  discoverable, verified, sponsored and constitutionally authorized Financial Services agent
  operating through Founder Office."

Interaction rules: completed stages revisitable; current stage emphasized; ready stages clickable;
blocked stages inspectable but not executable; future stages show prerequisites; **clicking never
completes a stage**; horizontally scrollable / carousel on small widths; show stage number + status;
brief refusal/block reason on hover or click.

---

## 8. Journey stage schema

```ts
type JourneyStageState =
  | 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'REFUSED' | 'COMPLETE' | 'QUARANTINED';

type JourneySurfaceMode = 'iframe' | 'component' | 'modal' | 'drawer' | 'receipt-view';

interface JourneyStageDefinition {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  actor: string;
  subjectRef: string;
  surface: {
    mode: JourneySurfaceMode;
    ref: string;
    route?: string;
    entityRef?: string;
    props?: Record<string, unknown>;
  };
  prerequisites: string[];
  permittedActions: string[];
  completionEvidence: string[];
  receiptTypes: string[];
  companion: { before: string; during?: string; complete: string; refused?: string };
  nextStageId?: string;
}

interface JourneyDefinition {
  id: string;
  version: string;
  label: string;
  partner?: string;
  destination?: string;
  subjectRef: string;
  stages: JourneyStageDefinition[];
}
```

## 9. Authoritative state model

Do not store journey completion as an independent client-side checklist.

```ts
resolveJourneyState(journeyDefinition, authoritativePlatformState): JourneyRuntimeState
```

The resolver derives each stage from: registry state; Agent Card commitments; Marketa
recommendation; control-proof receipt; Passport state; sponsorship; delegate credential; delegation;
mandate; runtime membership; Standing gateway; receipts; payment/proof state. **Client navigation may
select a stage; it cannot set completion.**

## 10. Surface adapter

```ts
const JOURNEY_SURFACES = {
  'agent-card': AgentCardSurface,
  'ingestion-factory': IngestionFactorySurface,
  'agent-wallet': AgentWalletSurface,
  'marketa-validation': MarketaValidationSurface,
  'passport-bureau': PassportSurface,
  'delegation': DelegationSurface,
  'financial-services-runtime': MoneyPennyRuntimeSurface,
  'trust-standing': TrustSurface,
  'evidence-chain': EvidenceSurface,
  'founder-office': FounderOfficeSurface,
};
```

For iframe-rendered routes, pass controlled params (`journeyMode=true`, `subjectRef=moneypenny`,
`stage=prove-control`). **Never weaken normal authentication or route authority. Never expose a
route through an iframe the user could not normally access.**

## 11. Companion integration

```ts
interface CompanionJourneyContext {
  journeyId: string;
  journeyVersion: string;
  stageId: string;
  stageState: JourneyStageState;
  subjectRef: string;
  actorRef: string;
  partner?: string;
  destination?: string;
  authoritySummary: {
    control: 'unverified' | 'verified';
    authority: 'none' | 'pending' | 'bounded';
    mandate: 'none' | 'pending' | 'active' | 'expired';
  };
  missingRequirements: string[];
  availableActions: string[];
  receiptRefs: string[];
}
```

For alpha, Companion output may be templated from the journey definition rather than fully
generated. It should display: what is happening; why it matters; what the user needs to do; what
the Companion may prepare; what sovereign action remains with the user; what evidence completes the
stage.

## 12. Demo strategy — rehearse, then perform live

### 12.1 Two separate executions

```
rehearsal candidate: Aigent Nakamoto
live partner candidate: MoneyPenny
```

**Why Nakamoto:** already has a wallet; role is clear and bounded; not the FS Runtime governor; no
self-admission conflict; the constitutional path is nearly identical to MoneyPenny's; defects are
repairable without consuming MoneyPenny's "first admission" moment. Target runtime for Nakamoto:
a narrow pilot role (e.g. *Bitcoin integrity observer* or *treasury assurance participant*) — broad
authority is not the point; proving the admission machinery works is.

### 12.2 What rehearsal must prove (positive path)

1. Agent Card resolves
2. wallet-control challenge verifies
3. Marketa issues an eligibility recommendation
4. the existing operator passport resolves
5. sponsorship binds to the correct operator
6. a bounded delegation can be created
7. the delegate passport can be issued and reread
8. no onward delegation is possible
9. expiry and revocation work
10. every stage produces a receipt
11. the final authority state is deterministically rereadable

### 12.3 Refusal paths (rehearsal must exercise these too — as important as the positive path)

wrong wallet signature · expired challenge · passport mismatch · unapproved capability · wildcard
delegation · missing expiry · onward delegation attempt · replayed mandate · runtime admission
without Marketa recommendation · Agent Card unavailable · Horizen registry reread fails · signer
mismatch vs. registered owner · sponsorship attempted before control proof · mandate mismatches
actual payment · runtime activation attempted before delegation · journey UI attempts to mark
completion without evidence.

A refusal must: keep the stage incomplete; display the reason; produce or reference a refusal
receipt; allow correction and retry where policy permits.

### 12.4 MoneyPenny preflight without consuming the live admission

**Safe to preflight (no state change):** Agent Card validation; Horizen MCP schema discovery
(exactly what `register-moneypenny-horizen.ts` already does in dry-run); unsigned registration
transaction construction; wallet balance/chain checks; Pulse authorization-message construction;
Marketa assessment in DRAFT state; passport resolution; delegation-object construction; mandate
validation; receipt previews.

**Do NOT finalize before the live walkthrough:** Marketa's final recommendation; delegate passport
issuance; bounded delegation activation; FS Runtime bootstrap admission.

### 12.5 Never reset constitutional history

Once an agent has genuinely received a delegate passport, do not erase or rewrite that history to
recreate a demo — a revoked test passport still leaves a historical issuance receipt, so the
demonstration would never truly be "from scratch," and doing so conflicts with the receipt/continuity
model this entire platform is built on.

**Record the Nakamoto rehearsal** as internal test evidence / backup footage / a fallback source —
but the primary partner demo is the live MoneyPenny walkthrough, not the recording.

### 12.6 Deterministic fallback

Before the live session, capture signed snapshots of every expected state (MoneyPenny registered →
Pulse activated → Marketa recommendation → passport validated → delegation preview → delegate
passport issued → runtime activated → evidence chain complete). If an external network fails during
the live walkthrough, switch **visibly** to the previously receipted rehearsal replay and **state
explicitly** that it is recorded evidence, never a silent stand-in for a live transaction (Evidence
Replay Mode, §13.3 below).

## 13. Pilot demonstration modes

**13.1 Rehearsal mode** (Nakamoto) — validate full mechanics, exercise positive+refusal paths, create
backup evidence, avoid consuming MoneyPenny's live moment.

**13.2 Live pilot mode** (MoneyPenny) — real Horizen registration, real transparency activation,
real constitutional admission, real arrival at Founder Office.

**13.3 Evidence replay mode** — present a previously receipted run if an external network becomes
unavailable, clearly labeled as recorded evidence, never a silent live simulation.

## 14. Alpha UI

**Pilot header:**
```
Horizen × metaMe
MoneyPenny Constitutional Admission Journey
Destination: Founder Office
```
Shows: current stage; overall journey state; subject; partner; current actor; last receipt; last
sync.

**Evidence drawer:** evidence required; evidence present; latest receipt; anchor status; refusal
reason; deterministic reread link.

## 15. Required receipts

Reuse existing canonical action types wherever one already exists — **do not create a duplicate
receipt vocabulary** (the exact rule just applied to Bitcent's own new action type). Union of both
source lists, to be reconciled against `ActivityActionType` during build (some of these — e.g.
`agent_delegated`, `agent_delegation_revoked`, `agreement_formed`, `agreement_authorized`,
`partner_agent_evidence_recorded`, `standing_accrued` — already exist and should be reused directly
rather than minted again):

```
agent.card.discovered              horizen.agent.registered
horizen.pulse.authorized           horizen.pnl.transparency.enabled
agent.card.enriched                agent.control.proven
marketa.eligibility.recommended    operator.passport.validated
agent.sponsorship.recorded         agent.delegate-passport.issued
agent.delegation.granted           financial-services-runtime.activated
standing.gateway.enabled           payment.mandate.approved
payment.prepared                   payment.executed
journey.completed
```

## 16. Refusal cases

See §12.3 for the full list — reproduced here as the alpha's required refusal coverage, not merely
a rehearsal checklist.

## 17. Founder Office destination

The journey must terminate in Founder Office, showing: MoneyPenny active; current bounded authority;
wallet/settlement capabilities; Horizen transparency status; Standing state; available Financial
Services actions; authority/mandate boundaries; evidence link.

> The pilot does not end at registration or credential issuance. It ends where the capabilities
> become useful to the founder.

## 18. Alpha deliverables (runbooks, not just code)

1. rehearsal runbook (Nakamoto)
2. live MoneyPenny runbook
3. demo presenter script
4. preflight checklist
5. rollback/quarantine procedure
6. expected receipt list
7. deterministic fallback package for network failure

Minimal additional build beyond orchestration: persistence for Marketa's provisional recommendation
if not yet durable; delegate-passport issuance wiring; operator bootstrap approval for MoneyPenny;
receipt aggregation into one evidence-chain view; a rehearsal fixture for Nakamoto; a live-demo state
manifest.

## 19. Implementation priority

**P0 — required:** Pilot tab in Partner workspace; reusable journey definition type; seven-stage
Horizen journey; journey bar; stage viewport; authoritative state resolver; existing-surface routing;
Companion stage context; evidence summary; Nakamoto rehearsal configuration; MoneyPenny live
configuration; Founder Office destination; refusal-safe progression; the six deliverables in §18.

**P1 — useful for presentation:** stage badges; smooth transitions; stage descriptions; evidence
drawer; recorded replay mode; stage-specific Companion scripts; compact partner branding.

**P2 — later:** AI-generated journeys; visual journey builder; multi-party journey collaboration;
user-authored templates; journey marketplace; analytics/conversion measurement; adaptive paths;
Companion-initiated journey generation; fully generalized smart-menu integration.

## 20. Acceptance criteria

1. Partner workspace contains a Pilot → Journey view
2. the seven-stage journey renders from configuration
3. clicking a stage opens the correct existing platform surface
4. stage state derives from authoritative data
5. a click alone cannot complete a stage
6. the Companion receives the current journey context
7. the evidence panel lists required and present receipts
8. Nakamoto can be used as a rehearsal subject, with positive AND refusal paths exercised
9. MoneyPenny can be selected as the live subject
10. the final stage opens Founder Office
11. all existing core surfaces continue to function normally outside journey mode
12. no constitutional gate is weakened
13. blocked and refused stages are visible and recoverable
14. the implementation produces the capability artifact (§21)
15. constitutional history is never reset/reissued to stage a demo (§12.5)
16. all seven deliverables in §18 exist, not only the runtime code

## 21. Capability artifact requirement (on completion)

```
Capability:      Guided Journey Runtime
Where:           Partner → Pilot → Journey
What it does:    Orchestrates live platform surfaces through a state-aware,
                 receipted journey with Companion guidance.
How to configure: Journey definition schema, surface adapter registry,
                 state resolver, receipt requirements, Companion context.
Invariants:
  - journey does not manufacture completion
  - authoritative state is singular
  - sovereign acts remain with the principal
  - surfaces are reused rather than forked
  - refusals outrank visual progression
  - receipts prove transitions
Canaries:
  - clicking does not complete stage
  - missing receipt blocks transition
  - inaccessible surface remains inaccessible
  - wrong wallet cannot claim agent
  - delegation cannot precede sponsorship
  - consequential action cannot bypass mandate
```

## 22. Open questions to confirm during build (not blocking spec approval)

- **Marketa's real assessment surface** — does a live validation/reviews tab already render the
  eligibility fields §3.5 step 3 needs, or does it need a thin wrapper? Affects whether
  `marketa-validation` in §10's adapter registry is a pure reuse or a small new component.
- **Passport Bureau / delegation UI** — same question for `passport-bureau` and `delegation` surface
  adapters.
- **Receipt-type reconciliation** (§15) — map each of the sixteen listed types against the real
  `ActivityActionType` union before writing any migration; several almost certainly already exist
  under different names and must be reused, not duplicated, per `inv.engineering.037`.
- **Nakamoto's wallet** — confirm it is a real, already-funded wallet (mirroring the operator's own
  Bitcoin wallet reuse for the Bitcent etch) before rehearsal, so funding delay doesn't eat into
  tomorrow's timeline.
- **MoneyPenny's owner wallet for Horizen registration** — still needs a funded Base Sepolia wallet
  (flagged when the registration script was built); this journey's Stage 1/Claim depends on it
  existing before rehearsal even starts.
