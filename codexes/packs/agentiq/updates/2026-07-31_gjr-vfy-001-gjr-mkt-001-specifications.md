# GJR-VFY-001 / GJR-MKT-001 — Approved Post-Review Implementation Package

**Status: approved, operator-ratified 2026-07-31. Not yet implemented — this is the recorded specification the implementation must be built against, per the operator's explicit instruction to record it before building.**

This is the follow-on implementation package for the Guided Journey Runtime's Verify and Claim stages, superseding the earlier honest "not yet built" placeholders (`pulse-transparency-toggle`, `marketa-eligibility-view`) in `services/journey/journeySurfaceRegistry.ts`. It replaces pilot-shaped UI simulations with two real platform capabilities, implemented independently and then composed into PRD-GJR-001.

```
GJR-VFY-001  Horizen Transparency Authorization and Wallet-Signing Capability
GJR-MKT-001  Marketa External-Agent Constitutional Eligibility Engine
```

The current PRD already establishes the sequencing: Verify performs explicit operator authorization of Pulse/P&L disclosure; Claim proves wallet control before Marketa may issue a final admission recommendation. External registration, control, constitutional authority, and mandate remain distinct states throughout.

---

## GJR-VFY-001 — Horizen Transparency Authorization and Wallet Signing

### 1. Purpose

Build the real signing and submission machinery required for the operator to authorize Horizen Pulse monitoring and P&L disclosure for a registered agent. This is not merely a toggle. The real sequence is:

```
registered AigentQube
→ Horizen token ID reread
→ authorization message obtained
→ operator reviews exact scope
→ controller wallet signs locally
→ signed authorization submitted to Horizen
→ Horizen reread confirms activation
→ AigentQube/Agent Card enriched
→ receipt issued
```

### 2. Constitutional meaning

The signature proves that the controller wallet approved a specific transparency authorization. It does not prove or create: constitutional authority generally; sponsorship; bounded delegation; payment authority; FS Runtime admission; Standing.

Canonical distinction:

```
wallet signature   = control over the registered controller instrument
Pulse authorization = consent to a specific disclosure consequence
Polity delegation   = constitutional authority to act
```

### 3. Existing assets to reuse

Reuse the current Horizen integration rather than creating a second client:

```
services/horizen/client.ts
scripts/register-moneypenny-horizen.ts
services/horizen/identity.ts
services/horizen/agentBinding.ts
MoneyPenny AigentQube
MoneyPenny Agent Card route
existing wallet/key custody services
existing activity receipt and DVN pipelines
```

The current read-only client stays read-only. Create a separate, explicitly mutating service such as `services/horizen/authorizationClient.ts`. Do not quietly add write methods to the read client and weaken its existing safety boundary.

### 4. Required Horizen flow

Use Horizen's actual MCP/API sequence:

```
build_pulse_auth_message
→ sign returned payload locally
→ enable_pulse_monitoring
→ get_onboarding_status / pulse-status reread
```

Do not invent the message schema. Discover and validate the partner tool schema exactly as the registration script already does.

### 5. Signing architecture

No private key may be sent to: Horizen; the Companion; a browser query parameter; the Journey Runtime; an application API route; logging or telemetry. The server may prepare the authorization request, but signing must occur through the existing wallet custody/signing boundary.

Recommended service split:

```
prepareHorizenTransparencyAuthorization()
signHorizenTransparencyAuthorization()
submitHorizenTransparencyAuthorization()
verifyHorizenTransparencyActivation()
```

The signing primitive should be reusable later, but the authorization intent must stay domain-specific.

### 6. Authorization envelope

The signed payload or associated commitment must bind at minimum:

```ts
interface HorizenTransparencyAuthorization {
  version: string;

  aigentQubeId: string;
  agentCardHash: string;

  registry: {
    protocol: 'erc-8004';
    network: string;
    contract: string;
    tokenId: string;
    registryAlias?: string;
  };

  controllerWallet: string;

  authorization: {
    pulseMonitoring: true;
    pnlDisclosure: true;
    purpose: 'horizen-financial-transparency';
    scope: string[];
  };

  nonce: string;
  issuedAt: string;
  expiresAt: string;

  messageHash: string;
}
```

