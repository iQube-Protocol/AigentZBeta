# Constitutional Authority Supremacy — Passport Non-Bearer & Unique Continuous Personhood

**Status: CANONICAL DOCTRINE, ratified 2026-07-30.** This is the architectural frame for every
consequential authority/execution decision going forward — including the transfer-endpoint
lockdown and route-authority inventory tracked separately (see "Where this doctrine is applied,
not yet done" below). This document records doctrine only; no code changes ship with it.

**Provenance:** developed across a single working session as a skeptic-team stress test of
"bounded delegation" — the skeptic's challenge (key compromise risk simply moves from the agent
key to the passport) forced three successive refinements, each preserved below because each
solves a distinct failure the previous one leaves open.

---

## 0. The core formula

> Key possession is evidence of cryptographic control. It is not, by itself, constitutional
> authority.

```text
cryptographic control
∩ personhood-bound principal
∩ active bounded delegation
∩ permitted transaction scope
= executable authority
```

Every consequential transaction requires the FULL intersection:

```text
valid agent signature
∩ active principal
∩ valid bounded delegation
∩ permitted action
∩ permitted asset
∩ permitted network
∩ amount within limit
∩ delegation not expired/revoked
∩ replay-safe mandate
∩ runtime policy approval
```

**Test for whether a design is constitutionally secured:**

> Could possession of any one credential cause this action?
>
> If the answer is yes, the transaction is not yet constitutionally secured.

---

## 1. Round one — the skeptic's challenge: the passport is just the key, relocated

Bounded delegation does not eliminate the root-of-authority problem; it moves the root from the
agent key to the principal's personhood authority. **If passport possession alone is sufficient
to issue new delegations, passport compromise becomes equivalent to agent-key compromise** — the
threat actor has simply moved, not been contained.

### Passport Non-Bearer Principle (canonical)

> A Polity Passport is evidence of personhood continuity and authority-bearing status.
> Possession or presentation of the passport alone must not be sufficient to create, enlarge or
> exercise consequential authority.

### The chain that must not collapse

```text
Passport possession ≠ personhood control ≠ authority to delegate ≠ authority to execute
```

The full chain:

```text
personhood continuity
∩ current authenticated presence
∩ authorised device or authenticator
∩ active authority role
∩ bounded delegation
∩ transaction policy
= executable authority
```

### Independent Control Principle (canonical)

> Consequential agent execution must require independently verifiable principal authority and
> agent execution. Compromise of either side alone must not be sufficient.

```text
stolen agent key alone                       → insufficient
stolen passport credential alone             → insufficient
valid delegation, no matching agent signature → insufficient
agent signature, no valid delegation          → insufficient
```

For treasury-grade actions, add a third side: `principal authority ∩ agent execution ∩ treasury
policy or co-approval`.

### Passport hijacking is not one threat — distinguish the vector

Each of these is a **different event with a different containment response**, and must be
distinguished rather than lumped into one "compromise" bucket:

```text
credential copied · session hijacked · device compromised · authenticator compromised
recovery compromised · user deceived · authority record altered
```

Concrete vectors: device/wallet theft, hijacked authenticated browser session, phishing into
approving a malicious delegation, account-recovery compromise, SIM-swap/email takeover on weak
recovery, malware on an already-authenticated device, coercion/social engineering, compromise of
the service that resolves passport ownership, insider reassignment of the passport-agent
relationship, replay of a previously signed delegation, theft of a synced passkey/cloud account.

### Progressive Authority Principle (canonical)

> Authentication and consent friction shall be proportional to the consequence, novelty and
> irreversibility of the requested action. Routine actions within an existing bounded delegation
> may proceed seamlessly; expansion of authority requires renewed proof.

Three tiers, friction rising only with consequence:

| Tier | Example | Friction |
|---|---|---|
| Routine | organise information, prepare drafts, inspect permitted records | silent, within a standing bounded delegation (e.g. 30-day, zero-value) |
| Moderate | "pay up to $50 to this named recipient within 10 minutes" | one-tap biometric/passkey confirmation |
| High-consequence | large transfer, new destination, new agent, new network | fresh passkey assertion, transaction-specific confirmation, possibly a delay/veto window, explicit asset/amount/network/destination presentation |

> The convenience rule: do not make the citizen repeatedly administer authority already safely
> delegated. Introduce friction only when an action exceeds the established authority envelope
> or materially changes risk.

### Recovery Separation Principle (canonical)

