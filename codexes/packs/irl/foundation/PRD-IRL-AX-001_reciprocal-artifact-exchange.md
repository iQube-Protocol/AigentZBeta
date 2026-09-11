# PRD-IRL-AX-001 — Reciprocal Artifact Exchange

**Status:** RATIFIED (2026-08-24) by operator act — architecture settled; the generic primitive is built (see Implementation Note below); the IRL-AX-001 dogfood instance awaits seeding.  
**Date:** 2026-08-23  
**Initial use case:** CI/IRL × OCSGA independently frozen architecture exchange  
**Parent doctrine:** CFS-044 Open Lab / Research Spaces; CFS-051/CFS-052 Crucible research discipline  
**Design objective:** make the IRL runtime the place of record for controlled, reciprocal exchange of independently prepared research artifacts between collaborating parties.

## 1. Purpose

Create a generic two-way **Reciprocal Artifact Exchange** capability inside the Invariant Research Lab for collaborations in which two parties wish to exchange, acknowledge, compare, review, or experimentally evaluate independently prepared artifacts.

The capability MUST NOT be architecture-specific. It should support any bounded research asset capable of being represented by an uploaded object or immutable external reference, including:

- architecture maps;
- technical specifications;
- protocols;
- IP/concept descriptions;
- research hypotheses;
- datasets or dataset manifests;
- experimental designs;
- code/repository snapshots or commit references;
- papers/manuscripts;
- models or model manifests;
- policy/governance frameworks;
- other mutually declared research artifacts.

The first dogfood exchange is **IRL-AX-001: CI/IRL × OCSGA Independent Architecture Exchange**.

## 2. Evidentiary claim

For IRL-AX-001 the system MUST support the defensible claim:

> **Both architectures were independently frozen before formal exchange.**

It MUST NOT claim that neither party had prior knowledge of, discussion about, or technical access to the other's ideas. The parties have already exchanged substantial conceptual detail. The experiment concerns independently frozen formal architecture artifacts, not informational isolation.

## 3. Core principle

> **Freeze independently. Exchange reciprocally. Receipt the crossing. Compare without rewriting the source.**

The exchange is a controlled disclosure event, not a transfer of canonical ownership.

The deposited artifact remains owned and governed by its originating party. The IRL records the artifact, declared status, provenance, signatures, exchange event, and subsequent derivative lineage.

## 4. Relationship to CFS-044

This capability composes the existing Open Lab architecture rather than creating a parallel collaboration surface. CFS-044 already establishes:

- invitation as the entry capability;
- Reserved Research Spaces before signup;
- Passport/persona activation;
- in-space agreements;
- owner/delegate separation;
- receipts for constitutional transitions;
- QubeTalk as the collaboration thread;
- Runtime as the Place of Record.

Reciprocal Artifact Exchange should therefore be implemented as an **engagement type inside Research Spaces**.

Email or other external messaging is invitation-only. Deposit, declarations, signatures, receipts, disclosure, discussion, comparison, and derivative artifacts live in the IRL runtime.

## 5. Actors

### Party A — Initiator
Creates the exchange, identifies the collaboration/research purpose, deposits or references Artifact A, declares its freeze state, and invites Party B.

### Party B — Counterparty
Enters through the invitation/Passport flow, deposits or references Artifact B, declares its freeze state, and participates in the exchange/signing ritual.

### IRL Runtime
Acts as place of record and exchange apparatus. It records state transitions, artifact fingerprints, signatures/attestations, receipts, disclosure state, and derivative lineage. It does not become owner of the underlying IP merely by recording the exchange.

### Delegated agents
May assist either party within explicit bounded delegation. A delegated agent's action must remain distinguishable from the principal's required signature/attestation where the ritual requires the human/principal.

## 6. Exchange object

Create a generic `reciprocal_exchange` object with at least:

- `exchangeId`
- `exchangeType`
- `title`
- `purpose`
- `researchQuestion` optional
- `initiatorParty`
- `counterparty`
- `researchSpaceId`
- `cohortId` optional
- `status`
- `disclosurePolicy`
- `comparisonPolicy` optional
- `createdAt`
- `openedAt`
- `completedAt`
- `parentExperimentId` optional
- `derivedExperimentId` optional

Initial `exchangeType`: `independent-artifact-comparison`.

The data model must remain generic enough for other exchange types later.

## 7. Artifact deposit object