Where Horizen supplies the canonical message body, preserve it exactly and bind the local metadata through the resulting receipt rather than changing the message incompatibly.

### 7. Required protections

Refuse when: MoneyPenny has no persisted AigentQube; token ID is missing; registry reread fails; registered owner does not match controller wallet; Agent Card hash has changed since preparation; nonce is absent or replayed; authorization has expired; network or registry contract differs; signature recovery does not match the controller; Horizen submission fails; Horizen reread does not confirm activation.

A successful signature without successful partner reread is not completion.

### 8. State model

```ts
type TransparencyAuthorizationState =
  | 'NOT_AVAILABLE'
  | 'READY'
  | 'PREPARED'
  | 'AWAITING_SIGNATURE'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REFUSED'
  | 'EXPIRED'
  | 'QUARANTINED';
```

Do not collapse `SIGNED`, `SUBMITTED`, and `CONFIRMED`.

### 9. Persistence

Persist: authorization request hash; exact scope; nonce and expiry; signer wallet; signature hash or safe reference; Horizen submission identifier; partner response reference; verification timestamp; AigentQube ID; token ID; resulting receipt IDs. Do not persist plaintext private-key material.

### 10. Agent Card enrichment

Only after confirmed partner reread:

```json
{
  "horizen": {
    "pulse": { "enabled": true, "authorizationRef": "<receipt-ref>" },
    "pnl": { "disclosureAuthorized": true, "proofRefs": [] }
  },
  "evidence": {
    "standingStatus": "eligible",
    "standingSignals": ["pnl-transparency-enabled"]
  }
}
```

This establishes Standing eligibility only. It does not accrue Standing.

### 11. Receipts

Canonical action types (use or add): `horizen.pulse.authorized`, `horizen.pnl.transparency.enabled`, `agent.card.enriched`. The receipt must include: principal; active persona; AigentQube; controller wallet; token ID; authorization hash; signature verification result; partner reread result; timestamps; refusal reason where applicable.

### 12. Verify-stage completion

GJR Verify becomes complete only when:

```
valid authorization signature
∩ Horizen accepted submission
∩ Pulse status reread confirms enabled
∩ P&L disclosure authorization rereads true
∩ Agent Card enrichment committed
∩ required receipts exist
```

---

## GJR-MKT-001 — Marketa External-Agent Constitutional Eligibility Engine

### 1. Purpose

Build a real Marketa decision capability that assesses whether an externally registered agent is eligible to proceed toward a Polity Delegate Passport. Not a decorative score or empty state-machine slot. Its output is narrowly:

```
RECOMMENDED FOR POLITY-BOUND DELEGATE ADMISSION
```

or a reasoned non-recommendation/refusal. It does not authorize: Financial Services jurisdiction; runtime activation; payments; delegation; sponsorship; Passport issuance.

### 2. Role boundary

```
Marketa         = constitutional admission eligibility assessor
operator        = sponsor and authority source
Passport system = credential issuer
Aigent Z        = bootstrap observer
MoneyPenny      = candidate, never her own admitting authority
```

### 3. Decision modes

Support two distinct modes: `DRAFT` and `FINAL`.

- **Draft assessment** may run before proof of control. It identifies missing evidence and likely blockers, but cannot recommend final admission.
- **Final assessment** may run only after fresh proof of wallet control.

Canonical rule: Marketa may reason before control is proven. Marketa may not issue a final recommendation before it.

### 4. Evidence inputs

The engine consumes a normalized evidence object:

```ts
interface ExternalAgentAdmissionEvidence {
  aigentQube: { exists: boolean; id?: string; canonicalStateHash?: string };

  agentCard: { resolves: boolean; url?: string; hash?: string; schemaValid: boolean; provenanceValid: boolean };

  externalRegistry: {
    resolves: boolean; protocol?: string; network?: string; contract?: string; tokenId?: string; ownerWallet?: string;
  };

  control: { proven: boolean; proofRef?: string; signerWallet?: string; fresh: boolean };

  transparency: {
    pulseSupported: boolean; pulseEnabled: boolean; pnlDisclosureAuthorized: boolean; evidenceRefs: string[];
  };

  authorityFitness: {
    sponsorEligible: boolean | null; delegationBoundable: boolean; delegationRevocable: boolean;
    onwardDelegationProhibited: boolean; expirySupported: boolean;
  };

  risk: { contradictions: string[]; unresolvedClaims: string[]; quarantineSignals: string[] };
}
```

### 5. Initial deterministic policy

The first version is deterministic and explainable. Do not begin with a black-box LLM score.

**Required for final recommendation**: persisted AigentQube exists; Agent Card resolves; Agent Card schema is valid; Agent Card provenance is acceptable; external registry identity resolves; registry network and token ID are explicit; registered owner wallet is explicit; fresh proof of control exists; proof signer matches registered owner; Pulse is supported; Pulse is enabled; P&L disclosure is authorized; delegation can be bounded; delegation can expire; delegation can be revoked; onward delegation is prohibited; no unresolved critical contradiction; no quarantine signal.

**Sponsorship eligibility nuance**: Marketa may assess that the agent is sponsor-eligible, but final sponsorship is a later operator act. The engine distinguishes "eligible to be sponsored" from "sponsored."

### 6. Decision outputs

```ts
type MarketaAdmissionDecision =
  | 'DRAFT_ELIGIBLE' | 'DRAFT_BLOCKED' | 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'REFUSED' | 'QUARANTINED';

interface MarketaAdmissionAssessment {
  assessmentId: string;
  version: string;
  mode: 'DRAFT' | 'FINAL';

  subjectAigentQubeId: string;
  evidenceSnapshotHash: string;

  decision: MarketaAdmissionDecision;

  satisfiedRules: string[];
  missingRules: string[];
  failedRules: string[];
  contradictionRefs: string[];
  evidenceRefs: string[];

  rationale: string;
  policyVersion: string;

  assessedAt: string;
  supersedes?: string;
}
```

### 7. Rule classifications

Each rule has a stable ID:

```
MKT-ADM-001 persisted AigentQube required
MKT-ADM-002 Agent Card must resolve
MKT-ADM-003 registry identity must be network-qualified
MKT-ADM-004 registered controller must be explicit
MKT-ADM-005 fresh control proof required for FINAL
MKT-ADM-006 signer must match registered controller
MKT-ADM-007 Pulse integration must be active
MKT-ADM-008 disclosure consent must be explicit
MKT-ADM-009 delegation must be bounded
MKT-ADM-010 delegation must be revocable
MKT-ADM-011 onward delegation prohibited
MKT-ADM-012 critical contradictions refuse
```

This makes each recommendation inspectable and testable.

### 8. Persistence model

Create a durable admission-assessment record rather than storing only a mutable field on the agent. Suggested table: `marketa_agent_admission_assessments`, fields: `assessment_id, subject_aigent_iqube_id, mode, decision, policy_version, evidence_snapshot_hash, satisfied_rules, missing_rules, failed_rules, rationale, evidence_refs, created_at, supersedes_assessment_id, actor_persona_id, receipt_ref`. Assessments are append-only or superseding, never silently overwritten.

### 9. Reassessment

