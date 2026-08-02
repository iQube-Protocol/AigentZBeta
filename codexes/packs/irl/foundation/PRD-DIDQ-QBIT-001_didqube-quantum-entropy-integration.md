# PRD-DIDQ-QBIT-001 — DIDQube Quantum Entropy Integration with Qubit

**Document ID:** PRD-DIDQ-QBIT-001
**Status:** **Draft — canonised for review. NOT approved for execution.**
**Version:** 0.2 (supersedes v0.1 `PRD-DIDQ-QENT-001`, which was Qubit-first and architecturally incomplete)
**Date:** 2026-08-02
**Product owners:** metaProof / metaMe
**Integration partner:** Qubit Technology
**Primary system:** DIDQube
**Supporting systems:** KybeDID, RootDID, Polity Passport, metaMe Runtime, AgentiQ Runtime, iQube Protocol
**Classification:** Security-sensitive product and architecture specification

---

## Canonisation note (read first)

This PRD is **canonised as a specification of record**, not as an authorisation to build.

| | |
|---|---|
| **Architectural direction** | Ratified (operator ruling **CR-9**, 2026-08-02) |
| **Implementation specification** | Provided, pending review |
| **Execution authority** | **NOT granted.** An execution plan must be written and approved first. |
| **Current code state** | Not implemented. The audited repository uses classical CSPRNG (`node:crypto` `randomBytes`) for all IVs, keys and identifiers. |
| **Publication target** | Implement before final publication of *The Constitutional Internet* |
| **Manuscript status** | Ch17 is **Projected** — see CR-9 for the exact permitted wording |

**Cross-references.** This PRD is the controlling implementation specification for editorial-register
ruling **CR-9 (Quantum Entropy Implementation Status)** and for matrix row **CI-17** in
`codexes/packs/polity-core/items/commentary/constitutional-internet/02-source-and-evidence-matrix.json`.
It is the artifact whose delivery moves CI-17 from *Projected* toward *Entering deployment* and,
after tests plus receipts plus deployment evidence, to *Implemented* / *Operational*.

### v0.1 → v0.2 change of frame

v0.1 read as a Qubit security-service integration. v0.2 inverts the governing frame:

> **DIDQube determines why, where and how randomness is used. Qubit contributes entropy to the
> DIDQube-controlled process. Qubit is integrated into DIDQube; DIDQube is not reorganised around Qubit.**

v0.2 additionally closes seven architectural gaps identified against the earlier DIDQube scope:
root/persona hierarchy separation, metaNet/blakNet allocation, the
anonymous→pseudonymous→identifiable transition lifecycle, human-readable alias/resolver profile,
broader Proof-of-State coverage (including negative and unauthorised events), person-vs-agent root
profiles, and provider-neutral independence.

---

## 1. Executive summary

Qubit quantum entropy will be integrated into the DIDQube operating model to strengthen DIDQube's
native randomness requirements. DIDQube remains the controlling system; Qubit is a **bounded
infrastructure provider**.

Entropy contributes to: DIDQube creation and rotation · persona separation · pairwise and contextual
identifier generation · key generation and rotation · anonymous and pseudonymous interaction ·
cohort randomization · nonce, salt, challenge and blinding values · recovery and continuity ·
randomized protocol operations.

The integration must preserve the constitutional hierarchy:

```text
Sovereign personhood
→ KybeDID continuity
→ RootDID
→ bounded personas
→ contextual DIDQubes
→ keys, credentials, delegations and actions
```

Qubit may strengthen unpredictability of values used within this hierarchy. Qubit must **not** define
the hierarchy, determine personhood, establish identity, create standing, confer authority, control
identifier continuity, hold private keys, reconstruct DIDQubes, correlate personas, or become
required for constitutional continuity.

---

## 2. Product context

### 2.1 DIDQube

DIDQube is the contextual, rotating, privacy-preserving identifier primitive in the iQube framework.
It lets a person or properly delegated agent operate through bounded identifiers without
unnecessarily exposing a stable identity or creating a universal correlation surface.

A DIDQube may be anonymous · pseudonymous · identifiable · pairwise · persona-specific ·
service-specific · transaction-specific · session-specific · delegation-specific · temporary ·
persistent within a bounded context · rotated or superseded.