Each party supplies one or more `exchange_artifact` records:

- `artifactId`
- `exchangeId`
- `partyId`
- `title`
- `artifactClass`
- `description`
- `version`
- `freezeDeclaredAt`
- `freezeDeclaration`
- `sourceType`: upload / repository-commit / immutable-reference / manifest
- `sourceReference`
- `contentHash` / SHA-256 where bytes are available
- `repositoryCommit` where applicable
- `storageReference` / CID where applicable
- `mimeType`
- `confidentialityClass`
- `ownershipDeclaration`
- `rightsForExchange`
- `supersedesArtifactId` optional
- `depositedAt`
- `receiptId`

For Git-backed artifacts, the system should prefer a commit-pinned source plus content hash rather than a mutable branch URL.

## 8. Freeze declaration

Before reciprocal disclosure, each party must make an explicit declaration materially equivalent to:

> **I declare that this artifact represents the version independently frozen by my party for this exchange. I understand that subsequent modifications will be recorded as derivative versions and will not alter the provenance of this frozen baseline.**

For the initial architecture exchange, the declaration means independently frozen **before formal exchange**, not before all prior conversation or conceptual disclosure.

The declaration itself is signed/attested and receipted.

## 9. Signing ritual

The exchange should have a deliberate but lightweight constitutional signing ritual.

### Stage 1 — Deposit signature
Each party signs/attests its own artifact deposit and freeze declaration.

### Stage 2 — Exchange readiness
The runtime shows both sides that the required deposits exist and are frozen, without exposing the counterparty artifact contents before the disclosure gate where the configured policy requires reciprocal deposit first.

### Stage 3 — Reciprocal acknowledgment
Each party signs a common Exchange Instrument acknowledging:

1. the identity/persona under which they participate;
2. the artifact(s) they deposited;
3. the declared freeze/version status;
4. the agreed research purpose;
5. confidentiality/IP terms applicable to the exchange;
6. that receipt does not transfer ownership unless separately agreed;
7. that subsequent comparison must preserve source artifacts;
8. that later normalization/redesign is derivative work, not evidence of native compatibility.

### Stage 4 — Crossing / disclosure
When both required signatures are present, the runtime transitions the exchange to `EXCHANGED`, reveals each artifact to the authorized counterparty, and emits a bilateral **Exchange Receipt**.

### Stage 5 — Receipt acknowledgment
Each party can acknowledge receipt. This is evidentiary confirmation of delivery/access, not a second transfer of rights.

## 10. Exchange receipt

The bilateral receipt should contain at minimum:

- exchange ID;
- parties/personas;
- artifact IDs and titles;
- versions;
- hashes/fingerprints;
- immutable source references where applicable;
- each freeze-declaration timestamp;
- each deposit timestamp;
- each signature/attestation reference;
- disclosure/crossing timestamp;
- confidentiality/IP policy reference;
- exchange purpose;
- receipt hash/reference;
- resulting exchange status.

Human-readable compression:

> **Party A deposited and attested Artifact A vX. Party B deposited and attested Artifact B vY. Both declared their artifacts independently frozen before formal exchange. Both accepted the Exchange Instrument. The IRL disclosed the frozen artifacts reciprocally at T and issued this receipt.**

## 11. State machine

`DRAFT`
→ `A_DEPOSITED`
→ `INVITED`
→ `B_JOINED`
→ `B_DEPOSITED`
→ `READY_TO_SIGN`
→ `A_SIGNED`
→ `B_SIGNED`
→ `EXCHANGED`
→ `RECEIPT_ACKNOWLEDGED`
→ `COMPARISON_OPEN`
→ `COMPLETED`

Ordering of A/B signing may vary. State machine implementation should model independent required conditions rather than assume one fixed signature order.

Failure/exception states:

- `DECLINED`
- `WITHDRAWN_PRE_EXCHANGE`
- `ARTIFACT_REPLACEMENT_REQUIRED`
- `SIGNATURE_EXPIRED`
- `DISPUTED`
- `REVOKED_ACCESS_POST_EXCHANGE` (access revocation does not erase the historical receipt)

## 12. Disclosure policies

Generic capability should support at least:

### `RECIPROCAL_AFTER_BOTH_DEPOSIT`
Neither deposited artifact is intentionally disclosed through the exchange UI until both required artifacts are deposited and declarations/signatures satisfy the gate.