> Recovery of personhood continuity must not automatically restore all prior authority.
> High-consequence delegations and custody powers must be separately reactivated after recovery.

> Recover personhood first. Restore authority separately and progressively.

A passport must not be recoverable through one low-assurance channel (email/SMS alone) when it
controls significant authority. Recovery should combine an existing trusted authenticator, OR
threshold recovery across multiple independent factors, OR delayed re-proofing with notification
and veto — with automatic suspension of treasury delegation during the recovery window itself.

### Non-Atomic Takeover Principle (canonical)

> A single session must not be able to replace authenticators, alter recovery, appoint a new
> agent, grant consequential authority and execute the resulting action without independent
> confirmation, delay or policy control.

A compromised session must not, in one uninterrupted flow: add a new recovery method → replace
the authenticating device → delegate treasury authority → transfer funds. A cooling period or
secondary confirmation sits between new-agent-binding and that agent's transaction eligibility,
for treasury-grade agents specifically (low-risk agents may activate immediately).

### Continuous Attenuation Principle (canonical)

> Delegated authority must remain revocable and attenuable in response to credential, device,
> session, recovery or risk-state changes.

```text
passport-risk event
→ suspend new delegation issuance
→ attenuate active delegation
→ block consequential actions
→ require fresh principal proof
→ preserve historical receipts
```

### The privilege ladder

| Passport holds | Can do |
|---|---|
| passport alone | prove personhood continuity; show citizenship/participation status; discover existing relationships; request access to recovery/authentication flow |
| passport + current authenticator | create ordinary bounded delegations; revoke agents; rotate agent relationships; approve moderate actions |
| passport + step-up authority | grant treasury authority; approve high-value transactions; change recovery controls; replace primary authenticators; appoint/remove custodians; create long-lived or redelegable authority |

### The four (five, for treasury) independent roots

```text
Personhood root      — who is the continuing principal?
Authentication root  — is the principal presently and validly participating?
Delegation root      — what exact authority was granted?
Execution root       — which authorised agent/wallet performed the action?
[Policy/custody root — did independent treasury policy permit it? (treasury-grade only)]
```

Compromise of any one root must be insufficient on its own.

---

## 2. Round two — quarantine and cleansing, not revocation

**The operator's refinement:** the goal is not passport revocation (the Web3 norm of "rotate the
key, abandon the old identity surface"). It is **passport continuity under temporary quarantine**,
followed by personhood-backed cleansing and progressive authority restoration. Blast radius is
contained and cleansed — the passport itself is not destroyed.

### Passport Continuity Principle (canonical)

> A Polity Passport represents continuing personhood and must not be discarded merely because a
> credential, device or control path is compromised. Compromise suspends authority; it does not
> erase continuity.

### Passport Quarantine Principle (canonical)

> When passport control is credibly disputed, the passport shall enter quarantine. Quarantine
> preserves history, Standing and relationships while preventing new consequential authority until
> control is re-established.

### Passport Cleansing Principle (canonical)

> A quarantined passport may be cleansed through fresh proof of present personhood, passport-
> specific continuity evidence, authenticator replacement, session invalidation and delegation
> review. Cleansing restores the existing passport rather than issuing a replacement identity.

### The four passport states

| State | Meaning |
|---|---|
| **Active** | establishes authority normally |
| **Guarded** | anomaly detected, compromise unconfirmed — routine low-risk activity continues; new consequential delegations require step-up proof |
| **Quarantined** | compromise/recovery asserted — new delegations blocked, consequential transactions suspended, existing treasury delegations attenuated, agent relationships stay visible but non-executable, receipts/Standing intact |
| **Cleansed** | continuity re-established, compromised authenticators removed, delegations reviewed, authority progressively restored — **passport identifier unchanged** |

### Cleansing ceremony (illustrative, not yet implemented)

```text
1. compromise reported or detected → passport quarantined immediately
2. existing agents lose consequential execution authority
3. citizen completes fresh World ID Proof of Human
4. citizen proves passport continuity through an independent channel
5. new authenticator enrolled
6. old sessions/devices/delegation credentials invalidated
7. existing delegations displayed for review
8. low-risk authority restored
9. treasury/high-risk authority reactivated separately
10. cleansing receipt anchored
```

> Compromise should revoke control paths, not personhood continuity.

What changes on compromise: authenticators, sessions, active authority, delegations, execution
permissions. What does not change: personhood history, Standing, prior receipts, institutional
relationships, agent lineage, contractual/governance history.