**A DIDQube is not the source of personhood.** It is an instrument through which a person or
authorised agent acts within a defined context.

### 2.2 Constitutional hierarchy

- **Sovereign personhood** — the primary constitutional subject; precedes identity, identifiers, wallets, accounts and agents.
- **KybeDID** — continuity of personhood without requiring universal public identity disclosure.
- **RootDID** — identity continuity where identity is required; not necessarily disclosed in ordinary DIDQube interactions.
- **Persona** — a root may support multiple bounded personas, each with separate DIDQubes, keys, credentials, disclosure policies, reputation contexts, delegations, services and interaction histories.
- **DIDQube** — a contextual identifier beneath the root or persona boundary, minimising unnecessary linkage.

### 2.3 Role of quantum entropy

Quantum entropy is an **enhancement to DIDQube randomness**. It strengthens generation of
unpredictable values (identifier creation, key creation, rotation, persona separation, cohort
selection, nonces, blinding, session separation, recovery, randomized protocol execution). **It does
not replace the DIDQube operating model; it operates inside it.**

---

## 3. Problem statement

DIDQube depends on high-quality randomness. Weak, biased, repeated or predictable values could
undermine identifier unlinkability, persona separation, pairwise privacy, key security, recovery
security, cohort fairness, anonymous interaction, pseudonymous continuity, rotation resistance,
delegation boundaries, session isolation and cross-network privacy.

Concrete failure modes: two DIDQubes receiving correlatable identifiers · persona keys derived from
a shared predictable seed · rotation schedules becoming observable · a provider reconstructing
identifiers from entropy it supplied · manipulated cohort assignments · random values reused across
contexts · metaNet and blakNet activity correlated · an agent persona linked across principals · a
fallback generator silently weakening a high-assurance operation.

---

## 4. Product objective

Create a **DIDQube Quantum Entropy Layer** allowing DIDQube-controlled services to consume Qubit
entropy through a common policy-governed interface. It must:

1. Serve DIDQube-defined purposes.
2. Preserve the root–persona–context hierarchy.
3. Mix Qubit entropy with locally controlled entropy.
4. Prevent Qubit from reconstructing derived values.
5. Prevent cross-purpose entropy reuse.
6. Preserve anonymity and pseudonymity.
7. Support metaNet and blakNet contexts.
8. Create non-secret entropy-use receipts.
9. Enforce DIDQube-specific fallback policies.
10. Remain provider-neutral at the adapter boundary.
11. Preserve operation during Qubit outages where policy permits.
12. Support future multi-provider entropy input.

---

## 5. Governing product invariants

| # | Invariant |
|---|---|
| **5.1 DIDQube primacy** | The DIDQube operating model determines permitted entropy use. The provider does not determine the operating model. |
| **5.2 Personhood primacy** | Entropy may generate an identifier, but cannot generate a person, standing or authority. |
| **5.3 Local consequence** | All consequential identifiers, keys and secrets must be derived within a metaMe-controlled or user-controlled trust boundary. |
| **5.4 Provider limitation** | No entropy provider may acquire the capacity to reconstruct, correlate or control the person, root, persona, DIDQube, key or action derived from its service. |
| **5.5 Root and persona separation** | Entropy used for one root, persona, DIDQube, context or operation must not be reusable or inferable across another. |
| **5.6 Continuity without universal linkage** | KybeDID and RootDID continuity must be preservable without public linkage among contextual DIDQubes. |
| **5.7 Randomness without authority** | Randomness may select among constitutionally eligible outcomes; it may not determine constitutional eligibility. |
| **5.8 Explicit downgrade** | A DIDQube operation must never silently claim quantum-enhanced randomness when Qubit entropy was unavailable or rejected. |

---

## 6. Scope

**6.1 DIDQube creation** — anonymous · pseudonymous · identifiable · pairwise · persona-bound ·
service-bound · session · delegation · transaction · recovery · temporary/one-time DIDQubes.

**6.2 DIDQube rotation** — scheduled · risk-triggered · user-triggered · service-triggered ·
credential-triggered · persona transition · anonymous→pseudonymous · pseudonymous→identifiable ·
return to an unlinkable context · emergency rotation after compromise.