### `IMMEDIATE_ON_DEPOSIT`
Artifacts become available as deposited; useful where independence is not a research requirement.

### `MANIFEST_BEFORE_CONTENT`
Counterparty can see metadata/hash/version before content disclosure.

The initial CI/IRL × OCSGA exchange should use **RECIPROCAL_AFTER_BOTH_DEPOSIT** for the formal artifacts while making no claim of prior informational isolation.

## 13. Passport and invitation flow

The generic invitation should compose the existing Reserved Research Space lifecycle:

`Create Exchange → Reserve Research Space → Generate Invitation → Counterparty opens invitation → Passport/persona resolution → Space activated → Exchange card visible → Deposit → Sign → Exchange`

If the invited party already has a valid Polity Passport/persona, the invitation should resolve to that person rather than force duplicate onboarding.

The invitation should state only what is necessary externally. The substantive exchange instrument and artifacts live inside the runtime.

## 14. Research Space UX

A reciprocal exchange appears as a first-class card/workflow inside the participant's Research Space.

Recommended sections:

1. **Purpose** — what is being exchanged and why.
2. **Parties** — participating personas/organizations and delegated agents.
3. **Your Artifact** — deposit/reference, version, hash, freeze declaration.
4. **Counterparty Artifact** — locked/unlocked according to policy.
5. **Exchange Instrument** — terms and signatures.
6. **Crossing** — readiness and reciprocal disclosure state.
7. **Receipt** — immutable bilateral record.
8. **QubeTalk** — engagement discussion.
9. **Comparison** — derivative artifacts only; never mutates frozen deposits.
10. **Lineage** — subsequent comparison, experiment, co-design or publication artifacts.

## 15. Comparison handoff

After exchange, the runtime may open a separate `comparison` object linked to the two immutable source artifacts.

For architecture/IP comparison it should support a neutral matrix with configurable dimensions. For IRL-AX-001 the agreed seam classifications are:

- COMPATIBLE
- AMBIGUOUS
- CONFLICTING
- REDUNDANT
- UNRESOLVED

The comparison object MUST NOT rewrite either frozen artifact. Any normalization, interface proposal, synthesis or redesign is stored as a derivative artifact with explicit lineage.

## 16. IP and confidentiality

The capability is intended for potentially sensitive architecture, IP and research concepts, so confidentiality must be explicit rather than inferred.

At minimum each exchange records:

- confidentiality class;
- permitted participants;
- permitted purpose/use;
- ownership declaration;
- whether derivative analysis is permitted;
- whether publication is permitted;
- retention/access policy;
- any separate NDA/agreement reference.

Constitutional confidentiality principle: disclose only what the exchange requires to the parties authorized for the declared purpose. Receipts should prove the exchange without unnecessarily exposing artifact content.

This PRD does not itself create a universal IP license or NDA. Legal terms should be supplied through an exchange-instrument template appropriate to the engagement.

## 17. Authorization and revocation

Authority to create an exchange, deposit on behalf of an organization, sign an instrument, disclose an artifact, or authorize derivative use are distinct actions and should be separately governable.

Pre-exchange withdrawal can prevent disclosure where policy permits.

Post-exchange revocation may terminate future runtime access but MUST NOT falsify history by deleting the fact that the exchange occurred or invalidating previously issued receipts.

## 18. Evidence and auditability

Every consequential transition should be receipt-eligible:

- invitation created;
- invitation claimed;
- artifact deposited;
- freeze declared;
- artifact replaced before exchange;
- party signature;
- disclosure authorization satisfied;
- reciprocal crossing;
- receipt acknowledgment;
- comparison opened;
- derivative artifact created;
- access revoked/dispute raised.

The audit trail should distinguish human/principal signatures from delegated-agent operations.

## 19. IRL-AX-001 — first dogfood instance

**Title:** CI/IRL × OCSGA Independent Architecture Exchange  
**Type:** independent-artifact-comparison  
**Party A:** MetaProof / IRL  
**Party B:** Ian / OCSGA  
**Purpose:** exchange independently frozen formal architecture maps, establish provenance, then perform neutral boundary comparison before joint experimental design.  
**Party A artifact:** `ci-irl-native-architecture-baseline-v1.0.md` pinned to its frozen Git commit/content hash.  
**Party B artifact:** OCSGA native ownership/terminology/architecture baseline supplied by Ian.  
**Disclosure policy:** `RECIPROCAL_AFTER_BOTH_DEPOSIT`  
**Comparison policy:** preserve both source artifacts; classify seams COMPATIBLE / AMBIGUOUS / CONFLICTING / REDUNDANT / UNRESOLVED; distinguish discovered compatibility from created compatibility.  
**Claim:** both formal architectures were independently frozen before formal exchange.

