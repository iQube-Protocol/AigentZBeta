# PRD-GJR-001 — Guided Journey Runtime (Alpha)

**Initial implementation: Horizen × MoneyPenny Constitutional Admission Pilot**

- **Status:** Operator-directed implementation specification — **APPROVED, subject to the amendments
  below, all applied 2026-07-30/31.** Revision history: v0.1 initial draft → v0.2 storyboard
  corrections (Composable Overlay Principle, §5.9) → v0.3 sequencing, naming, schema and gate
  corrections from the operator's first full review → v0.4 (this revision) canonical passport
  terminology, aigentMe destination, imported-agent-≠-aigentMe principle, and the
  aigentMe-oversees-onboarding model, from the operator's addendum review. Build may proceed once
  §22's Surface Discovery Gate is cleared per stage.
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

### 0.1 One canonical term for the non-human credential (operator ruling, 2026-07-30, superseded and finalized 2026-07-31)

Earlier drafting of this PRD alternated among "delegate passport," "agent delegate credential,"
"polity-bound delegate agent," and "agent-participant passport." A first round of review settled on
`Agent Participant Passport` (matching MoneyPenny's shipped `passport_class: 'Agent Participant'`
field). **The operator's addendum review overrides that choice. The canonical public and
constitutional-prose term, everywhere in this document and in the UI, is `Polity Delegate Passport`
for the agent credential and `Polity Citizen Passport` for the human credential:**

```
Human:  Polity Citizen Passport
Agent:  Polity Delegate Passport
```

> **A Polity Citizen Passport records the continuing constitutional personhood of a human principal.
> A Polity Delegate Passport is a revocable credential through which a non-human agent exercises
> authority derived from a Polity Citizen Passport under bounded delegation. The delegate passport
> does not create authority independently. It records and activates authority conveyed by the
> citizen.**

This supersedes both the original three-way ambiguity and the round-1 choice of `Agent Participant
Passport`. **Internal implementation type names are unaffected** — `passportClass: "agent-participant"`
stays exactly as already shipped in MoneyPenny's Agent Card route (§3.4); §5.2 (Surface Reuse
Principle) still forbids renaming shipped code for a pilot demo. Only user-facing and constitutional
prose changes: every other prose reference to a passport-like credential for an agent — in this
document and in any UI built from it — uses **Polity Delegate Passport**, and every reference to the
human credential uses **Polity Citizen Passport**, never an alternate phrasing.

---

## 1. Purpose

Build a lightweight Guided Journey Runtime that carries a person, agent or partner through a live
sequence of platform actions using: a compact interactive journey bar; existing authoritative
platform surfaces; a context-aware Companion; real platform state and receipts; a defined
destination.