**6.3 Root and persona separation** — persona-specific derivation contexts and key material ·
separate recovery paths · separate service identifiers · unlinkable session identifiers · agent
persona separation · principal-specific agent identities · protected continuity commitments.

**6.4 Cryptographic key generation** — local creation/reseeding of DID signing, encryption,
credential, recovery, delegation, wallet, session, one-time, key-encryption and agent persona keys.

**6.5 Randomized cohorts and selection** — research cohort assignment · pilot allocation ·
steward-review assignment · validator selection · audit sampling · experimental arms · fair
allocation · randomized ordering and batching. **Eligibility must always be determined before
randomness is applied.**

**6.6 Protocol randomness** — nonces · salts · challenges · initialization values where appropriate ·
claim and invitation codes · blinding values · anti-replay values · random backoff · randomized
timing · secure shuffling · correlation-resistant request identifiers.

### Out of scope for initial release

Replacement of all OS randomness · transmission of private keys to Qubit · provider custody of seed
phrases · any claim that quantum entropy alone makes an algorithm post-quantum secure · replacement
of approved cryptographic algorithms merely because entropy is quantum-derived · use of randomness to
establish personhood, standing or authority · requiring end users to touch Qubit token mechanics ·
on-chain publication of raw entropy · public exposure of entropy before the associated operation is
finalized · production use of Qubit's future entropy oracle · migration to post-quantum signature
algorithms (requires a separate cryptographic migration specification).

---

## 7. DIDQube operating model

### 7.1 Root structure

```text
Sovereign personhood
└── KybeDID
    └── RootDID
        ├── Persona A
        │   ├── DIDQube A1
        │   ├── DIDQube A2
        │   └── Persona-specific keys
        ├── Persona B
        │   ├── DIDQube B1
        │   └── Persona-specific keys
        └── Recovery and continuity commitments
```

The technical representation may vary; the architectural rule does not. One root may support multiple
bounded personas; one persona may support multiple contextual DIDQubes; DIDQubes may rotate
independently; public DIDQubes must not expose the root; **Qubit must not receive root or persona
identifiers.**

### 7.2 Entropy separation hierarchy

Every entropy request must be bound to a context including environment · network class · principal
class · root scope · persona scope · DIDQube type · operation · service domain · rotation epoch ·
algorithm version · assurance profile.

**Stable root or persona identifiers must not be sent to Qubit.** Local opaque commitments or
ephemeral context values may be used internally.

### 7.3 Person DIDQubes

A person DIDQube represents a bounded way in which a person interacts. Its authority derives from the
person and applicable constitutional or legal rules. Entropy may strengthen its identifiers and keys
but cannot establish that authority.

### 7.4 Agent DIDQubes

An agent may have a root identifier, multiple personas, principal-specific DIDQubes, service-specific
keys, delegated authority and context-specific reputational state. **An agent remains a delegate.**

Entropy must not allow an agent to generate unbounded authority, escape principal binding, delegate
beyond its authority, merge personas across principals, or conceal root accountability where
disclosure is constitutionally required.

Agent DIDQube entropy must be domain-separated by principal · delegation · persona · service · task ·
validity period.

---

## 8. metaNet and blakNet integration

**8.1 metaNet** — public, anonymous, pseudonymous or constitutionally inspectable interaction.
Entropy may support public pseudonyms, pairwise public identifiers, session identities, public
delegation identifiers, anonymous participation and credential-presentation challenges. Operations
must avoid exposing RootDID, KybeDID, private persona relationships, blakNet activity or protected
attributes.

**8.2 blakNet** — protected, private, permissioned interaction. Entropy may support private
identifiers, client-side key creation, encrypted persona state, private recovery paths, protected
credential storage, confidential agent delegation and local blakQube encryption. High-assurance
blakNet operations should use hybrid entropy and local derivation. **Raw Qubit entropy must not be
stored in a blakQube** — only derived keys or protected commitments may be retained.