### Independent Personhood Factor Principle (canonical)

> High-risk delegation, recovery and cleansing may require an independent privacy-preserving proof
> of human presence. Such proof supplements but does not replace evidence linking the claimant to
> the affected passport.

World ID's role here (first pass): an independent proof-of-human factor for recovery/step-up —
establishes a real human is present, freshly, action-bound (e.g. scoped to
`passport-cleanse:<passport-id>:<recovery-nonce>` or `high-value-delegation:<mandate-hash>`),
non-replayable. **World ID alone cannot prove passport ownership** — an attacker also has a valid
World ID. Cleansing must jointly answer two separate questions: *is this a unique human?* (World
ID) and *is this the continuing human principal of this passport?* (passport-specific continuity
evidence: existing trusted authenticator, unaffected device-bound credential, prior recovery
secret, historical personhood-binding evidence, delayed challenge through existing trusted
channels, prior RootDID/KybeDID continuity relation).

### Solo Sovereignty Principle (canonical)

> Constitutional security must permit a single citizen to retain sovereign authority without
> mandatory reliance on another human custodian. Security shall arise from independent proofs and
> bounded execution, not compulsory transfer of authority to third parties.

Explicit operator position: rejects mandatory human multisig for a solo founder/citizen. The
requirement is not *"every consequential act needs another person"* but *"every consequential act
needs multiple independent proofs that no single compromised instrument can satisfy."* A solo
citizen supplies those proofs themself: personhood continuity, fresh human-presence proof, a
trusted authenticator, bounded delegation, transaction-specific consent, an independently enforced
policy engine. This is a **multi-proof sovereign authorization**, not a multisig — authority stays
with the one citizen; no third-party co-signer is required.

### Coercion is a separate, explicitly out-of-scope-for-baseline-design edge case

Duress/kidnapping is a real but distinct threat class (the legitimate human may be genuinely
present and produce valid proofs under duress). Not solved by any proof-of-personhood mechanism.
Addressed, if at all, through optional add-ons that must not become mandatory friction for ordinary
citizens: duress PIN/covert refusal gesture, delayed settlement above thresholds, destination
allowlists, cooling periods on unusual actions, emergency freeze, private distress signal,
configurable daily loss limits. **Operator's explicit position: do not define the baseline system
around edge cases; provide edge-case safeguards as a separate, optional layer.**

---

## 3. Round three — sharpened terminology: unique, continuous personhood

**Refinement over "proof of life":** the precise property World ID contributes is not liveness in
the medical/legal sense. It is:

> **Proof of unique, continuous personhood.**

Decomposed into three independent contributions, each answering a different question:

```text
uniqueness   (World ID)          — this is one real human, not a duplicate or synthetic claimant
continuity   (Polity Passport)   — this is the continuing constitutional person of this passport
patternhood  (receipted history) — the continuity is coherent, not merely asserted
```

> World ID establishes uniqueness. The passport establishes continuity. Constitutional patternhood
> proves the continuity is coherent.
>
> Uniqueness proves one person. Continuity proves the same person persists. Patternhood proves the
> continuity is coherent.

### Why uniqueness is stronger than ordinary liveness

A liveness check establishes "a live face is in front of a camera." It does not establish that the
claimant hasn't created multiple recovery identities, isn't repeating the action through multiple
accounts, or is one unique human principal. World ID's uniqueness + nullifier/action-scoping
primitives let the system impose rules such as *one unique human → one passport-cleansing claim →
for this passport → during this recovery window*, or *one unique human → one high-value
authorization → for this transaction mandate*.

### Non-Identifying Personhood Principle (canonical)

> A citizen must be able to prove unique personhood without disclosing civil identity, persistent
> public keys or unrelated activity.

The citizen actively consents to presenting the proof; the proof itself does not require
disclosing civil identity, documents, or PII to metaMe (privacy-preserving, zero-knowledge-backed,
action-scoped).

### Personhood–Passport Binding Principle (canonical)

> Proof of unique personhood does not alone establish entitlement to a particular passport.
> Constitutional authority requires a verified continuity binding between the unique human
> principal and the passport being recovered or exercised.

```text
passport control alone   ≠ unique personhood ≠ authority
World ID alone           ≠ entitlement to a particular passport
```

Once a World ID is constitutionally bound to a passport, a fresh action-scoped World ID proof
becomes much more powerful: it demonstrates the same unique-personhood root is participating,
without exposing external identity.