The first journey demonstrates MoneyPenny's progression from a payment-capable metaMe agent into a
Horizen-registered, transparency-enabled, constitutionally delegated Financial Services agent —
carrying her principal (the operator) across the constitutional threshold, where **aigentMe** (the
principal's constitutional companion) assumes oversight and MoneyPenny takes her place as one of the
principal's delegated agents. Founder Office is a possible, secondary next destination MoneyPenny's
capabilities may help with — not the journey's own terminus (§5.10, §17).

**This is not a separate demo application. The journey coordinates the platform. It does not
duplicate it.**

## 2. Product proposition

> A live journey that carries a person and their agent across the constitutional threshold,
> activates aigentMe as the person's companion, and proves every transition through authoritative
> state and receipts.

**(Superseded, 2026-07-31): the original v0.1 proposition —** *"A live journey, guided by an agent,
executed on real infrastructure and proven at every step"* **— under-stated the destination. The
journey does not end at proof of execution; it ends at aigentMe's activation as constitutional
companion.**

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

**Correction (2026-07-31, operator review): "registered but not yet passport-bearing" is
self-contradictory** — a `tokenId: null` agent is not registered. The accurate before-state:
MoneyPenny has a published Agent Card and a persisted AigentQube (§3.1.1), but **Horizen
registration remains pending and no token id has yet been issued** — `tokenId: null`, `status:
pending_registration`. The binding/claim/receipt/DVN path is built but not executed. This is the
exact **before** state the demonstration needs:

```
Discoverable agent → assessed candidate → sponsored agent → delegated constitutional actor
```

`registered externally ≠ authorised internally` is the distinction the whole journey exists to make
visible.

### 3.1.1 Correction, 2026-07-31 (operator ruling): Register is AigentQube-first, not Horizen-first

An earlier framing of Stage 1 treated "register MoneyPenny in Horizen" as the whole of the stage. That
is incomplete: **MoneyPenny may not appear as an agent-shaped entry in the iQube Registry merely
because a wallet key row and a hand-authored Agent Card exist for her.** She must be backed by an
actual, persisted **AigentQube** record — the canonical metaProof object for any agent — with the
external Agent Card and any Horizen registry token id being **bindings recorded ON that AigentQube**,
never substitutes for it.

```
AigentQube
= canonical metaProof agent object (registry_assets, asset_class 'AigentQube')

Agent Card (A2A / ERC-8004)
= interoperable projection of the AigentQube

Horizen ERC-8004 token id
= external registry binding of the AigentQube (external_registry_bindings[0])

wallet
= the AigentQube's proof-of-control instrument (read from agent_keys, never duplicated)

Polity Delegate Passport
= bounded constitutional authority (a later stage — §4)
```

**Corrected Stage 1 sequence:**
```
Resolve MoneyPenny's AigentQube (registry_assets asset_id 'aigentqube-moneypenny')
→ project her Agent Card from it (app/api/agents/moneypenny/route.ts)
→ register that card in Horizen
→ write the returned tokenId back into the SAME AigentQube's external_registry_bindings
```

**Status, 2026-07-31:** the AigentQube record now exists —
`supabase/migrations/20260930000400_aigentqube_moneypenny_registry_asset.sql` seeds
`aigentqube-moneypenny` into `registry_assets` (mirroring the exact pattern used for aigent-z, kn0w1,
marketa and aigent-c) plus its `iqube_id_map` row, and `types/registry-canonical.ts` gained
`ExternalAgentRegistryBinding`/`AigentControllerBinding` — additive fields on the existing
`CanonicalAigentBlock`, confirmed via a dedicated audit to be a genuinely new gap, not a duplicate of
`agent_identity_bindings` (that table is the authority/attribution record — who is constitutionally
responsible for a tokenId; `external_registry_bindings` is the AigentQube's own declaration of its
external presences — the two coexist, they don't compete). MoneyPenny's Agent Card route now
**projects** its `metadata.horizen` block from this record (soft-failing to the same honest
`pending_registration` defaults if the registry is unreachable — this is a live, external-facing A2A
discovery endpoint and must never break on a registry read). The actual write-back once a real
Horizen registration succeeds is **not yet built** — deliberately: `scripts/register-moneypenny-horizen.ts`
itself already documents this as its own next, not-yet-run step ("persist a metaMe binding record...
for this OUTBOUND registration"), and building the write path before there is a real transaction to
write would be exactly the speculative, unexercised code this session's principles forbid.

One AigentQube gap this correction does **not** attempt to close in this pass: aigent-me, Aigent
Nakamoto and the Community Concierge runtime agents have the identical gap (code-only, synthetic
registry presence, no persisted `registry_assets` row) — out of scope here, since this pass is
deliberately scoped to MoneyPenny for the pilot, not a platform-wide AigentQube backfill.

### 3.2 She enters Horizen already payment-capable — this is the strengthened proposition

MoneyPenny does not enter Horizen with an empty Agent Card and a generic wallet. Her controlling
wallet is a **metaMe constitutional wallet**, already capable of:

- x402 payments
- QriptoCENT settlement orchestration
- Base Q¢ activity
- **Bitcent (B¢) activity on Bitcoin testnet** — the real testnet Rune issuance broadcast the same
  day (`2026-07-30_bitcent-testnet-etch-broadcast.md`; now at 18 confirmations, awaiting full indexer
  visibility — the issuance, not "the contract," and indexer recognition remains the honest
  completion gate, not the confirmation count alone). **Canonical naming (2026-07-31, operator
  addendum, corrected 2026-07-31):** **Q¢ (QriptoCENT) is the stable-value currency CLASS** — no
  aggregate cap, extensible to further denominations (`2026-07-29_qriptocent-supply-constitution.md`).
  **Bitcent (title case, B¢) is Q¢'s Bitcoin-native denomination** — the concrete Bitcoin Runes
  implementation of the `BitCent/B¢` denomination ratified in principle on 2026-07-29, settled
  cent-for-cent with Base Q¢ via DVN inter-ledger settlement, never wrapped-token bridging
  (`2026-07-29_qriptocent-cross-denomination-settlement.md`). `Bitcent is a Bitcoin-native
  micro-stablecoin` remains accurate — it is that, AND it is Q¢'s Bitcoin-native instance, not a
  parallel or unrelated system. `B¢` is the ticker; `Bc` is the ASCII fallback where `¢` cannot
  render. `BITCENT` (all-caps) is the immutable on-chain Rune protocol name only — a Runes-protocol
  convention, not a prose choice, and never used in place of "Bitcent" in narrative text. (Corrected
  2026-07-31: this bullet previously named the capability "CryptoSent settlement orchestration" —
  wrong here specifically, because this is a list of payment RAILS/currencies (x402, Base Q¢,
  Bitcent/B¢) and needed the currency's own name, QriptoCENT. CryptoSent is a real, separate,
  ratified Financial Services Runtime agent that routes and classifies transactions on top of
  QriptoCENT — not a misspelling of it and not interchangeable with it. See CLAUDE.md's QriptoCENT
  section for the full distinction.)
- bounded delegation
- receipts and proof correlation

So the outbound proposition is:

> MoneyPenny enters Horizen with constitutional infrastructure and payment capability already in
> place, but her bounded authority for this pilot is **not yet activated** — the journey itself is
> what activates it. Horizen adds verifiable P&L transparency and performance proofs to that existing
> capability envelope along the way.

**Correction (2026-07-30, operator review):** an earlier draft of this section described her as
already "constitutionally delegated" at entry. That contradicts the journey's own central claim —
`registered externally ≠ authorised internally` (§3.1) — and must never be stated as true before the
Delegate stage actually completes.

```
metaMe wallet + x402 + QriptoCENT + Base Q¢ + testnet Bitcent/B¢ + bounded authority
→ MoneyPenny registered in Horizen
→ Pulse/P&L transparency activated
→ Horizen produces verifiable financial proofs
→ Agent Card is enriched
→ Marketa assesses eligibility
→ operator Polity Citizen Passport and delegation activate authority
→ MoneyPenny enters the Financial Services Runtime
→ aigentMe activates as the operator's constitutional companion
```

This proves capability accumulation across ecosystems, not merely registry interoperability.
**Horizen does not replace MoneyPenny's wallet, settlement system, or constitutional authority. It
adds a new, independently verifiable financial-state layer.**

### 3.3 She declares P&L observability, never fabricated P&L history

MoneyPenny does not need existing trading history before registration. Her card declares that she
*supports* Pulse monitoring — but has not yet *consented* to P&L disclosure, which remains an
explicit operator action taken during the Verify stage, not a default. **She does not claim P&L
performance she does not have, and she does not claim a consent the operator has not yet given.**

**Correction (2026-07-30, operator review):** `pnlDisclosureAuthorized: true` at entry was wrong —
setting it before the operator acts weakens the demonstration and could read as consent having been
pre-granted. The capability/state distinction (§5's Agent Card schema) makes this precise:

```
horizenPulseSupported: true      ← capability claim: the card SUPPORTS Pulse
pulseEnabled: false              ← live state: not yet activated
pnlDisclosureAuthorized: false   ← live state: operator has not yet authorised disclosure
proofRefs: []                   ← empty until real proofs exist
```

The Verify stage is what flips `pulseEnabled`/`pnlDisclosureAuthorized` to `true` — visibly, as an
explicit operator action, never a default the card arrives with.

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

**Amendment (2026-07-30, operator review): two fields in the original "before" schema were wrong** —
`pnlDisclosureAuthorized: true` implied consent that hadn't been given (fixed in §3.3 above), and
`standingStatus: "gateway-enabled"` skipped ahead of the actual progression this journey is supposed
to demonstrate:

```
not-enabled → eligible → accruing → established
```

`not-enabled` is correct at entry (no capability has been activated yet); `eligible` is what the
Verify stage produces (§3.7); `accruing` follows the first verified disclosure; `established` follows
a consistent pattern over time. Corrected before-state:

Before the cycle:
```json
{
  "core": { "name": "MoneyPenny", "capabilities": [], "serviceEndpoints": [] },
  "capabilities": {
    "payments": { "x402": true, "cryptoSent": true, "baseQCent": true, "bitCentTestnet": true },
    "financialTransparency": {
      "horizenPulseSupported": true,
      "pulseEnabled": false,
      "pnlDisclosureAuthorized": false
    }
  },
  "metame": {
    "passportClass": "agent-participant",
    "sponsorRef": null,
    "delegationRef": null,
    "standingRef": null,
    "runtimeAuthority": "inactive"
  },
  "authority": { "polityDelegatePassport": null, "delegationStatus": "not-yet-activated", "runtimeAuthority": "inactive" },
  "horizen": {
    "network": "base-sepolia",
    "registryContract": "...",
    "tokenId": null,
    "registryAlias": null,
    "pulse": { "enabled": false, "authorizationRef": null },
    "pnl": { "disclosureAuthorized": false, "proofRefs": [] }
  },
  "evidence": {
    "bitCentIssuanceRefs": ["<testnet-proof-ref>"],
    "horizenPnlProofRefs": [],
    "standingStatus": "not-enabled"
  }
}
```

After the cycle (fields renamed to `polityDelegatePassport*`, per §0.1 — supersedes the round-1
`agentParticipantPassport*` naming):
```json
{
  "metame": {
    "sponsorRef": "<commitment>",
    "delegationRef": "<commitment>",
    "polityDelegatePassportRef": "<commitment>",
    "runtimeAuthority": "active-bounded"
  },
  "authority": {
    "polityDelegatePassport": "<ref>",
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
(`standingStatus: "accruing"` is correct here — it's the third of the four states, reached right
after the first verified disclosure; `established` follows only after a consistent pattern over
time, and is not expected within the alpha demo's single walkthrough.)

### 3.5 The refined ten-step canonical sequence

This is the authoritative sequence — §7's seven bar-labels are a **condensed grouping** of these ten,
never a contradiction of their order.

**Correction (2026-07-30, operator review): proof of wallet control now precedes Marketa's final
recommendation, not the reverse.** The original draft placed Marketa Eligibility (step 3) ahead of
Sponsorship and Control Proof (step 5) — but Marketa's own assessment already includes "wallet
proven" as a criterion, so a *final* recommendation cannot legitimately be issued before that proof
exists. Marketa may still form an earlier, non-final **draft** assessment before control is proven;
her **final** recommendation may not precede it. Sponsorship is also decoupled from control proof
and moved after the operator's own passport resolves — sponsoring an agent is an act the operator
takes *as* a passport-holder, so the passport should resolve first.

1. **Horizen Registry Presence** — MoneyPenny enters as an active external agent: resolvable Agent
   Card, Horizen registry identity, controlling wallet, declared capabilities — **no** Agent
   Participant Passport, **no** operator-to-MoneyPenny delegation yet. Visible and technically
   controllable, not constitutionally authorised.
2. **Pulse and P&L Transparency** — activation moves the card from "financial-services capabilities
   claimed" to "capabilities + Horizen verification integration + Pulse consent + externally
   resolvable proof references." (See §3.3's correction — this is where `pulseEnabled`/
   `pnlDisclosureAuthorized` actually flip to `true`, not before.)
3. **Proof of Wallet Control** — a one-time wallet-control challenge; the operator signs with the
   agent wallet; the signer must match the wallet bound to the registered Agent Card; a
   proof-of-control receipt issues. **Wallet control proves the operator controls the registered
   agent — it does not by itself authorize the agent, and it must exist before Marketa's final word.**
4. **Marketa Eligibility (Final Recommendation)** — Marketa rediscovers MoneyPenny as she would any
   external agent: identity resolves, wallet **already proven** (step 3), card coherent, capabilities
   evidenced, Pulse/P&L enabled, sponsorship eligibility, authority boundable/revocable. Output:
   `RECOMMENDED FOR POLITY-BOUND DELEGATE ADMISSION`. **She is not approving Financial Services
   jurisdiction — only constitutional eligibility to become a delegated actor.** (An earlier, DRAFT
   assessment — §12.4 — may have run before step 3; only the *final* recommendation is gated on
   control proof.)
5. **Operator Passport** — the operator's own continuing **Polity Citizen Passport** resolves: valid,
   continuing, not revoked, sponsor-eligible. **The authority source is not MoneyPenny's wallet — it
   is the continuing personhood of her operator.**
6. **Sponsorship** — the operator, now confirmed as a valid Polity Citizen Passport-holder, records
   sponsorship of MoneyPenny. This is the act of a passport-holder, taken after the passport itself
   is confirmed valid.
7. **Bounded Delegation** — the proposed delegation (permitted/prohibited actions, networks, expiry)
   is displayed in full and approved with a contextual mandate.
8. **Polity Delegate Passport issued** — MoneyPenny moves from *external registered agent* to
   *polity-bound delegate*; the Polity Delegate Passport visibly links her Horizen identity, the
   operator's Polity Citizen Passport, the sponsorship, the delegation, the runtime,
   expiry/revocation, and Standing eligibility.
9. **FS Runtime Bootstrap** — because MoneyPenny would otherwise be both candidate and admitting
   authority for her own first admission, use the bootstrap rule (§3.6). **MoneyPenny does not
   self-authorize — her authority is activated by her operator following independent eligibility
   review.** After bootstrap, she becomes the FS Runtime's jurisdictional authority for *subsequent*
   agent admissions.
10. **Standing Gateway and Evidence Chain** — P&L transparency activation opened Standing eligibility
    at step 2 (§3.7 — it does not itself grant Standing); this final step is the consolidated
    read-view of every receipt in the chain, plus DVN anchor/pending status.

### 3.6 The bootstrap rule (self-admission paradox, resolved)

```
Marketa recommendation
+ valid operator Polity Citizen Passport
+ proof of control
+ bounded delegation
+ explicit operator bootstrap ratification
+ Aigent Z observation (default)
= initial MoneyPenny FS Runtime activation
```

**Default observer: Aigent Z** (2026-07-30, operator review; terminology synced 2026-07-31) — Aigent Z is already the authoritative
platform-state reporter and system orchestrator (`platform-state-reporter → aigentz@aigent`, ratified
the same day), so Aigent Z is the deterministic default for alpha; no runtime choice between observers
unless failover is actually required. **Platform Aletheon remains a configured alternative**,
reserved for a future constitutional-review context needing stronger separation — not a second
option the alpha demo should pick between live. This is the same observer/required-signatory shape
already built for Bitcent's pilot treasury authority gate (`services/treasury/
pilotTreasuryAuthority.js`) — reuse the pattern, do not invent a second one.

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
viewport rendering, or contextual Companion guidance. **Amendment (2026-07-30, operator
clarification):** every screenshot used in this PRD's early storyboarding for Verify/Passport/
Founder Office (§7 stages 2, 4, 7) was a placeholder, not a confirmed surface reference — locating
the REAL existing surface for each stage is required build work (§22), never a default license to
build a new one.

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

### 5.9 Composable Overlay Principle (added 2026-07-30, operator clarification on the storyboard)
> The guide is always an overlay on real, live platform surfaces. It is never itself the surface.

Every rendered tab, cartridge, modal, drawer, wallet or copilot panel a stage shows must be the
**real, live, unmodified (or durably-improved) component** — never a mock, a screenshot standing in
for a real screen, or a parallel rendering built to look like the platform. The journey narration
(stage title, Companion explanation, evidence summary) is composited **on top of** that real surface
as a thin overlay/pop-up — describing what is happening, never replacing what is rendered.

This composes freely: a stage's viewport may stack a cartridge tab + an agent drawer + a wallet
drawer + the Companion, simultaneously, all real, in whatever combination that stage needs. There is
no fixed one-surface-per-stage rule — decomposition and recombination of existing components is
explicitly permitted (§5.2 already forbids *forking* a surface; this principle clarifies that
*composing* several real surfaces together is not forking).

**The browser itself is a valid surface**, including for an external partner's own environment. When
a stage's completion depends on a partner's live system reflecting a real state change (e.g. Horizen
recognising MoneyPenny's registration), the journey should open **Horizen's own real page** — showing
Horizen's environment as Horizen actually presents it — rather than only showing metaMe's reflection
of that same fact. metaMe's own view (Agent Card, receipt, evidence panel) is shown *complementarily
alongside* the partner's live page, never as a substitute for it. This is the same discipline this
session has already applied to code and to secrets: ground claims in the real, live thing, never in
a mock or a memory of it.

### 5.10 aigentMe Onboarding Oversight Principle (new, 2026-07-31 addendum)
> The agent that carries a principal across the constitutional threshold does not thereby become that
> principal's aigentMe. aigentMe oversees onboarding and makes the incoming agent's domain relevance
> visible to the principal. The principal decides whether that relevance becomes part of their
> ExperienceQube population, and whether the agent becomes one of their delegated agents.

The relationship the journey must render is three distinct roles, never collapsed into one:

```
aigentMe
= onboarding guide, constitutional companion and continuity layer

Initial onboarding agent (e.g. MoneyPenny)
= candidate delegated agent carrying a particular domain, venture or experiential focus

Principal
= decides whether that focus should shape their ExperienceQube population
```

During onboarding, aigentMe identifies the incoming agent's declared capabilities and asks the
principal explicitly — e.g. *"This agent appears to represent a focus in [venture/domain area]. Is
this an important part of the experience you want to build?"* The principal then decides whether that
focus is: central to their ExperienceQube population; relevant but secondary; temporary for the
current journey; or not something they wish to carry forward. **The initial agent must never silently
define the principal's experience merely because it brought them into the system.**

The journey's flow through the threshold is therefore:

```
initial agent introduces or accompanies the principal
→ aigentMe assumes oversight of threshold crossing
→ aigentMe recognizes the initial agent and its likely focus
→ principal confirms or rejects that focus
→ ExperienceQube population is shaped accordingly
→ initial agent may become one of the principal's (up to three) delegated agents
```

This preserves the distinction the whole principle exists to protect: **the onboarding agent brings
context. aigentMe brings constitutional continuity. The principal determines relevance and
authority.** MoneyPenny is one of up to three principal delegated agents this pilot models (§7 stage
7) — her initial relevance is to the operator's own ExperienceQube population / venture focus (likely
aligned with her Financial Services domain), and Founder Office is a possible, secondary destination
her capabilities *may help with* — never the journey's own destination, which is aigentMe (§1, §17).

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

Supported alpha surface modes: `iframe`, `component`, `modal`, `drawer`, `receipt-view`,
`external-url` (§5.9 — the browser itself as a surface, for a partner's own live environment). Where
the Companion is already provided by the shell, do not duplicate it inside the journey page.

---

## 7. The seven-stage journey bar (condensed presentation of §3.5's ten steps)

**Corrected 2026-07-30 (operator review):** Claim's internal order now proves control *before*
Marketa's final recommendation (§3.5's step 3→4 correction); Sponsorship moved into Passport,
positioned after the operator's own passport resolves (§3.5 step 6); and completion for the stage
that carries payment is split into a required baseline and an optional live enhancement (no longer
an "or" between equally-weighted alternatives).

**Corrected 2026-07-31 (operator addendum):** the canonical passport term is now **Polity Delegate
Passport** (§0.1, supersedes round-1's "Agent Participant Passport"); stage 6 is renamed
**Transact → Activate** (regrouped: Polity Delegate Passport activation, bounded delegation
activation, FS bootstrap, Standing gateway eligibility, payment demonstration as optional evidence);
stage 7 is renamed **Founder Office → aigentMe** (the journey's actual destination — §5.10, §17), with
Founder Office repositioned as an optional next destination MoneyPenny's capabilities may help with,
not the journey's terminus.

| Bar stage | Groups (§3.5 steps) | Completion (authoritative) |
|---|---|---|
| **1. Register** | AigentQube resolved → Agent Card projected → Horizen Registry Presence | AigentQube record exists (`aigentqube-moneypenny`) ∩ Agent Card resolves as its projection ∩ tokenId exists ∩ registry reread succeeds ∩ owner wallet matches ∩ tokenId written back to the AigentQube's `external_registry_bindings` (§3.1.1) |
| **2. Verify** | Pulse and P&L Transparency | Pulse authorization verified ∩ P&L transparency enabled ∩ Agent Card enrichment committed |
| **3. Claim** | Proof of Wallet Control → Marketa Eligibility (Final Recommendation) | **fresh proof of wallet control ∩ Marketa final eligibility recommendation** (control first — a final recommendation may never precede it; an earlier Marketa DRAFT assessment may) |
| **4. Passport** | Operator Passport → Sponsorship → Polity Delegate Passport issued | valid operator Polity Citizen Passport ∩ sponsor binding ∩ Polity Delegate Passport issued |
| **5. Delegate** | Bounded Delegation + FS Runtime Bootstrap | Polity Delegate Passport ∩ active bounded delegation ∩ contextual mandate ∩ bootstrap approval ∩ Aigent Z observer receipt ∩ FS Runtime activation |
| **6. Activate** | Standing Gateway + FS bootstrap + optional payment demonstration | **Required:** Polity Delegate Passport active ∩ bounded delegation active ∩ Standing gateway enabled. **Optional live enhancement:** bounded payment mandate prepared and/or executed ∩ receipt. Payment capability strengthens the operational proposition but is never a constitutional prerequisite for reaching aigentMe (§5.7, generalized). |
| **7. aigentMe** | aigentMe activation + onboarding-focus disposition + Evidence Chain | aigentMe active as the principal's constitutional companion ∩ principal has confirmed/declined MoneyPenny's domain focus for their ExperienceQube population (§5.10) ∩ MoneyPenny recorded as one of the principal's delegated agents ∩ complete evidence chain readable |

**Stage 1 grounds the partner in their own reality, not ours** (added 2026-07-30, §5.9): Register
composes Horizen's own live registry/agent page (`external-url`) alongside metaMe's complementary
reflection (Agent Card component) — see §10.1's worked example. The partner should see their own
environment showing the registration, not only a metaMe description of it.

**Stage 1 has five sub-states, not one binary complete/incomplete** (added 2026-07-30, operator
review — external registries and chains lag, and the UI must not look frozen while waiting):

```
SUBMITTED → CONFIRMED → INDEXED → RESOLVED → COMPLETE
```

`SUBMITTED` (transaction sent) → `CONFIRMED` (on-chain confirmation, per Bitcent's own 3-confirmation
milestone earlier the same day) → `INDEXED` (Horizen's registry recognises it) → `RESOLVED` (the Agent
Card resolves the new identity) → `COMPLETE` (stage-level completion condition, above, is met). This
is precisely the confirmation-vs-indexer-recognition distinction the Bitcent testnet etch just
demonstrated live — do not let Stage 1's UI collapse that distinction back into a single spinner.

Companion narratives (per stage, templated for alpha):

- **Register:**
  - *Before:* "MoneyPenny has a persisted AigentQube and a published Agent Card. Horizen registration
    is still pending. Registry presence will establish external identity and discoverability, but not
    constitutional authority."
  - *Complete:* "MoneyPenny is now discoverable in Horizen. Registry presence proves identity and
    discoverability, but not constitutional authority."
- **Verify:** "Horizen has enriched MoneyPenny's verifiable operational state. It has not created or
  enlarged her constitutional authority."
- **Claim:** "Control has been proven without revealing the private key. Control does not yet equal
  authority."
- **Passport:** "The wallet proved control. The Passport now establishes the human source from whom
  authority may originate."
- **Delegate:** "Control says can. The Passport and delegation say may. The mandate says what
  MoneyPenny may do now."
- **Activate:** "MoneyPenny entered Horizen capable of paying. Horizen made her financial activity
  independently observable. Verified transparency now opens her pathway to Standing."
- **aigentMe (closing, generic threshold-crossing narrative — operator addendum, 2026-07-31):**
  "You have crossed the threshold. Your Polity Citizen Passport establishes your continuing
  constitutional personhood. aigentMe is now active as your constitutional companion. MoneyPenny has
  joined your agent set through a Polity Delegate Passport and may act only within the authority and
  mandates you have granted."
- **aigentMe (closing, MoneyPenny-pilot-specific narrative — operator addendum, 2026-07-31):**
  "MoneyPenny is no longer merely an agent in a registry. She is a discoverable, verified, sponsored
  and constitutionally authorized Financial Services agent, now recognized by aigentMe as one of your
  delegated agents. Her Financial Services focus may become part of your ExperienceQube population if
  you choose — she does not decide that for you. Founder Office is available to her as a next
  destination once you do."

Interaction rules: completed stages revisitable; current stage emphasized; ready stages clickable;
blocked stages inspectable but not executable; future stages show prerequisites; **clicking never
completes a stage**; horizontally scrollable / carousel on small widths; show stage number + status;
brief refusal/block reason on hover or click.

---

## 8. Journey stage schema

```ts
type JourneyStageState =
  | 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'REFUSED' | 'COMPLETE' | 'QUARANTINED';

// 'external-url' added 2026-07-30 (§5.9, Composable Overlay Principle) — the
// browser itself is a valid surface, including for a partner's own live
// environment (e.g. Horizen's real registry page for a registered agent).
type JourneySurfaceMode = 'iframe' | 'component' | 'modal' | 'drawer' | 'receipt-view' | 'external-url';

interface JourneySurfaceRef {
  mode: JourneySurfaceMode;
  ref: string;
  route?: string;
  /** Required when mode is 'external-url' — the real external page to open
   *  (e.g. Horizen's own agent/registry page), never a metaMe-internal route. */
  url?: string;
  entityRef?: string;
  props?: Record<string, unknown>;
  /** Human-readable note on what this surface is, for storyboard/build
   *  traceability — e.g. "Horizen's own live registry page for this agent,"
   *  distinct from metaMe's complementary reflection of the same fact. */
  note?: string;
}

interface JourneyStageDefinition {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  actor: string;
  subjectRef: string;
  /**
   * One or more real, live surfaces composed together for this stage (§5.9 —
   * composition, never forking). A stage MAY show more than one at once
   * (e.g. a partner's external-url page alongside metaMe's own drawer/tab
   * reflecting the same fact). The Companion/journey narration is always an
   * overlay on top of these — never counted as a "surface" itself.
   */
  surfaces: JourneySurfaceRef[];
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
recommendation; control-proof receipt; Passport state; sponsorship; Polity Delegate Passport;
delegation; mandate; runtime membership; Standing gateway; aigentMe activation state; ExperienceQube
focus disposition; receipts; payment/proof state. **Client navigation may select a stage; it cannot
set completion.**

## 10. Surface adapter

```ts
const JOURNEY_SURFACES = {
  // Built 2026-07-31: components/journey/AgentCardSurface.tsx — a faithful display wrapper over
  // app/api/agents/moneypenny/route.ts's real GET /api/agents/moneypenny/agent-card.json, never
  // reshaping its fields. Honestly renders tokenId: null as "not yet registered."
  'agent-card': AgentCardSurface,
  'ingestion-factory': IngestionFactorySurface,
  'agent-wallet': AgentWalletSurface,
  // Confirmed 2026-07-31: NO real surface exists for constitutional delegate-admission eligibility.
  // MarketaActivationEngineTab (app/(shell)/marketa/components/activation/MarketaActivationEngineTab.tsx)
  // is a domain-mismatched candidate — revenue/marketing-lane recruitment (STRATEGIC_LANES), not
  // admission eligibility. services/passport/externalAgentAdmission.ts explicitly states no Marketa
  // vetting workflow is implemented. This needs a genuinely new minimal component (§5.2/§5.9
  // case-by-case exception, justified) wrapping externalAgentAdmission.ts's real eligibility logic.
  'marketa-validation': MarketaValidationSurface,
  // Confirmed 2026-07-31: real nav item, PassportBureauApplyTab.tsx (tab slug `apply`,
  // polity-passport-bureau-cartridge) — but that's the application wizard, not an "own passport
  // status" screen. The self-view logic exists (services/passport/participationSelfView.ts,
  // passportPendingAuth.ts) but no confirmed screen renders it; PassportRegistryTab (slug `registry`,
  // same cartridge) is the leading candidate, not yet deeply verified.
  'passport-bureau': PassportSurface,
  // Confirmed 2026-07-31: real — PartnerProgrammesTab.tsx's "Constitutional Agreements" panel
  // (Venture Lab α cartridge, tab slug `partner-operate`, header "Pilot Command Center"), plus the
  // independently-mounted BoundedDelegationTab component at several cartridge slugs.
  'delegation': DelegationSurface,
  'financial-services-runtime': MoneyPennyRuntimeSurface,
  'trust-standing': TrustSurface,
  'evidence-chain': EvidenceSurface,
  // Confirmed 2026-07-31: real and live — AigentMeWelcomeSplitTab.tsx (metaMe cartridge, tab slug
  // `aigent-me`), the operator's copilot/dashboard shell (Brief/Move Forward/Venture
  // Progress/Ask Specialists capsules per the aigentMe Capsule↔Layout Contract). It is NOT a
  // threshold-crossing/continuity/onboarding-disposition surface — no such surface exists anywhere
  // in the repo. The journey composes this real shell as the base surface and needs one genuinely
  // new small component for the onboarding-focus-disposition prompt (§5.10) — the case-by-case
  // exception §5.2/§5.9 already allow, not a default.
  'aigentme': AigentMeSurface,
  // Confirmed 2026-07-31: real and substantial — FounderOfficeTab.tsx (Venture Lab α cartridge, tab
  // group `operate`, tab slug `founder-office`). NOT a placeholder, correcting the earlier
  // storyboard-era assumption in §22. Ready to compose as-is if the alpha demonstrates reaching it.
  'founder-office': FounderOfficeSurface,
};
```

For iframe-rendered routes, pass controlled params (`journeyMode=true`, `subjectRef=moneypenny`,
`stage=prove-control`). **Never weaken normal authentication or route authority. Never expose a
route through an iframe the user could not normally access.**

### 10.1 Composable, multi-surface stages (§5.9)

A stage is not limited to one entry in `JOURNEY_SURFACES`. Any real drawer, tab, cartridge, modal or
wallet may be stacked with any other for the same stage — decomposing and recombining existing
components is explicitly allowed; forking one to make it "fit better" is not (§5.2).

**Alpha focus rule (added 2026-07-30, operator review):** unrestricted composition can turn a stage
into a dashboard of competing panels. For alpha, cap it:

```
one primary surface + up to two supporting surfaces + one Companion panel
```

E.g. for Stage 1: primary = Horizen's registry page; supporting = MoneyPenny's Agent Card (+
optionally the receipt/evidence drawer); Companion = narrative and next action. This preserves the
richness the storyboard showed while keeping any single stage legible.

**Worked example — Stage 1 (Register), per the operator's storyboard correction:** the stage
composes **two** real surfaces simultaneously, not one:

```ts
surfaces: [
  {
    mode: 'external-url',
    ref: 'horizen-registry-agent-page',
    url: '<Horizen's real, live agent/registry page for MoneyPenny's tokenId>',
    note: "Horizen's own environment, showing the registration as Horizen actually presents it — grounds the partner in their own reality, not metaMe's description of it.",
  },
  {
    mode: 'component',
    ref: 'agent-card',
    entityRef: 'moneypenny',
    note: "metaMe's complementary reflection of the same registration — shown alongside, never instead of, Horizen's own page.",
  },
]
```

The Companion overlay narrates across both without becoming either.

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

### 11.1 Bounded Companion intents (added 2026-07-30, operator review)

`CompanionJourneyContext` describes what the Companion *knows*. This type constrains what it may
*do* — the Guided Sovereignty Principle (§5.4) made enforceable in a type, not merely descriptive:

```ts
type CompanionJourneyIntent =
  | 'EXPLAIN_STAGE'
  | 'OPEN_SURFACE'
  | 'PREPARE_ACTION'
  | 'SHOW_EVIDENCE'
  | 'SHOW_REFUSAL'
  | 'REQUEST_SOVEREIGN_ACTION';   // surfaces the action TO the operator — never performs it
```

The Companion may emit any of the six intents above. It has **no code path** to any sovereign act —
these are not merely forbidden by convention, they are simply absent from the type:

```
ACCEPT_PASSPORT      — does not exist as a Companion intent
CLAIM_AGENT           — does not exist as a Companion intent
GRANT_DELEGATION      — does not exist as a Companion intent
APPROVE_MANDATE       — does not exist as a Companion intent
```

`REQUEST_SOVEREIGN_ACTION` is the only bridge from Companion to a sovereign act, and it only ever
*surfaces* the action for the human operator to perform through the real surface underneath (§5.9) —
it never performs the act on the operator's behalf.

### 11.2 `OPEN_SURFACE` target types (added 2026-07-31, operator refinement)

`OPEN_SURFACE` needed a target shape to actually be dispatchable. Four target kinds, matching the
existing `JOURNEY_SURFACES` descriptor kinds (`services/journey/journeySurfaceRegistry.ts`) so the
Companion and the Partner Journey tab describe surfaces identically — one vocabulary, not two:

```ts
type OpenSurfaceTarget =
  | { kind: 'internal-route'; route: string }
  | { kind: 'cartridge-tab'; codexSlug: string; tab: string }
  | { kind: 'modal-or-drawer'; component: string; props?: Record<string, unknown> }
  | { kind: 'external-url'; url: string };
```

`external-url` opens through the browser/Companion shell — the Journey Runtime does not need iframe
support for arbitrary partner sites, and an external URL being unresolvable is a genuine data gap
(§14.1), never a Journey Runtime failure. `OPEN_SURFACE` never marks a stage complete; only real
receipts/state (§5.3, §9) do that.

### 11.3 Companion journey quick-link carousel (added 2026-07-31, operator refinement)

The Companion is the conversational entry point into the journey; the Partner Journey tab (§14) is the
authoritative visual execution surface. Both render from the **same** `JourneyDefinition` +
`JourneyRuntimeState` — never two journey definitions:

```
JourneyDefinition + JourneyRuntimeState
  → Partner Journey tab: the full stage stepper + current-stage viewport (§14)
  → Companion: a compact seven-chip quick-link carousel
```

Selecting a stage chip in the Companion does three things, in order: (1) selects the stage — the same
`selectedStageId` the Journey tab uses, so both views agree on "current" without two sources of truth;
(2) the Companion narrates that stage conversationally (templated from the journey definition per
§11, until generation is warranted); (3) the Companion emits `OPEN_SURFACE` for that stage's
registered surface(s) (`journeySurfaceRegistry.ts`), which opens in the left browser pane. A stage
completing (real receipt, §5.3) advances both renderings; a blocked/refused stage shows the same
refusal reason in both. The Companion never renders its own narrative panel inside the Journey tab
(§14.1) — this carousel is additive to the Companion's own existing surface, not a duplicate mounted
elsewhere.

**Implementation research, 2026-07-31 (Explore-agent audit, source-grounded):**

- `CodexCopilotLayer` — the real universal Companion — already mounts **unconditionally on every
  cartridge tab**, including Venture Lab's Partner → Journey tab (`app/triad/components/CodexPanelDynamic.tsx`
  lines ~1192-1213: `variant="floating"`, config-driven from `codex.copilot ?? {}`, defaulting to
  Aigent Z when a cartridge — like `VENTURE_LAB_CODEX` — declares no `copilot` block). **The floating
  Copilot activation control is not missing from Partner → Journey; it is already there**, and the
  first UI-review screenshot already shows it. §11.5 below narrows the real remaining gap.
- It already receives `groundContext={smartTriadContext}` and `contextId={`${codexId}-${activeTabSlug}`}`
  unconditionally — the "hand the copilot arbitrary JSON so it narrates accurately" seam already
  exists and reaches every mount, no new plumbing required to inject `JourneyRuntimeState` when
  `activeTabSlug === 'partner-pilot-journey'`.
- `resolveQuickLinks()` (`services/companion/quickLinks.ts`) is **not** the right extension point for
  the stage carousel, despite the surface-level similarity — it is deliberately, documentedly
  `_blank`-only (`cartridgeLinkTarget()`: "QUICK LINKS DRIVE THE BROWSER, NOT THE COMPANION"). A
  journey-stage chip must navigate the CURRENT left pane, not spawn a new tab — the correct existing
  precedent is `SmartTriadDeepLink`/`navigateDeepLink()`'s same-window pattern (`codex:navigate-tab`
  for same-cartridge, `buildCodexUrl` + same-window navigation for cross-cartridge), extended with a
  new same-shape event (e.g. `journey:select-stage`) for the sub-tab-level case `codex:navigate-tab`
  doesn't cover (selecting a stage WITHIN the already-mounted Journey tab, not switching tabs).
- `types/journey.ts`'s `CompanionJourneyIntent`/`CompanionJourneyContext` (§11.1) are the ratified,
  no-guessing contract for this feature and remain unconsumed by any component as of this revision —
  implementing them is filling in a specified gap, not inventing a new mechanism.

### 11.4 The canonical Companion trigger — `Horizen` (added 2026-07-31, operator ruling)

For the initial pilot, the sole invocation is a single word, typed in the Companion's own input, no
new command syntax:

```
Horizen
```

On recognizing it, the Companion must, in order: (1) resolve the configured
`HORIZEN_MONEYPENNY_JOURNEY`; (2) introduce it conversationally (fixed alpha copy is acceptable — see
below); (3) render the seven-chip quick-link carousel (§11.3); (4) select `Register` as the active
stage; (5) begin narrating Register from `stage.companion.before`; (6) emit `OPEN_SURFACE` to focus
the Partner Journey tab (or Register's first registered surface) in the left pane.

Alpha-acceptable fixed introduction copy:

```
You're entering the Horizen × metaMe constitutional admission journey for MoneyPenny.
We'll move through seven stages: Register · Verify · Claim · Passport · Delegate · Activate · aigentMe.
I'll explain each stage, open the relevant application or partner surface, and keep the journey
synchronized with the authoritative platform state. You retain all sovereign actions, including
claiming, sponsorship, delegation and mandate approval. We'll begin with Register.
```

Recognition should happen **client-side, before the message reaches `/api/codex/chat`** — matching
the existing `skipInference: true` quick-prompt convention (`resolveQuickLinks()`'s chips already skip
the LLM for a fixed action) — rather than adding server-side intent parsing to the shared chat route.
A raw typed "Horizen" (not just a pre-rendered chip click) needs an equality check against the trimmed,
lower-cased input before the send handler dispatches to the LLM, falling through to normal inference
for every other input.

### 11.5 One journey instance, multiple authorized renderers (added 2026-07-31, operator ruling)

The Companion Edge application, the in-application floating Copilot, and the Partner Journey tab must
never keep independent, client-local journey progress. All three consume one authoritative instance:

```ts
interface SharedJourneyContext {
  journeyId: string;
  journeyVersion: string;
  principalRef: string;
  polityCitizenPassportRef: string;
  activePersonaRef: string;
  subjectRef: string;
  selectedStageId: string;
  stageStates: Record<string, JourneyStageState>;
  receiptRefs: string[];
  authoritySummary: CompanionJourneyContext['authoritySummary'];
  lastSync: string;
}
```

Canonical invariant: **one journey state, multiple authorized renderers.** Both the Journey tab
(already reads `/api/journey/moneypenny-horizen/state`) and the Companion carousel read the SAME
endpoint/state shape — no separate Companion-side journey tracking is ever built.

### 11.6 Context may be transferred; authority must be re-resolved (added 2026-07-31, operator ruling)

The heaviest-lift item, correctly flagged as such by the operator. Several distinct identities must
never be conflated when the Companion asks an application surface to open on the operator's behalf:
authenticated account, Polity Citizen Passport, active application persona, Companion persona, agent
subject, wallet/controller. The rule:

> The Companion may carry a context handle identifying the expected journey and principal. It must
> never be accepted as proof of authority. The receiving application always re-resolves the
> authenticated principal, the active Polity Citizen Passport, and the active application persona
> through the identity spine (`getActivePersona`, per CLAUDE.md's Identity & Access Spine section) —
> never from Companion-supplied query parameters, local storage, or client state — and compares them
> against the journey's own principal/passport before opening a consequential surface.

On mismatch: refuse the consequential action, show "Journey principal confirmed / Application persona
mismatch," and offer an explicit choice (`Continue as <current persona>` / `Switch to
<journey-compatible persona>` / `Cancel`) — never a silent switch. A persona switch, being
consequential, is itself receipted. Companion persona and application persona may legitimately be
different functional roles (e.g. Companion acting as aigentMe's constitutional-companion context,
application acting as the operator/founder persona) provided both resolve to the same principal.

This is the **existing** identity-spine contract (`personaFetch`, `getActivePersona`,
`evaluateAccess`) applied to a new caller — the Companion — not a new spine. No new resolver, no new
gate, no parallel auth path: `OPEN_SURFACE`'s receiving route re-resolves through the same spine every
other route already must (CLAUDE.md's Identity & Access Spine section, PARAMOUNT). Building or
weakening any part of that spine to make this pilot's navigation smoother is exactly what CLAUDE.md's
"Files you MUST NOT modify without operator approval" list exists to prevent.

### 11.7 Pilot boundary — split into three constitutionally-sequenced passes (added 2026-07-31, operator ruling)

The `Horizen` trigger and synchronized carousel are presentation/orchestration changes — they do not
themselves create or enlarge authority. Principal/Passport/persona re-resolution governs whether
navigation may cross into consequential surfaces, so it is deliberately split out into its own
bounded, separately-reviewed pass rather than built alongside the presentation work:

- **Pass 1-2 (built, this revision):** client-side recognition of the exact prompt `Horizen`; fixed
  journey introduction copy; the seven synchronized journey chips; `journey:select-stage`
  synchronization between the Companion and the Partner Journey tab; same-window stage navigation via
  the existing `navigateDeepLink()` precedent (never `resolveQuickLinks()`, whose `_blank` behavior is
  the wrong interaction for this flow); shared, non-authoritative journey context through the existing
  Companion props (`groundContext`, `onUserPrompt`) and event model. Confirmed not a gap: the floating
  Copilot already mounts unconditionally on Partner → Journey (§11.3).
- **Pass 3 (separate, reviewed — not yet built):** principal/Passport/persona re-resolution before any
  consequential `OPEN_SURFACE` navigation. May call the existing `getActivePersona` and `personaFetch`
  mechanisms; must not alter PARAMOUNT identity-spine files without explicit operator approval
  (CLAUDE.md's Identity & Access Spine section). Scoped plan: §11.8.

**Temporary invariant, in force until pass 3 lands:**

> Journey synchronization may carry location and context, but not authority.

Concretely, until pass 3 is complete:

- Companion stage selection may navigate to read-only or non-consequential surfaces.
- Consequential actions continue to rely on their existing native authorization gates — nothing built
  in pass 1-2 bypasses or substitutes for those gates.
- No journey context value (`journeyId`, `selectedStageId`, `personaId` carried on a navigation) may be
  treated as proof of principal, Passport, persona, or authority by any receiving surface.
- `OPEN_SURFACE` must not create a new bypass around existing route protections — every route it
  navigates to re-resolves its own access exactly as it would if reached any other way.

**Acceptance test for pass 1-2:**

```
Type "Horizen"
→ intro renders
→ seven chips render
→ Register selected
→ left pane navigates in the same window
→ Partner Journey selection updates
→ selecting a stage on either side updates the other
→ no stage completes from selection
→ no sovereign action is executed
```

Deferred beyond pass 3 as well: automatic persona switching, cross-domain Companion Edge handoff,
external partner-site session correlation, the full Claude/MCP Threshold Crossing extension (§23),
signed portable context envelopes.

### 11.8 Pass 3 scoped plan — principal/Passport/persona re-resolution (added 2026-07-31, not yet built)

**What must be checked, in order, before a Companion-initiated `OPEN_SURFACE` may open a consequential
surface:**

```
expected journey principal        (SharedJourneyContext.principalRef, §11.5)
∩ authenticated application principal   (server-resolved, not Companion-supplied)
∩ active Polity Citizen Passport        (server-resolved via the identity spine)
∩ active application persona            (server-resolved via getActivePersona)
```

**Existing identity-spine functions this pass calls (never modifies):** `getActivePersona(request)`
(`services/identity/getActivePersona.ts`) to resolve the authenticated principal/persona server-side;
`personaFetch` (`utils/personaSpine.ts`) as the client-side transport carrying the Bearer token, per
CLAUDE.md's "client-side spine fetches MUST use personaFetch" rule; `evaluateAccess`
(`services/access/evaluateAccess.ts`) if the target surface's own gate requires an access decision
beyond identity resolution alone. None of these files are edited by this pass — they are called
exactly as every other spine-aware route already calls them.

**Files touched outside the spine (net new or additive):** a small comparison step — likely a
`resolveJourneyPrincipalMatch()` helper in `services/journey/` — that takes the server-resolved
principal/passport/persona (from the calls above) and the journey's own `principalRef`/
`polityCitizenPassportRef` (§11.5) and returns a match/mismatch verdict; the `OPEN_SURFACE` dispatch
path in `journeyCompanionTrigger.ts`, extended to call this helper before navigating to a stage marked
consequential in `journeySurfaceRegistry.ts` (a new `consequential: boolean` field on that registry,
defaulting `false` — additive, not a breaking change to existing entries).

**Consequential surfaces requiring the check (from the ten-step sequence, §3.5):** Proof of Wallet
Control (step 3), Sponsorship (step 6), Bounded Delegation (step 7), Polity Delegate Passport issuance
(step 8), FS Runtime Bootstrap (step 9). Register/Verify/the read-only evidence views remain
non-consequential and unaffected by this pass.

**Mismatch/refusal behavior:** refuse the consequential action; render "Journey principal confirmed /
Application persona mismatch"; offer exactly three choices — `Continue as <current application
persona>` / `Switch to <journey-compatible persona>` / `Cancel` — never a silent switch.

**Explicit persona-switch behavior:** an operator-chosen switch is itself a consequential act and must
be receipted (mirrors every other consequential-action receipt requirement in §15) — it is not exempt
merely because it originates from a Companion-guided flow.

**Receipt requirements:** the match/mismatch decision itself does not need its own receipt (it is a
read, not a state transition); an executed persona switch does, per the bullet above; the eventual
consequential action (sponsorship, delegation, etc.) already has its own required receipt type per §15
— this pass does not add or change those, it only gates when the surface offering them may open.

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
4. the existing operator Polity Citizen Passport resolves
5. sponsorship binds to the correct operator
6. a bounded delegation can be created
7. the Polity Delegate Passport can be issued and reread
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

**Do NOT finalize before the live walkthrough:** Marketa's final recommendation; Polity Delegate
Passport issuance; bounded delegation activation; FS Runtime bootstrap admission.

### 12.5 Never reset constitutional history

Once an agent has genuinely received a Polity Delegate Passport, do not erase or rewrite that history to
recreate a demo — a revoked test passport still leaves a historical issuance receipt, so the
demonstration would never truly be "from scratch," and doing so conflicts with the receipt/continuity
model this entire platform is built on.

**Record the Nakamoto rehearsal** as internal test evidence / backup footage / a fallback source —
but the primary partner demo is the live MoneyPenny walkthrough, not the recording.

### 12.6 Deterministic fallback

Before the live session, capture signed snapshots of every expected state (MoneyPenny registered →
Pulse activated → Marketa recommendation → passport validated → delegation preview → Polity Delegate
Passport issued → runtime activated → aigentMe activated → evidence chain complete). If an external network fails during
the live walkthrough, switch **visibly** to the previously receipted rehearsal replay and **state
explicitly** that it is recorded evidence, never a silent stand-in for a live transaction (Evidence
Replay Mode, §13.3 below).

## 13. Pilot demonstration modes

**13.1 Rehearsal mode** (Nakamoto) — validate full mechanics, exercise positive+refusal paths, create
backup evidence, avoid consuming MoneyPenny's live moment.

**13.2 Live pilot mode** (MoneyPenny) — real Horizen registration, real transparency activation,
real constitutional admission, real activation of aigentMe as the operator's constitutional
companion, with Founder Office available as a next destination.

**13.3 Evidence replay mode** — present a previously receipted run if an external network becomes
unavailable, clearly labeled as recorded evidence, never a silent live simulation.

## 14. Alpha UI

**Pilot header:**
```
Horizen × metaMe
MoneyPenny Constitutional Admission Journey
Destination: aigentMe (Founder Office available as a next destination)
```
Shows: current stage; overall journey state; subject; partner; current actor; last receipt; last
sync.

**Evidence drawer:** evidence required; evidence present; latest receipt; anchor status; refusal
reason; deterministic reread link.

### 14.1 UI corrections, 2026-07-31 (operator review of the first build)

- **Stage stepper, not a boxy button row.** The journey bar is circles connected by lines — numbered,
  checkmarked on completion — mirroring `AccessionProgressBar.tsx` (the IRL onboarding stepper)
  exactly, not a novel visual pattern. Clicking a node still only selects a stage's viewport; it never
  completes one (§5.1 unchanged).
- **No embedded Companion column.** The stage viewport is full width. The platform's real Companion
  (Metayé) is a separate, independently-toggled overlay elsewhere in the shell — PilotJourneyTab must
  never render its own narrative column that duplicates it. (This was a live violation of the
  Composable Overlay Principle, §5.9, in the first build — corrected.)
- **No "Pilot Command Center" header above the journey.** That header (workspace-selector chips +
  Health/Phase/Milestone/Owner/Open-Actions/etc. metric tiles) is `PartnerProgrammesTab`'s persistent
  header, rendered above every Partner sub-surface — now suppressed specifically for
  `initialSurface: 'journey'`. It remains exactly as-is for Operate/Evidence/Collaborate/Communicate.
- **Full-screen toggle.** Mirrors the old cartridge full-screen convention: an expand/collapse button
  raises the stepper + viewport above the shell's z-index via a `createPortal` to `document.body` —
  not a modal, not a popup, the same content rendered outside the Venture Lab shell so it can occupy
  the full viewport. Escape also collapses it. **Not yet resolved:** whether full-screen mode should
  also surface the Partner sub-menu (so the operator can jump to Program Command Center etc. without
  collapsing first) — this needs one more investigation pass into which component owns that outer tab
  strip before it can be wired correctly; the current full-screen view shows the journey content only.
- **Journey moved to the end of the Partner sub-menu**, after Administer (previously between
  Collaborate and Operate) — order: Collaborate, Operate, Evidence, Communicate, Administer, Journey.
- **"Administration" relabelled "Administer"** (id/slug/`initialSurface` value unchanged) to match the
  verb pattern of its Partner-group siblings.

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
aigentme.activated                 experienceqube.focus.disposition.recorded
journey.completed
```

`agent.delegate-passport.issued` (renamed 2026-07-31, reverting to and finalizing this shape — supersedes
round-1's `agent.participant-passport.issued`) and the two new types `aigentme.activated` /
`experienceqube.focus.disposition.recorded` (new, 2026-07-31 — cover aigentMe's activation and the
principal's confirm/decline decision on MoneyPenny's domain focus, §5.10) still need reconciliation
against the real `ActivityActionType` union per §22's note below — reuse an existing type if one
already fits, per `inv.engineering.037`.

### 15.1 Visual grouping for the evidence-chain view (added 2026-07-30, operator review)

Eighteen flat event types are hard to present. **Canonical action types are unchanged above** — this
is a presentation grouping only, into the five classes the Control–Authority–Mandate doctrine
already names (Identity added as the class that precedes Control):

```
Identity                          Control
- card discovered                 - wallet control proven
- Horizen registered
- card enriched

Authority                         Mandate
- Marketa recommended             - bootstrap approved
- passport validated              - payment mandate approved
- sponsorship recorded
- Polity Delegate Passport issued
- delegation granted

Consequence
- runtime activated
- transparency enabled
- Standing gateway enabled
- payment prepared/executed
- aigentMe activated
- ExperienceQube focus disposition recorded
```

This directly reinforces the doctrine the journey exists to teach: *Identity locates the agent.
Control proves the claimant can operate it. Authority legitimizes the relationship. Mandate
constrains the consequence. Receipts prove what occurred.*

## 16. Refusal cases

See §12.3 for the full list — reproduced here as the alpha's required refusal coverage, not merely
a rehearsal checklist.

## 17. aigentMe destination (Founder Office as an optional next step) (rewritten 2026-07-31, operator addendum)

**The journey must terminate at aigentMe's activation, not at Founder Office.** Founder Office is
real, valuable, and MoneyPenny's capabilities may genuinely help with it — but it is a possible
*next* destination reachable from aigentMe, never the journey's own terminus (§5.10). Collapsing the
two would let MoneyPenny's onboarding focus silently define the principal's experience, which §5.10
exists to forbid.

**Completion condition:** aigentMe is active as the principal's constitutional companion ∩ aigentMe
has surfaced MoneyPenny's declared domain focus to the principal ∩ the principal has recorded a
disposition on that focus (central / relevant-but-secondary / temporary / not carried forward) ∩
MoneyPenny is recorded as one of the principal's delegated agents ∩ the evidence chain is complete
and readable.

**Final surface, showing:**
- aigentMe active, presented as the principal's constitutional companion and continuity layer
- MoneyPenny recognized as one of the principal's delegated agents (one of up to three), with her
  current bounded authority, wallet/settlement capabilities, Horizen transparency status, and
  Standing state
- The principal's recorded disposition on MoneyPenny's Financial Services focus for their
  ExperienceQube population
- Founder Office offered as an available next destination, not a landing the journey forced
- Authority/mandate boundaries and the evidence link

> The pilot does not end at registration or credential issuance. It ends where aigentMe recognizes
> the agent that carried the principal across the threshold, and the principal — not the agent —
> decides what that agent's focus means for the experience they are building.

## 18. Alpha deliverables (runbooks, not just code)

1. rehearsal runbook (Nakamoto)
2. live MoneyPenny runbook
3. demo presenter script
4. preflight checklist
5. rollback/quarantine procedure
6. expected receipt list
7. deterministic fallback package for network failure

Minimal additional build beyond orchestration: persistence for Marketa's provisional recommendation
if not yet durable; Polity Delegate Passport issuance wiring; operator bootstrap approval for
MoneyPenny; aigentMe activation + onboarding-focus-disposition wiring (§5.10); receipt aggregation
into one evidence-chain view; a rehearsal fixture for Nakamoto; a live-demo state manifest.

## 19. Implementation priority

**P0, step zero — the Surface Discovery Gate (§22) completes first.** No stage's viewport is built
against an unverified surface; the surface map table in §22 must be filled in (real route/component
per stage, or an explicit, case-by-case "minimal new component" decision) before that stage's UI
work starts. Other stages may proceed once their own row is resolved, even if another stage's isn't.
**Status, 2026-07-31: the discovery pass is complete for all seven rows.** Four stages (Register,
Delegate, Activate, Founder Office) compose confirmed real surfaces as-is. Three have an explicit,
justified build-new decision for a specific missing piece (Verify's transparency toggle; Claim's
Marketa-eligibility view; aigentMe's onboarding-disposition prompt, layered on a real reused base) —
never a default, always because no existing surface was found. Passport has one open confirmation
(`PassportRegistryTab`'s content) before its row is final. Register's Horizen page URL cannot be
resolved from this repo and must come from Horizen or their partner brief before that half of Stage 1
is built.

**P0 — required:** Pilot tab in Partner workspace; reusable journey definition type; seven-stage
Horizen journey; journey bar; stage viewport; authoritative state resolver; existing-surface routing;
Companion stage context; evidence summary; Nakamoto rehearsal configuration; MoneyPenny live
configuration; aigentMe destination (§5.10, §17), with Founder Office as an optional next
destination; refusal-safe progression; the seven deliverables in §18.

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
10. the final stage activates aigentMe as the principal's constitutional companion, surfaces
    MoneyPenny's declared domain focus, and records the principal's disposition on it (§5.10) —
    Founder Office is offered only as an available next destination, never opened automatically
11. all existing core surfaces continue to function normally outside journey mode
12. no constitutional gate is weakened
13. blocked and refused stages are visible and recoverable
14. the implementation produces the capability artifact (§21)
15. constitutional history is never reset/reissued to stage a demo (§12.5)
16. all seven deliverables in §18 exist, not only the runtime code
17. the §22 surface map is complete for every stage before that stage's UI is implemented — no
    stage's viewport was built against an unverified or placeholder surface

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

## 22. P0 Surface Discovery Gate — must complete before any UI implementation begins

**Promoted from "open questions" to a hard gate (2026-07-30, operator review).** This is no longer
research mixed into the build — it is a required P0 output that precedes UI work, exactly like a
migration precedes a table write. No stage's viewport is implemented against a surface that hasn't
been verified real.

**Required output — the surface map, one row per stage. Completed via Explore-agent research,
2026-07-31 — this is the actual, verified state of the codebase, not a plan:**

| Stage | Real surface | Route/component | Required props | Current gap | Decision |
|---|---|---|---|---|---|
| Register | MoneyPenny Agent Card (built) + Horizen registry page (unconfirmed) | `AgentCardSurface.tsx` over `app/api/agents/moneypenny/route.ts` (`GET /api/agents/moneypenny/agent-card.json`) + Horizen API base `services/horizen/client.ts`'s `HORIZEN_REGISTRY_API` | `tokenId`/`registryAlias` | Agent Card display: **done** (2026-07-31) — a faithful display wrapper, honestly renders `tokenId: null` as "not yet registered." Horizen exposes only API read endpoints (`/agents/{registryAlias}`, `/agents/{registryAlias}/pulse-status`) in this repo; **no confirmed human-browsable Horizen page URL exists in code** — must be obtained from the Horizen partner brief or Horizen directly, not guessed (per CLAUDE.md's no-guessing rule) | Compose (Agent Card display) — **done**; Horizen's page URL still needs confirming out-of-band |
| Verify | **Confirmed: does not exist** | — | — | Only read-only backend fetchers exist (`services/horizen/client.ts`'s `readPulseStatus` etc.) — no `pnlDisclosure`/`pulseEnabled`/`financialTransparency` UI anywhere. Genuinely new, not a "wrong surface" — no surface at all. | **Build new** (case-by-case exception, justified — no existing toggle surface exists to reuse) |
| Claim | Wallet-control challenge route (existing) + Marketa eligibility review (**confirmed: does not exist for this domain**) | Wallet-control: TBD exact route. Marketa: `MarketaActivationEngineTab.tsx` exists but is domain-mismatched (revenue/marketing-lane recruitment, not constitutional admission — confirmed via `services/passport/externalAgentAdmission.ts`, which states no Marketa vetting workflow is implemented) | — | Marketa's eligibility-for-admission surface must be built new, wrapping `externalAgentAdmission.ts`'s real logic — not a thin wrapper over the marketing-lane tab | Compose (wallet-control) + **build new** (Marketa eligibility view, case-by-case exception, justified) |
| Passport | Passport Bureau — Apply wizard confirmed real; "own status" view not confirmed | `PassportBureauApplyTab.tsx` (tab slug `apply`, `polity-passport-bureau-cartridge`); leading candidate for a status view: `PassportRegistryTab` (slug `registry`, same cartridge) — not yet deeply verified | — | The Apply tab is the intake wizard, not a status display; confirm whether `PassportRegistryTab` already shows valid/continuing/sponsor-eligible state before building anything new | Compose, pending confirmation of `PassportRegistryTab`'s actual content |
| Delegate | Constitutional Agreements panel (confirmed real) + `BoundedDelegationTab` (confirmed real) | `PartnerProgrammesTab.tsx` "Constitutional Agreements" panel, Venture Lab α cartridge, tab slug `partner-operate`, header "Pilot Command Center"; `BoundedDelegationTab` mounted independently at several cartridge slugs | — | Minor — confirm which mount of `BoundedDelegationTab` fits this journey's delegation object | Compose |
| Activate | Wallet + mandate + Trust + Standing gateway | `agent-wallet` + Companion; `standing_accrued` (existing receipt type, §15) | — | Not separately investigated this round — carried forward unchanged | Compose |
| aigentMe | `AigentMeWelcomeSplitTab.tsx` confirmed real and live (the operator's copilot/dashboard shell) — composed as the base surface, per the plan below. The confirm/decline-focus prompt is **built**: `AigentMeFocusDispositionPrompt.tsx`. | metaMe cartridge, tab slug `aigent-me`; `components/journey/AigentMeFocusDispositionPrompt.tsx` + `/api/journey/moneypenny-horizen/aigentme/disposition` | principal ref (spine-resolved), MoneyPenny's declared domain focus, disposition options (§5.10) | None remaining — built 2026-07-31, writes `aigentme_activated` + `experienceqube_focus_disposition_recorded` | Compose (welcome shell) + component (disposition prompt) — **done** |
| Founder Office (optional next destination) | **Confirmed real and substantial — corrects the earlier storyboard-era "placeholder" assumption** | `FounderOfficeTab.tsx`, Venture Lab α cartridge, tab group `operate`, tab slug `founder-office` | — | None — this surface is ready to compose as-is | Compose |

Two rows still have a **confirmed, justified "build new"** decision open (Verify, and the
Marketa-eligibility half of Claim) — each is the case-by-case exception §5.2/§5.9 already require, not
a default, and each is justified by a confirmed absence of any existing surface, not by convenience.
The aigentMe row's build-new piece is **done** (2026-07-31): `AigentMeFocusDispositionPrompt.tsx`,
layered on the real, reused `AigentMeWelcomeSplitTab` base — the journey's §5.10 disposition-recording
requirement is now real, not a placeholder. Passport's row still has one open confirmation
(`PassportRegistryTab`'s actual content) before its decision is final. Register's Horizen-URL half
cannot be resolved from this repo's code alone — it needs the actual URL from Horizen or their partner
brief, never a guessed one.

- **Verify's real surface** — confirmed absent, 2026-07-31. Not merely "the storyboard's placeholder
  was wrong" (though it was) — there is no financial-transparency toggle UI at all in this codebase,
  only backend read-only Pulse/PnL fetchers. Build new (case-by-case exception, justified).
- **Marketa's real assessment surface** — confirmed absent for this domain, 2026-07-31.
  `MarketaActivationEngineTab.tsx` is a real, live surface but for a different subject
  (`STRATEGIC_LANES` revenue/marketing-lane recruitment, statuses like `application_recommended`,
  `pending_passport`) — not constitutional delegate-admission eligibility.
  `services/passport/externalAgentAdmission.ts` explicitly states no Marketa vetting workflow is
  implemented. Build a new minimal component wrapping that service's real eligibility logic — do not
  reuse or wrap the marketing-lane tab, which would misrepresent what it's actually showing.
- **Passport Bureau's real screen** — the Apply wizard (`PassportBureauApplyTab.tsx`, slug `apply`)
  is confirmed real but is the *intake* flow, not a status view. `PassportRegistryTab` (slug
  `registry`, same cartridge) is the leading candidate for the "valid/continuing/sponsor-eligible"
  status screen this stage needs — confirm its actual content before deciding compose vs. build-new.
- **aigentMe's real surface** — the journey's actual terminal stage (renamed from Founder Office,
  2026-07-31). `AigentMeWelcomeSplitTab.tsx` (tab slug `aigent-me`) is confirmed real and live, and
  is the closest thing to "aigentMe's own surface" in the repo — but it is the operator's existing
  copilot/dashboard shell (Brief, Move Forward, Venture Progress, Ask Specialists capsules per the
  aigentMe Capsule↔Layout Contract), not a dedicated continuity/threshold surface. Compose this real
  shell as the base, and build the one genuinely new piece — the onboarding-focus-disposition prompt
  (§5.10) — as a small component layered on top, never a fork of the shell itself.
- **Founder Office's real screen** — **confirmed real and substantial**, 2026-07-31, correcting the
  earlier storyboard-era placeholder assumption: `FounderOfficeTab.tsx` (Venture Lab α cartridge, tab
  group `operate`, tab slug `founder-office`) is a live Workspace/Discover/Validate/Architect/
  Blueprint surface over `/api/venture/*`. Ready to compose as-is if the alpha demonstrates reaching
  it as the optional next destination (§17).
- **Delegation UI** — confirmed real, 2026-07-31: "Venture Lab α → Partner Pilot Command Center →
  Constitutional Agreements" is exactly the storyboard-suspected surface
  (`PartnerProgrammesTab.tsx`, tab slug `partner-operate`), plus the independently-mounted
  `BoundedDelegationTab` component.
- **Horizen's real external agent/registry page URL** — needed for Stage 1's `external-url` surface
  (§10.1). Confirmed 2026-07-31: this repo contains only Horizen's **API** base
  (`services/horizen/client.ts`'s `HORIZEN_REGISTRY_API`, e.g. `/agents/{registryAlias}`), not a
  confirmed human-browsable page URL. Per CLAUDE.md's no-guessing rule, this must be obtained from
  Horizen or their partner brief directly — never constructed or inferred.
- **Receipt-type reconciliation** (§15) — **completed, 2026-07-31, via Explore agent against
  `services/receipts/activityReceiptService.ts`'s real `ActivityActionType` union.** Of the eighteen
  proposed types, 6 map to existing types (reuse, don't duplicate, per `inv.engineering.037`):
  `agent.delegation.granted` → **`agent_delegated`** (exists verbatim); `horizen.pulse.authorized` →
  **`partner_agent_evidence_recorded`**; `financial-services-runtime.activated` →
  **`finance_authoritative_execution`**; `standing.gateway.enabled` → **`standing_accrued`** (note: a
  genuine semantic gap — "gateway enabled" vs. "accrual" — worth a second look, not a blocker);
  `payment.executed` → **`finance_authoritative_execution`** or **`qriptocent_destination_credit_completed`**
  (latter only if settlement is Qriptocent-denominated); `payment.mandate.approved` → check against
  **`agreement_authorized`** before minting new (same "authorize under agreement" shape). The
  remaining ~9 — `agent.card.discovered`, `horizen.agent.registered`, `horizen.pnl.transparency.enabled`,
  `agent.card.enriched`, `agent.control.proven`, `marketa.eligibility.recommended`,
  `operator.passport.validated`, `agent.sponsorship.recorded`, `agent.delegate-passport.issued`,
  `journey.completed` — are confirmed genuinely new (no equivalent found anywhere in the union,
  including the unrelated Polity Passport Bureau's own `passport_*` types, which are a different
  subject domain). Add these the same 3-file way `bitcent_treasury_etch_executed` was added
  (`2026-07-30_bitcent-supabase-wiring-and-ops-surfacing.md`): the `ActivityActionType` union, the
  `ANCHORABLE_ACTION_TYPES` set in `services/dvn/activityReceiptDvnPipeline.ts`, and the
  `activity_receipts_action_type_check` CHECK constraint (rebuilt in full via a new migration, per the
  `bitcent_treasury_receipt_type.sql` precedent). `aigentme.activated` and
  `experienceqube.focus.disposition.recorded` are confirmed genuinely new as well (expected — they're
  this addendum's own new evidence classes).
- **Nakamoto's wallet** — confirm it is a real, already-funded wallet (mirroring the operator's own
  Bitcoin wallet reuse for the Bitcent etch) before rehearsal, so funding delay doesn't eat into
  tomorrow's timeline.
- **MoneyPenny's owner wallet for Horizen registration** — still needs a funded Base Sepolia wallet
  (flagged when the registration script was built); this journey's Stage 1/Claim depends on it
  existing before rehearsal even starts.

## 23. Threshold Crossing alignment (added 2026-07-31, operator direction — recorded, not built)

The MoneyPenny × Horizen seven-stage journey (§7) is not the entire onboarding story. It is the
agent-admission segment configured *inside* a wider journey — **Threshold Crossing** — which for a
technical founder/operator plausibly runs:

```
1. Founder is working in Claude / Claude Code
2. metaMe MCP is installed
3. constitutional Companion is established
4. Companion identifies the operator and the onboarding agent
5. Polity Citizen Passport process begins
6. onboarding agent is assessed and admitted        ← the configured Register→aigentMe journey (§7)
7. aigentMe assumes constitutional oversight
8. principal decides whether the agent's focus enters the ExperienceQube population
9. agent becomes one of up to three delegated agents
10. next destination is selected
```

Read against §8 (Claude remains the acquisition/setup edge): Claude is where a technical founder first
encounters and installs the metaMe capability; the Companion then carries the guided constitutional
journey; aigentMe is the enduring constitutional companion after the threshold is crossed. None of this
means aigentMe lives inside Claude — Claude is the edge, not the destination.

**This is recorded as the next journey envelope, not implemented in this increment.** The immediate,
in-scope work is completing the Partner Journey tab + Companion synchronization (§11.2, §11.3, §14.1).
Building the Claude/MCP-to-Threshold-Crossing extension is deliberately deferred — attempting both at
once risks the same "parallel demo app" failure mode §0 already warns against.

## 24. Guided Journey Runtime — Surface and Ceremony Invariants (added 2026-07-31, operator ruling — canonical, not Horizen-specific)

These twelve invariants generalize the Passport/Delegate/Activate surface decision and the aigentMe
MoneyPenny-focus ceremony into standing rules for the Guided Journey Runtime. They apply to every
future journey configured on this runtime, not only the MoneyPenny × Horizen pilot — the pilot is
simply where they were first tested against a real build.

### Journey Surface Purity (§24.1)

A journey stage should render the smallest authoritative functional surface required to complete
that stage. The journey must not inherit an entire cartridge, shell, menu system, or navigation
hierarchy merely because the underlying capability lives there.

```
capability → isolate functional surface → render without surrounding navigation
```

Not:

```
journey stage → open whole cartridge → require participant to navigate to the relevant function
```

The journey carries the participant to the act. It does not send them searching for it.

### Canonical Surface Reuse (§24.2)

Where a capability already has a clean, journey-ready surface, the journey must reuse that surface
rather than returning to a more comprehensive but noisier source application. For the current
constitutional journey, the canonical surfaces are the Venture Lab α Participate views:

```
Passport → Apply
Delegate → Delegate
Activate → Standing
```

These supersede the use of the full Polity Passport Bureau cartridge, the full Standing cartridge,
and broader delegation or registry surfaces where the Participate version already provides the
required function. The Venture Lab α Participate surfaces are preferred because they have already
been reduced to the information and actions necessary for the journey.

### Functional Surface Precedence (§24.3)

The source of constitutional authority and the source of journey presentation need not be the same
application surface. The Polity Passport Bureau may remain authoritative for Passport infrastructure
and records, while the Journey Runtime presents the stripped Apply surface from Venture Lab α.
Likewise:

```
authoritative Passport machinery ≠ journey presentation surface
authoritative Standing machinery ≠ journey presentation surface
```

The journey reuses the most appropriate interface without changing the underlying authority.

### Navigation Suppression (§24.4)

A journey-rendered capability should not display its parent cartridge navigation unless that
navigation is necessary to complete the current stage. For the Apply, Delegate, and Activate stages,
suppress Venture Lab top menus, Partner submenus, Participate navigation, cartridge tabs, and
unrelated contextual controls. Render only the functional modal, panel, or component. The participant
should see stage purpose, functional surface, required action, and current evidence state — nothing
else unless it materially supports the act.

### No Incidental Journey Expansion (§24.5)

A capability that is adjacent to the journey must not be added merely because it is present in the
source application. The Participate Locker remains outside the initial journey because it is not
required for the admission sequence:

```
Apply, Delegate, Standing = required journey surfaces
Locker = available in Participate, but not currently part of the journey
```

Locker may later be added as its own explicit stage or supporting surface. It must not appear
incidentally.

### Stage-to-Surface Singularity (§24.6)

Each journey stage should have one clearly identified primary functional surface:

```
Passport stage  → Participate / Apply
Delegate stage  → Participate / Delegate
Activate stage  → Participate / Standing
```

Supporting surfaces may appear where needed, but the primary action must remain unambiguous. This
prevents the stage from becoming a dashboard containing several competing interpretations of what the
user should do next.

### aigentMe Closing Ceremony Invariants

### Conversational Question, Visual Answer (§24.7)

Where aigentMe needs a principal to make a simple constitutional or experiential choice, the question
should be asked conversationally and the answer should be captured through a focused capsule. For
MoneyPenny's arrival, aigentMe/Copilot asks: "MoneyPenny appears to represent a focus in Financial
Services. Is that an important part of the experience you want to build?" The right-pane capsule
presents the four dispositions (Central, Relevant but secondary, Temporary, Not carried forward). The
conversation creates understanding. The capsule captures the structured decision.

### Ceremony Capsule Principle (§24.8)

A closing constitutional ceremony should be represented as a temporary, purpose-specific capsule
rather than permanently expanding the destination interface. The MoneyPenny focus-disposition
component is therefore a Welcome Capsule overlaid in the right pane of the aigentMe experience — it
must not be permanently inserted at the bottom of the aigentMe tab, must not compress or distort the
existing aigentMe layout, and must not create a new persistent section for a one-time decision. It
appears when required, records the principal's response, and closes when complete.

### Ephemeral Interface, Durable Consequence (§24.9)

A journey capsule may be temporary in presentation while its decision remains durable in state and
evidence:

```
aigentMe asks → capsule opens → principal selects disposition → disposition is recorded
→ receipt is issued → capsule closes
```

The interface disappears. The constitutional and ExperienceQube consequences remain.

### One Decision, No Unnecessary Continuation (§24.10)

Once a bounded journey decision has been made and receipted, the journey must not manufacture
additional steps merely to preserve screen activity. For the initial pilot, after the principal
answers the MoneyPenny focus question: record the disposition, issue the required receipt, close the
capsule, complete the closing ceremony. No additional questionnaire, setup form, or profile-editing
sequence is required.

### Experience Sovereignty (§24.11)

An onboarding agent may propose a likely domain focus, but only the principal may determine whether
that focus becomes part of their ExperienceQube population. MoneyPenny's Financial Services role is
evidence for the inference, not authority to populate the principal's experience:

```
incoming agent suggests relevance → aigentMe makes the relevance visible
→ principal determines its meaning → ExperienceQube population reflects that decision
```

### aigentMe Layout Preservation (§24.12)

Journey-specific ceremonies must adapt to the aigentMe capsule architecture rather than forcing the
aigentMe architecture to adapt around the journey. The existing left/right model remains: left pane is
the aigentMe/Copilot conversation, right pane is the temporary Welcome Capsule with disposition
choices. This preserves the native aigentMe experience while allowing the journey to complete within
it.

### Canonical stage mapping for the pilot

```
Register  → AigentQube / Agent Card / Horizen registration surfaces
Verify    → Pulse and P&L authorization surface
Claim     → proof-of-control + Marketa eligibility surfaces
Passport  → Venture Lab α Participate / Apply functional surface
Delegate  → Venture Lab α Participate / Delegate functional surface
Activate  → Venture Lab α Participate / Standing functional surface
aigentMe  → aigentMe conversation + temporary Welcome Capsule
```

No Venture Lab menus or submenus should be rendered inside the Apply, Delegate, or Activate stage
viewports.

### Consolidated constitutional formulation

A guided journey must render the minimum authoritative surface required for the present act. It may
reuse capabilities from broader applications, but it shall suppress unrelated navigation, adjacent
functions, and interface noise. Conversational guidance belongs to the Companion; structured decisions
belong in focused capsules; temporary ceremonies may close, but their receipts and constitutional
consequences endure.

Shortest product rule: **show the act, not the application that contains it.**