**8.3 Cross-network separation** — prevent correlation between metaNet and blakNet requests via
independent domain separation · request batching · timing obfuscation · proxy services · generalized
purpose classes · separate credentials · separate entropy pools · separate receipts · delayed or
aggregated anchoring. **The same provider request must never seed both a metaNet and a blakNet
operation.**

---

## 9. Identity-state transitions

**9.1 Anonymous** — reveal no stable identity; avoid deterministic derivation from the root; use a
context-specific random identifier; avoid provider-visible linkage; support rotation and expiry;
preserve personhood continuity only through protected mechanisms where required.

**9.2 Pseudonymous** — may preserve bounded continuity within one context; must not create universal
continuity across unrelated services. Entropy supports initial pseudonym creation, key generation,
service-specific rotation, alias renewal and unlinkable migration.

**9.3 Identifiable** — linked to an identity only through user consent, applicable policy, authorised
credential presentation, or legal/constitutional admissibility. Entropy strengthens the DIDQube but
does not authorise the identity disclosure.

**9.4 Transition controls** — support anonymous→pseudonymous · pseudonymous→identifiable ·
identifiable→new unlinkable context · persona-to-persona · service-to-service separation · emergency
unlinking after compromise. **Entropy receipts must not themselves reveal these transitions
publicly.**

---

## 10. Qubit integration role

**10.1 Qubit provides** — quantum-derived entropy · authenticated API · unique request identifiers ·
source-health information · entropy provenance metadata · signed timestamps or proof metadata ·
agreed availability and throughput · incident notification · security and audit documentation.

**10.2 metaMe / metaProof provide** — permitted entropy purposes · assurance levels · provider
credential protection · response validation · local mixing · derivation of all consequential values ·
protection of roots, personas and DIDQubes · entropy-use receipts · fallback enforcement ·
prevention of unauthorised use · provider abstraction.

**10.3 Explicit Qubit exclusions** — Qubit must **not** generate the final DIDQube or private key;
receive private keys, mnemonic phrases, KybeDID, RootDID, persona identifiers, DIDQube identifiers,
personal attributes or cohort membership details; determine the selected cohort or DIDQube policy;
establish authority; or become the sole source of continuity.

---

## 11. Technical architecture

**Components** — DIDQube operation service · DIDQube entropy policy engine · Qubit entropy adapter ·
local entropy source (OS CSPRNG, secure enclave, HSM, wallet secure hardware, approved TEE) ·
entropy mixer · DIDQube derivation service · receipt service.

```text
DIDQube operation
       |
       v
DIDQube policy engine
       |
       +---- validates root, persona, context and authority
       |
       v
Qubit entropy adapter ---------> Qubit
       |                           |
       |<---- entropy + proof -----+
       |
       +---- local CSPRNG
       |
       v
DIDQube entropy mixer
       |
       v
Purpose-specific local derivation
       |
       v
DIDQube / key / random outcome
       |
       v
DIDQube entropy-use receipt
```

---

## 12. Hybrid entropy model

```text
qbit_entropy  = QBIT_QRNG(required_bytes)
local_entropy = LOCAL_CSPRNG(required_bytes)
local_salt    = LOCAL_CSPRNG(salt_length)

combined_seed = HKDF-Extract(
    salt = local_salt,
    input_key_material = qbit_entropy || local_entropy
)

purpose_seed = HKDF-Expand(
    pseudorandom_key = combined_seed,
    info = didqube_domain_context,
    length = required_bytes
)
```

**The exact construction requires cryptographic review.**

**12.1 Required properties** — Qubit alone cannot determine the output; a compromised local generator
alone cannot determine the output where Qubit remains sound; entropy cannot be reused across
purposes; roots and personas remain separated; metaNet and blakNet remain separated; no raw entropy
becomes a final key; provider failure does not silently weaken the operation.

**12.2 Domain separation** — example internal contexts:

```text
metame:didqube:v1:person:anonymous:create
metame:didqube:v1:person:pseudonym:rotate
metame:didqube:v1:persona:key:signing
metame:didqube:v1:agent:delegation:key
metame:didqube:v1:blaknet:recovery
metame:didqube:v1:metanet:session
metame:didqube:v1:cohort:shuffle
```

Stable personhood or identity identifiers must not appear directly in these strings.

---

## 13. DIDQube identifier generation