### Patternhood Principle (canonical)

> Personhood continuity shall not depend on possession of one permanent identifier or
> cryptographic key. It may be established through a privacy-preserving, constitutionally
> receipted pattern of prior proofs, authenticators, delegations, relationships, actions and
> Standing.

> Identity asks who you are called. Patternhood demonstrates that you are the continuing person
> who has inhabited this constitutional history.

Evidenced through: prior personhood proofs, trusted authenticator history, agent relationships,
bounded delegations, Standing, institutional participation, recovery commitments, action/receipt
history — none individually identifying, jointly coherent.

### Unique Continuous Personhood Principle (canonical, consolidating)

> A constitutional person may establish authority through proof of unique, continuous personhood.
> Uniqueness demonstrates that the claimant is one real human principal. Continuity demonstrates
> persistence of that principal across changes in keys, devices, sessions and identities.
> Patternhood demonstrates a coherent relationship between the claimant and the passport's
> receipted history.

### Cleansing Standard (canonical, final form — supersedes the round-2 cleansing ceremony's evidentiary bar)

> A quarantined passport may be cleansed when fresh unique-personhood evidence, passport-specific
> continuity evidence and established patternhood jointly demonstrate that the continuing citizen
> has regained control.

```text
fresh proof of unique personhood
∩ continuity with the existing passport
∩ consistency with established patternhood
= authority to cleanse and restore the passport
```

### A stronger passport data model (illustrative — not yet implemented)

```text
Passport continuity root:        KybeDID
Independent uniqueness provider: World ID Proof of Human
Binding status:                  verified
Allowed uses:                    quarantine cleansing · primary authenticator replacement ·
                                  treasury delegation · high-value mandate · recovery finalization
```

The passport stores evidence that a valid privacy-preserving uniqueness binding was made and the
conditions under which it may be invoked — **never raw World ID data, never a public biometric
identity.**

### Terminology note, precise

- **Proof of life** — rejected as the term; implies a medical/legal liveness claim the mechanism
  does not make.
- **Proof of Present Personhood** — a fresh World ID proof demonstrates fresh participation by a
  verified unique human; it is a constitutional term, not a medical one.
- **Consentless personhood** — rejected; the citizen actively *consents* to presenting the proof.
  The correct property is **identityless unique personhood** / **non-identifying proof of unique
  personhood**: no civil identity, documents, or persistent public key is disclosed to the relying
  application.

---

## 4. Consolidated narrative

> Personhood establishes the principal; independent authenticators establish present control;
> bounded delegation establishes scope; the agent key establishes execution; policy establishes
> permission.
>
> World ID establishes uniqueness. The passport establishes continuity. Constitutional patternhood
> proves the continuity is coherent. Bounded delegation establishes scope. The agent key proves
> execution.
>
> Keys rotate. Sessions expire. Delegations are revoked. Authenticators are replaced. But
> personhood continues. A compromised passport is not destroyed — it is quarantined, cleansed and
> restored to its continuing citizen.

---

## 5. Where this doctrine is applied — not yet done

This document is doctrine only. Nothing here has been implemented. The immediately relevant,
already-tracked engineering consequences:

- **Route-authority inventory** (`/api/admin/*`, `app/api/a2a/signer/transfer/route.ts`) — must be
  evaluated against the "could possession of any one credential cause this action?" test from §0,
  and against the Independent Control Principle specifically (principal-side authority proof ∩
  agent-side execution signature, both independently verifiable). Not yet built.
- **Transfer-endpoint fail-closed/disable** — the confirmed-absent authority chain on
  `app/api/a2a/signer/transfer/route.ts` is a direct, concrete violation of the Independent Control
  Principle (a bare `agentId` currently satisfies the whole chain by itself). Not yet done.
- **Passport state machine** (Active/Guarded/Quarantined/Cleansed), the cleansing ceremony, and
  World ID binding are architectural proposals in this document — none of it exists in the
  Polity Passport implementation today. Before any of it is built, it needs its own scoped design
  pass (data model, `discloseCredential()`-style disclosure boundaries, binding to
  `services/identity/*`'s existing T0/T1/T2 tiering, and an explicit review against the Identity &
  Access Spine's canonical files, which this doctrine must compose with rather than fork).

None of the above should be treated as authorized to build from this document alone — this
records the ratified *frame*; each application still needs its own scoped implementation plan and
sign-off.