A draft or failed assessment may be rerun when evidence changes: control proof added; Pulse enabled; Agent Card corrected; registry identity resolved; contradiction cleared. The new assessment supersedes the old one but does not erase it — the exact same "supersedes, never deletes" discipline just built for Independent Review (`services/research/independentReviewStore.ts`'s `markReviewSuperseded`).

### 10. Refusal and quarantine

Use `REFUSED` when a required constitutional condition fails in a correctable way (no fresh control proof; owner mismatch; missing expiry support; unresolved registry identity). Use `QUARANTINED` for higher-risk evidence (conflicting controller identities; tampered Agent Card commitment; replayed control proof; inconsistent token/network claims; evidence provenance failure).

### 11. Optional model assistance

A model may later assist with summarizing evidence, detecting semantic contradictions, or explaining the decision. The final eligibility state must be generated by the versioned rule engine.

Canonical rule: inference may explain or surface evidence. It may not silently substitute for the constitutional decision policy.

### 12. Receipts

Required action types: `marketa.eligibility.assessed`, `marketa.eligibility.recommended`, `marketa.eligibility.refused`, `marketa.eligibility.quarantined`. Do not issue `recommended` for a draft assessment. The final receipt includes: policy version; evidence snapshot hash; rule outcomes; AigentQube ID; Agent Card hash; control-proof reference; decision; rationale; assessor persona; timestamp.

### 13. Claim-stage completion

GJR Claim completes only when:

```
fresh wallet-control proof
∩ signer matches registered controller
∩ Marketa FINAL assessment exists
∩ final decision = RECOMMENDED
∩ recommendation receipt exists
```

A draft assessment does not complete Claim.

---

## Shared dependency between Verify and Claim

The correct ordering remains `Register → Verify → Claim`. Within Claim: `proof of control → Marketa final assessment`. Marketa consumes the confirmed Verify evidence (Pulse enabled; P&L authorization confirmed; Agent Card enrichment committed) — it does not independently mutate Horizen state.

## Recommended implementation sequence after reviewer completion

```
Phase 1 — Shared signing substrate
  authorization request preparation; local wallet signature interface;
  nonce/expiry/replay protection; signature verification; safe receipt integration.
  Exercise it first with the Horizen transparency authorization.

Phase 2 — Horizen Verify capability
  partner message discovery; signature submission; status reread;
  Agent Card/AigentQube enrichment; Verify surface; refusal states.

Phase 3 — Marketa evidence normalizer
  a read-only evidence assembler that creates the deterministic assessment input.

Phase 4 — Marketa rule engine
  versioned rules; draft/final separation; persistence; receipts;
  refusal and quarantine; reassessment.

Phase 5 — Journey composition
  wire the real capabilities into: Verify stage, Claim stage,
  Companion narration, Journey state resolver, Evidence chain.
```

## Cross-capability invariants

- **Local Signing Sovereignty** — a wallet signature must be produced within the authorized wallet custody boundary. Private-key material must never cross into the Journey Runtime, Companion, or partner API.
- **Purpose-Bound Signature** — a signature authorizes only the exact message, subject, scope, network, nonce, and expiry to which it is bound.
- **Partner Confirmation** — a locally valid signature does not complete a partner mutation until the partner accepts it and authoritative reread confirms the resulting state.
- **Independent Eligibility** — the candidate agent may supply evidence but may not make or enlarge its own constitutional admission recommendation.
- **Control Before Recommendation** — a final Marketa admission recommendation may not precede fresh proof of control over the externally registered agent.
- **Evidence Before Decision** — every Marketa decision must resolve to a versioned evidence snapshot and inspectable rule outcomes.
- **Recommendation Is Not Authority** — Marketa's recommendation establishes eligibility to proceed. It does not issue a Passport, create delegation, or activate runtime authority.
- **No Simulated Completion** — missing wallet-signing infrastructure or absent eligibility logic must render an honest blocked state, never a cosmetic success path.

## Required refusal canaries (both capabilities, once implemented)

```
missing token ID
registry owner mismatch
changed Agent Card hash
expired/replayed signing request
invalid signature
partner mutation not confirmed
final Marketa assessment before proof of control
contradictory controller identities
unbounded or non-revocable delegation
candidate self-admission
draft assessment treated as final
recommendation treated as authority
```

## Governing rule

Verify obtains explicit consent for a specific external consequence. Claim independently determines whether the resulting agent evidence is constitutionally eligible to proceed. Neither stage may manufacture authority.