The exchange itself is pre-experiment apparatus/provenance. It does not constitute the later boundary-validation experiment.

## 20. Minimal build slice

To execute IRL-AX-001 without building a generalized document-management platform:

1. add `reciprocal_exchange` and `exchange_artifact` persistence;
2. add an Exchange engagement type to Reserved Research Spaces;
3. reuse invitation + Passport/persona claim;
4. support file upload and immutable external/commit reference;
5. calculate/store SHA-256 for uploaded bytes where available;
6. implement freeze declaration;
7. implement bilateral Exchange Instrument signatures using existing in-space agreement/receipt patterns;
8. implement reciprocal disclosure gate;
9. issue Exchange Receipt;
10. expose QubeTalk thread;
11. create a read-only comparison handoff shell linked to both frozen artifacts.

Everything beyond this should be deferred unless required by the first exchange.

## 21. Acceptance criteria for IRL-AX-001

The first release is successful when:

- MetaProof can create IRL-AX-001 and reserve Ian's Research Space;
- Ian can enter through one invitation and resolve/create his Passport/persona;
- each party can deposit/reference its architecture artifact independently;
- each artifact receives a stable fingerprint/reference and deposit receipt;
- each party can attest the freeze declaration;
- neither formal artifact is intentionally disclosed through the exchange workflow before the reciprocal gate;
- both parties can sign the Exchange Instrument in-runtime;
- successful bilateral signature opens reciprocal access;
- the runtime issues a bilateral Exchange Receipt containing both artifact fingerprints and relevant timestamps;
- QubeTalk provides the collaboration thread;
- the two frozen artifacts remain immutable source objects for later comparison;
- the next comparison artifact can be created without modifying either source;
- the record truthfully states **independently frozen before formal exchange**, not informational isolation.

## 22. Future generalization

Once dogfooded, the same primitive can support:

- architecture-to-architecture comparisons;
- protocol interoperability studies;
- reciprocal IP disclosure;
- research-method comparison;
- model/system evaluations;
- dataset exchanges;
- standards alignment;
- due-diligence rooms;
- academic/industry collaboration;
- pre-consortium technical exchanges;
- independent proposal comparison;
- multi-party exchange as a later extension.

The generic primitive is therefore **Reciprocal Artifact Exchange**, not "architecture sharing".

## 23. Build/governance posture

This PRD specifies a capability and initial dogfood instance. It does not ratify new constitutional invariants merely by implementation.

Implementation should reuse existing Passport, Research Space, agreement, delegation, receipt, cohort and QubeTalk primitives wherever they are already deployed. Where a required primitive is only proposed in CFS-044 rather than built, the implementation plan must report that gap explicitly rather than assume it exists.

The capability should remain thin: build the smallest uniform exchange primitive capable of executing IRL-AX-001 end-to-end, then generalize only from observed use.

## 24. Implementation note (2026-08-24)

The generic primitive is built: `services/research/reciprocalExchange.ts` (state machine),
`supabase/migrations/20260930020000_reciprocal_artifact_exchange.sql` (schema), the
`app/api/research/exchanges/*` routes, `app/triad/components/codex/tabs/IRLExchangeTab.tsx`
(IRL cartridge tab), `scripts/seed-irl-ax-001.mjs` (idempotent IRL-AX-001 seeder), and
`tests/reciprocal-exchange.test.ts` (behavioural canaries — passing). Reuses the identity
spine, `activity_receipts`/DVN pipeline, QubeTalk, and the constitutional-agreement
authorization pattern rather than duplicating them.

The IRL-AX-001 dogfood instance itself is not yet seeded: `seed-irl-ax-001.mjs` requires
Party A's (Dele/MetaProof/IRL) real persona UUID as an explicit CLI argument — per this
repo's No-Guessing rule, the script refuses to infer or fabricate it. Party B's (Ian/OCSGA)
artifact is deliberately left unset for his own accession (invitation → Passport/persona →
deposit) rather than seeded on his behalf.