**13.1 Required properties** — unpredictable · collision-resistant · non-sequential · context-bound ·
rotatable · non-derivable from personal attributes · non-correlatable across personas, networks and
services unless authorised.

**13.2 Proposed derivation**

```text
quantum_input  = Qubit entropy
local_input    = local secure entropy
operation_salt = local random salt

master_random = HKDF-Extract(operation_salt, quantum_input || local_input)

didqube_material = HKDF-Expand(
    master_random,
    didqube_context_commitment,
    required_length
)

didqube_identifier = Encode(Hash(didqube_material || public_context))
```

The root-to-DIDQube relationship must be established **separately** through a protected local
commitment, credential or encrypted registry relationship.

**13.3 Rotation** — independent persona / service / network rotation · emergency replacement ·
protected continuity · expiry · revocation · supersession · non-linkable public transition. Rotation
timing may itself be randomized where predictable rotation would create correlation risk.

---

## 14. Key generation

**14.1 Sequence** — (1) DIDQube requests an approved key operation; (2) policy engine validates
authority and context; (3) Qubit entropy retrieved where required; (4) local entropy generated;
(5) inputs mixed locally; (6) approved algorithm generates the key pair; (7) private key stored or
wrapped locally; (8) intermediate entropy and seed material destroyed; (9) non-secret receipt
produced.

**14.2 Key classes** — root continuity · persona · DIDQube signing · DIDQube encryption · delegation ·
recovery · session · wallet · agent persona · credential-presentation. **Entropy must not be reused
among these classes.**

**14.3 Algorithms** — entropy input for currently approved algorithms (Ed25519, X25519, secp256k1,
P-256 where required, approved symmetric-key algorithms, approved credential-signature schemes).
**This PRD does not authorise a new cryptographic algorithm merely because the input entropy is
quantum-derived.**

---

## 15. Persona and agent separation

**15.1 Person personas** — each persona must have separate DIDQubes, keys, domain contexts, recovery
policies, disclosure rules, entropy receipts and correlation boundaries. A public professional
persona must not be inferable from a private personal persona through provider requests or derived
values.

**15.2 Agent personas** — an agent serving multiple principals must not reuse keys, seeds, DIDQubes,
Qubit request identifiers, receipt commitments or domain contexts. Each principal–agent relationship
must have a distinct entropy and delegation boundary.

**15.3 Root accountability** — persona privacy must not eliminate root accountability where
constitutional disclosure is required. The protected root↔persona relationship must remain
recoverable under authorised conditions without becoming public by default.

---

## 16. Cohort randomization

**16.1 DIDQube-controlled process** — Qubit supplies entropy only. Sequence: (1) determine
constitutional eligibility; (2) canonicalize the eligible set; (3) commit to the set; (4) commit to
the algorithm; (5) obtain entropy; (6) derive a local shuffle seed; (7) execute an unbiased shuffle
or selection; (8) record the result commitment; (9) prevent unauthorised rerolls.

**16.2 Privacy** — Qubit must not receive participant names, DIDQubes, RootDIDs, personhood records,
cohort labels or selected results.

**16.3 Fairness controls** — prevent post-entropy population changes · biased modulo selection ·
hidden rerolls · discarded outcomes · operator substitution · selective result disclosure.
Recommended: Fisher–Yates or equivalent unbiased shuffle with rejection sampling for bounded
integers; no modulo reduction that introduces bias.

---

## 17. Proof-of-State and entropy receipts

**17.1 Receipt purpose** — proves a DIDQube operation followed the declared randomness process. May
record operation type, DIDQube class, network class, assurance profile, provider, provider proof
commitment, local entropy inclusion, mixing method, policy version, fallback status, result
commitment. Must **not** reveal raw entropy, final seed, private key, root identifier, persona
identifier, protected DIDQube relationship or personal information.

**17.2 Proof-of-State events** — the broader model must record or detect: unauthorised entropy
requests · entropy requested outside an approved purpose · entropy reuse · duplicate provider
responses · invalid source proofs · **silent fallback** · identifier creation outside the policy
engine · root–persona binding changes · unauthorised persona correlation · private information used
in identifier derivation · **protected data used for model training** · unauthorised export of
entropy-related records.

**17.3 Receipt schema**

```json
{
  "schema": "metame-didqube-entropy-receipt/v1",
  "receiptId": "uuid",
  "operationId": "uuid",
  "didqubeOperationClass": "persona-identifier-create",
  "networkClass": "metanet",
  "provider": "qbit",
  "providerProofCommitment": "sha256",
  "assuranceProfile": "hybrid-required",
  "localEntropyIncluded": true,
  "mixingAlgorithm": "hkdf-hybrid/v1",
  "domainContextCommitment": "sha256",
  "fallbackUsed": false,
  "resultCommitment": "sha256",
  "policyVersion": "didqube-entropy-policy/1.0",
  "createdAt": "RFC3339",
  "signature": "base64url"
}
```

Receipts may be privately stored, included in a credential, bound to a DVN receipt, batched into a
Merkle root, anchored to Bitcoin, or relayed across supported chains. **Only non-secret commitments
may be publicly anchored.**

> **Audit note (2026-08-02).** DVN anchoring of *governance-class* receipts is presently degraded in
> the deployed environment — see `BOOK_IMPLEMENTATION_RECONCILIATION.md` §C-1 and discrepancy **C-1**
> (finalizer unscheduled; readiness canary false-negative; three receipts stuck at `dvn_failed`).
> The access-receipt batcher path **is** operational. Any entropy-receipt anchoring design must
> account for that split and must not assume governance anchoring works today.

---

## 18. Qubit service contract

**18.1 Minimum request** — metaProof customer context · environment · byte count · generalized
purpose class · freshness requirement · proof requirement · unique request identifier · protocol
version. **Must not contain user, root, persona or DIDQube identifiers.**

**18.2 Minimum response** — matching request identifier · unique provider request identifier ·
entropy payload · byte count · generation timestamp · expiration timestamp · source class ·
source-health status · validation profile · signed proof or provenance data · provider signing-key
identifier · protocol version.

**18.3 Rejection conditions** — request IDs do not match · incorrect response length · stale response ·
invalid signature · revoked provider key · already-consumed response · malformed entropy ·
unacceptable health status · missing required proof · unauthorised source class · freshness exceeding
policy · failed transport authentication.

---

## 19. Assurance profiles

| Profile | For | Requirements |
|---|---|---|
| **DQ-Q1** Root and recovery | Root continuity keys, recovery keys, passport credential roots, high-value wallet roots | Hybrid entropy **required** · high-assurance local trust boundary · **no silent fallback** · full receipt · secure storage · explicit recovery policy |
| **DQ-Q2** Persona and DIDQube creation | Persona keys, pairwise/pseudonymous identifiers, service DIDQubes, rotation | Hybrid required or quantum preferred by policy · domain separation · no stable personal attributes · anti-correlation testing · receipt commitment |
| **DQ-Q3** Session and protocol | Nonces, challenges, salts, session identifiers, randomized delays | Quantum preferred · approved local fallback · fallback recorded · algorithm-specific uniqueness |
| **DQ-Q4** Cohort and fairness | Cohort assignment, sampling, steward selection, validator ordering | Eligibility commitment · algorithm commitment · local seed derivation · **no rerolls** · fairness receipt · verifiable outcome commitment |

---

## 20. Availability and fallback

```text
1. Primary Qubit endpoint
2. Alternate Qubit region or source
3. Approved secondary quantum provider
4. Local hardware or OS CSPRNG
5. Operation refusal where hybrid or quantum input is mandatory
```

**20.2 DIDQube-specific behaviour** — root recovery key: refuse without required hybrid entropy ·
routine session nonce: local fallback may proceed · persona rotation under active compromise:
emergency local rotation may proceed with an explicit downgrade receipt · fair public draw: pause
rather than silently downgrade.

**20.3 Continuity requirement** — **Qubit availability must not control personhood or root
continuity.** A person must retain a constitutionally valid recovery path even if Qubit is
unavailable, the partnership ends, or the provider changes.

---

## 21. Privacy requirements

No personal data, KybeDID, RootDID, persona identifier, DIDQube or cohort membership data in Qubit
requests · no final output returned to Qubit · no stable user correlation token · minimized purpose
codes · bounded log retention · request batching where useful · independent metaNet and blakNet
channels · prevention of provider traffic becoming an identity graph · provider deletion obligations.

---

## 22. Security requirements

**Transport** — TLS 1.3 minimum · mutual authentication for production where supported · signed
requests · replay prevention · bounded retries · strict timeouts · credential rotation · environment
separation.

**Local handling** — ephemeral entropy buffers · no raw entropy logging · no analytics capture · no
standard database storage · no browser local-storage persistence · prompt destruction of intermediate
material · secure-memory practices where available.

**Provider compromise** — the system must remain secure where Qubit is compromised but local entropy
remains sound, **and** where local entropy is degraded but Qubit entropy remains sound. **No single
entropy provider may determine the final DIDQube or key.**

---

## 23. Testing

**Functional** — anonymous / pseudonymous / identifiable / pairwise DIDQube creation · persona
separation · agent persona separation · metaNet and blakNet creation · identifier rotation · key
generation · recovery · cohort shuffle · receipt generation · fallback execution.

**Security** — replayed Qubit response · duplicate entropy · invalid proof · compromised provider key ·
provider outage · local generator degradation · domain-separation collision · cross-persona reuse ·
cross-network reuse · root leakage · log leakage · receipt tampering · hidden fallback · cohort
reroll · agent cross-principal correlation.

**Privacy** — confirm no root or persona data reaches Qubit · no stable user marker in provider
traffic · metaNet and blakNet requests not trivially linkable · rotated DIDQubes not publicly
correlatable · receipt commitments cannot reconstruct secrets · protected identity data not used for
model training.

**Randomness** — NIST SP 800-22 · PractRand · Dieharder · collision analysis · shuffle-distribution
analysis · bounded-integer bias analysis · identifier-distribution analysis.
**Passing statistical tests does not by itself prove quantum origin.** Provider provenance and
independent audit remain necessary.

---

## 24. Acceptance criteria

The pilot is accepted when:

1. A Qubit sandbox integration is operational.
2. DIDQube requests entropy through the DIDQube policy engine.
3. Qubit receives no person, root, persona or DIDQube identifier.
4. Qubit entropy is mixed with local entropy.
5. Anonymous, pseudonymous and pairwise DIDQubes can be generated.
6. Persona-specific keys are generated without cross-persona reuse.
7. metaNet and blakNet operations use separate contexts.
8. A DIDQube can rotate without public root exposure.
9. Final private keys are generated locally.
10. Raw entropy is absent from logs and persistent storage.
11. Entropy-use receipts are created.
12. Proof-of-State detects unauthorised or downgraded operations.
13. Cohort selection resists bias and rerolls.
14. Qubit outage behaviour follows DIDQube policy.
15. **Root continuity remains possible without Qubit.**
16. Security and constitutional reviews approve the architecture.
17. Marketing accurately describes the capability as **quantum-enhanced entropy**, not comprehensive quantum security.

---

## 25. Delivery phases

- **Phase 0 — Technical discovery** · Qubit API spec, source architecture, proof format, audit material, data-retention terms, pricing, throughput, latency, SLA, sandbox access, joint threat model.
- **Phase 1 — DIDQube entropy adapter** · test DIDQube creation, pairwise identifier creation, local key generation, entropy receipts.
- **Phase 2 — Persona and network pilot** · multiple personas, metaNet and blakNet DIDQubes, identifier rotation, agent persona separation.
- **Phase 3 — Polity Passport and metaMe production** · passport credential keys, DIDQube lifecycle, recovery, wallet and Companion integration, delegation keys, DVN receipt integration.
- **Phase 4 — Platform-wide randomized operations** · cohort allocation, research sampling, steward assignment, validator ordering, privacy-preserving scheduling, broader iQube operations, secondary entropy providers.

---

## 26. MOU requirements

**Qubit should provide** — quantum entropy API access · documented source architecture ·
source-health monitoring · signed provenance/proof metadata · sandbox and production environments ·
enterprise authentication · defined availability and throughput · security-incident notice ·
independent audit evidence · data-retention disclosure · deletion and exit provisions · integration
support · service continuity · accurate joint-communications language.

**The MOU must expressly confirm that Qubit** does not receive or custody final private keys · does
not receive personhood or identity records · does not receive DIDQube identifiers · does not
determine DIDQube policy · does not gain control over root continuity · may not use request metadata
to profile metaMe users · will not claim ownership of DIDQube-derived systems or methods · will
support migration or provider substitution.

**metaProof retains ownership and control of** DIDQube architecture · derivation logic · policy logic ·
entropy mixing · receipts · root and persona relationships · generated identifiers · generated keys ·
constitutional rules · user relationships.

---

## 27. Open questions for Qubit

1. Which quantum sources are presently production-ready?
2. How is source entropy measured?
3. What extraction and conditioning are applied?
4. What health tests run continuously?
5. What happens after a source-health failure?
6. Is entropy retained after delivery?
7. Can each response carry a signed proof?
8. Can proofs be verified offline?
9. How are provider signing keys rotated?
10. Can separate Qubit source instances or regions be selected?
11. What are latency and throughput limits?
12. What enterprise SLA is available?
13. Does the service support private networking?
14. What metadata is logged?
15. Can purpose values be generalized?
16. Can requests be batched?
17. How are ambiguous retries handled?
18. Can Qubit support source commitments for public fairness processes?
19. Can independent audits be provided under NDA?
20. What contractual language may metaMe use when describing quantum entropy?
21. Is fiat enterprise billing available?
22. Is use of a Qubit token required?
23. Can Qubit support future dedicated or on-premises infrastructure?
24. What functionality is available now rather than on the roadmap?

---

## 28. Success metrics

**DIDQube privacy** — no root or persona identifiers exposed to Qubit · no cross-persona or
cross-network seed reuse · no unauthorised public linkage after rotation.

**Security** — no raw entropy leakage · no private-key exposure · no accepted replayed responses · no
accepted invalid provider proofs · full receipts for high-assurance operations.

**Sovereignty** — root continuity survives Qubit outage or termination · Qubit cannot reconstruct
generated outputs · metaMe can substitute another entropy provider · DIDQube policy remains entirely
metaProof-controlled.

**Reliability** — provider availability meets SLA · fallback is explicit · no silent downgrade ·
acceptable latency for interactive DIDQube creation · acceptable cost per operation.

**Fairness** — no statistically significant cohort bias · no unreceipted rerolls · full precommitment
for designated fair selections.

---

## 29. Product invariant

> **Quantum entropy may strengthen the unpredictability of a constitutional operation, but it may
> never supply the authority for that operation.**

## 30. Architecture invariant

> **No party that supplies entropy may thereby acquire the capacity to reconstruct, correlate or
> control the identifier, key, person or action derived from it.**

---

## 31. Final product position

The integration is a **DIDQube quantum entropy capability**, not a Qubit identity or security
implementation. DIDQube remains responsible for the personhood relationship, identity continuity,
persona boundaries, contextual identifiers, authority, delegation, privacy, lifecycle, recovery,
receipts and constitutional admissibility.

```text
DIDQube operating model
        |
        v
DIDQube entropy policy
        |
        v
Qubit quantum entropy contribution
        +
metaMe-controlled local entropy
        |
        v
Local DIDQube derivation
        |
        v
Identifier, key, cohort or protocol outcome
        |
        v
DIDQube Proof-of-State receipt
```

**Qubit is integrated into DIDQube. DIDQube is not reorganised around Qubit.**

---

## 32. Next actions (execution not authorised)

1. **Write an execution plan** covering sequencing, owners, review gates and the cryptographic-design
   review required by §12 and §13.2. **This PRD is not an authorisation to build.**
2. Obtain operator approval of the execution plan.
3. Phase 0 technical discovery with Qubit; convert public documentation claims into contractual
   evidence (§26).
4. Cryptographic review of the hybrid construction and the DIDQube derivation model.
5. Constitutional admissibility review against invariants §5.1–5.8 and §29–30.
6. Only then begin Phase 1.

Until Phase 1 delivers code, tests, receipts and deployment evidence, matrix row **CI-17** remains
**Projected** and the manuscript must use the CR-9 pending-implementation wording.
