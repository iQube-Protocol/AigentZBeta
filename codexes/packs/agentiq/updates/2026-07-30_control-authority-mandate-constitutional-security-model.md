# Control–Authority–Mandate — the Root Constitutional Security Model

**Status: CANONICAL DOCTRINE, ratified 2026-07-30.** This is the root frame under which the
Passport, bounded delegation, agentic signing, treasury execution, recovery, and runtime-security
models are all organized. It supersedes no prior doctrine — it names and generalizes what
`2026-07-30_constitutional-authority-supremacy-passport-security.md` (the Passport Non-Bearer /
Unique Continuous Personhood doctrine) already established for the *Authority* leg specifically,
and gives the previously-informal "permitted transaction scope ∩ amount within limit ∩ replay-safe
mandate" bullets in that document's §0 formula their own first-class name and treatment: **Mandate**.
This document records doctrine only; no code changes ship with it.

**Amendment, same day:** §III.1 below (Right-Sized Mandate Strength) sharpens Mandate from a static
permission object into a dynamic, risk-proportionate one — this is not a new leg, it is what gives
Mandate its constitutional character. It operationalizes, for the Mandate leg specifically, what
Invariant 8 (Progressive Security) already stated in general terms.

---

## 0. The core formula

> A key proves control, not authority. A passport and delegation prove authority, not unlimited
> permission. A mandate proves that this exact consequential action is intended and permitted now.
> Only the intersection of all three can execute.

```text
Proof of Control
∩ Proof of Authority
∩ Proof of Mandate
= Consequential Authority
```

The three-part model:

- **Control** proves the actor *can* act.
- **Authority** proves the actor *may* act.
- **Mandate** proves *this particular action* is authorized *now, under these conditions*.

**Elevator pitch:** Traditional cybersecurity secures the key. Constitutional security secures the
consequence. A key proves control, a passport and delegation prove authority, and a dynamic mandate
proves that this exact action is intended and permitted now. Only all three together can execute.

Refined, since Mandate is risk-proportionate rather than a static permission object (§III.1):
**traditional systems ask whether a user has permission; constitutional security asks whether this
person or agent has the right authority, under the right mandate, for this exact consequence, at
this moment.**

**Compressed line:** Control says can. Authority says may. Mandate says this, now, under these
conditions.

---

## I. Control

Control proves that an actor possesses or can operate a cryptographic instrument.

**Question:** Can this actor produce the required signature?

**Evidence:** private-key signature, session credential, device authenticator, agent execution key.

Control authenticates the actor or instrument. It does not establish legitimate permission.
**Possession of a key is evidence of control, not authority.**

## II. Authority

Authority proves that the actor's power derives from a legitimate sovereign principal.

**Question:** May this actor act, in general?

**Evidence:** continuing personhood, Polity Passport, active bounded delegation, valid agent
credential, Standing or jurisdiction where required, revocation and expiry state.

Authority establishes the lawful relationship between principal, agent and polity. It does not
grant unlimited permission. **Authority originates in sovereign personhood and is conveyed through
bounded delegation** — this is the full subject of
`2026-07-30_constitutional-authority-supremacy-passport-security.md`'s Rounds 1–3 (Passport
Non-Bearer Principle, Independent Control Principle, Progressive Authority Principle, Recovery
Separation, Unique Continuous Personhood). That document remains the canonical elaboration of what
counts as valid Authority; this document does not re-derive it, only names its place in the
three-part model.

## III. Mandate

Mandate proves that this precise action is intended and permitted in its present context.

**Question:** May this actor perform this particular action, now?

**Evidence — a mandate should ordinarily include:**

```text
principal
agent
action
asset
amount
source
destination
network
purpose
policy scope
nonce
expiry
revocation state
transaction commitment
```

The mandate converts general authority into consequence-specific authorization:

```text
General authority:    Aigent Z may operate the BitCent Treasury.
Contextual mandate:   Aigent Z may transfer 100 B¢, on Bitcoin testnet, to address X,
                       before time Y, for pilot settlement Z.
```

**A mandate is a dynamic, contextual and transaction-bound proof of intent.**

### III.1 Right-Sized Mandate Strength (amendment, same day)

Mandate is not a static permission object. It changes with the consequence being proposed — its
required strength scales with the risk of what it authorizes:

```text
risk + value + irreversibility + novelty + destination + timing = required mandate strength
```

A low-risk action may rely on a standing mandate:

```text
read data
generate report
retrieve proof
perform bounded analysis
```

A higher-risk action requires a fresher, narrower and stronger mandate:

```text
move funds
change custody
appoint an agent
expand delegation
rotate recovery authority
execute on Mainnet
```

**Contextual Mandate Principle (canonical):**

> A mandate shall be dynamically scoped to the action, actor, asset, amount, destination, network,
> duration and risk of the proposed consequence. Its strength, freshness and specificity must rise
> in proportion to the value, irreversibility and potential harm of the action.

**Right-Sized Constitutional Security Principle (canonical):**

> Constitutional security shall impose no more friction than the consequence requires, but no less
> proof than the risk demands.

The governing rule: **the mandate must be no broader, older or weaker than the consequence
justifies.** Applied as a ladder:

- low consequence → low-friction mandate (a standing mandate suffices);
- moderate consequence → fresh contextual confirmation;
- high consequence → transaction-specific mandate plus stronger independent proofs;
- exceptional consequence → heightened review, delay, observation or threshold approval.

This is the same ladder the Passport doctrine's Progressive Authority Principle already establishes
for authentication/consent friction generally (Routine/Moderate/High-consequence, §1 of
`2026-07-30_constitutional-authority-supremacy-passport-security.md`) — this amendment states it as
the operative rule for the Mandate leg specifically, not as a new, separate ladder.

**Refined execution equation:**

```text
Proof of Control
∩ Proof of Authority
∩ Right-Sized Contextual Mandate
= Constitutional Permission to Act
```

This refines, rather than replaces, §0's `= Consequential Authority` form — "Right-Sized Contextual
Mandate" is what "Proof of Mandate" means once its required strength is understood to scale with
risk rather than being fixed.

---

## Why all three are necessary — each is deliberately insufficient alone

```text
Control without Authority                    = capable but unauthorized
Authority without Control                    = entitled but unable to execute
Control and Authority without Mandate        = broadly empowered but not authorized for this consequence
Mandate without Authority                    = an instruction with no legitimate source
Mandate without Control                      = an authorization that cannot be securely exercised
```

Only their intersection may produce a consequential action.

## The threat-model advance — this does not merely relocate the single point of failure

```text
Stolen key                    → control without authority or mandate
Compromised passport session  → authority continuity without execution control or a valid mandate
Captured old approval         → mandate fails nonce, expiry, destination, amount or transaction binding
```

> We do not move the single point of failure from the key to the passport. We dissolve the single
> point of failure across independent proofs of control, authority and mandate.

```text
compromise of one factor  →  attenuation or refusal
                          not
                          →  complete authority takeover
```

**Constitutional rule:** Security shall not relocate a single point of failure from one credential
to another. Consequential authority must be distributed across independently verifiable proofs of
control, authority and mandate.

---

## Constitutional Security Invariants (ratified)

1. **Control–Authority Separation.** Cryptographic control must never be treated as sufficient
   evidence of constitutional authority.
2. **Personhood-Originating Authority.** Consequential authority originates in sovereign personhood
   and may be exercised by an agent only through an active, bounded and revocable delegation.
3. **Mandate Specificity.** General authority does not authorize an unspecified consequence. Every
   consequential action must be bound to a sufficiently specific mandate.
4. **Consequence Binding.** The executed action must match the approved mandate in action, asset,
   amount, source, destination, network, agent, policy, nonce and expiry. Any material mismatch must
   refuse execution.
5. **Independent Proof Requirement.** Proofs of control, authority and mandate must arise through
   sufficiently independent control paths that compromise of one does not manufacture the others.
6. **Non-Bypass.** No execution key, route, wallet or runtime process may bypass the authority and
   mandate system for an action classified as consequential.
7. **Continuous Authority Evaluation.** Authority is not permanently established at login or
   credential issuance. It must be re-evaluated at the moment of consequential action against
   current delegation, revocation, risk and mandate state.
8. **Progressive Security.** The strength and freshness of required proofs should increase with the
   value, irreversibility, novelty and risk of the proposed consequence.
9. **Receipt of Consequence.** Every consequential action or refusal must produce a receipt
   recording the proofs evaluated, the mandate applied, the policy decision and the resulting
   execution state.
10. **Refusal Supremacy.** Where any required proof is absent, invalid, expired, revoked,
    contradictory or mismatched, refusal must outrank convenience, profitability and partial
    completion.

## Established, canonically

- Possession of a key is evidence of control, not authority.
- Possession of a Passport is evidence of constitutional continuity, not unilateral execution
  permission.
- Bounded delegation establishes general authority but not unlimited transactional permission.
- Every consequential action requires a fresh or currently valid contextual mandate.
- Any material mismatch between mandate and execution must refuse.
- No wallet, endpoint, agent key or administrative route may bypass the complete authority chain.
- Refusals and executions must both generate constitutional receipts.

## The fuller constitutional execution equation

```text
valid control
∩ continuing principal
∩ active bounded delegation
∩ valid agent standing and jurisdiction
∩ transaction-specific mandate
∩ current policy compliance
∩ replay-safe execution
= constitutional permission to act
```

Runtime expression:

```text
authenticate control
→ resolve principal
→ verify delegation
→ evaluate jurisdiction
→ validate mandate
→ apply policy
→ execute exact consequence
→ issue receipt
```

## Relationship to the Passport

```text
Personhood  = origin and continuity of authority
Passport    = constitutional record of that continuing personhood
Delegation  = bounded conveyance of authority
Mandate     = contextual activation of authority
Key         = execution control
```

> The Passport preserves continuity and standing; it does not, by itself, execute consequential
> authority.

---

## Where this doctrine is already instantiated in code (not retroactively rewritten — flagged as evidence)

`services/treasury/pilotTreasuryAuthority.js` (2026-07-30, this session, predating this doctrine's
naming but not its substance) is a concrete, working instance of the full three-part model for
BitCent treasury execution:

- **Control** — `verifyOperatorPasscode` (scrypt-hashed operator passcode, constant-time compare)
  and the treasury custodian's signing key.
- **Authority** — `evaluateSignatories` against `TRANSACTION_CLASS_POLICY` (a required signatory —
  Aigent Nakamoto for ordinary treasury actions, Platform Aletheon for constitutional exceptions —
  plus an observer, Aigent Kn0w1). This is the bounded-delegation/role layer, not yet expressed in
  terms of a Polity Passport for a human principal (the pilot's "PILOT-AUTHORISED — PROVISIONAL
  SECURITY PROFILE" carve-out, per `2026-07-30_bitcent-governed-reserve-ratification.md`'s post-pilot
  review trigger).
- **Mandate** — `validateMandateShape` requires exactly the field set this doctrine's §III lists
  (principal/agent/action/asset/amount/source/destination/network/policy/nonce/expiry/
  transactionClass), `assertMandateNotExpired`, `assertReplaySafe` (nonce), and
  `assertMandateMatchesTransaction` (Invariant 4, Consequence Binding — refuses on any asset/amount/
  destination/network mismatch, checked once before authorization and again immediately before
  broadcast in `scripts/deploy-qct-bitcoin.js`).

This is cited as existence proof that the model is buildable and already load-bearing for a real
(pilot, testnet) financial pipeline — not as a claim that every surface listed below has been
brought into compliance.

## Where this doctrine still needs to be applied — not yet done

Per the operator's instruction, this framework is to be applied across:

- passport and agent delegation (the existing Passport doctrine's own §5 "not yet done" list —
  route-authority inventory, transfer-endpoint fail-closed/disable, the Passport state machine —
  is the Authority-leg subset of this work and is unchanged by this document);
- treasury and wallet execution beyond the BitCent pilot (the pilot treasury authority gate is one
  instance for one asset; it is not yet generalized into a shared primitive other treasury/wallet
  surfaces reuse);
- Financial Services Runtime admission (MoneyPenny's admission decisions — see
  `2026-07-30_moneypenny-horizen-presence-and-external-agent-admission.md` — should be reviewed
  against this model's Mandate leg specifically: is every admitted action bound to a
  transaction-specific mandate, not merely a general capability grant?);
- agentic multisignature;
- admin and transfer endpoints (`app/api/admin/*`, `app/api/a2a/signer/transfer/route.ts` — already
  flagged as a concrete violation in the Passport doctrine's §5; this document adds that the
  violation is specifically an absence of a validated, consequence-bound Mandate, not only a gap in
  Authority proof);
- settlement and payment instructions;
- identity and authenticator recovery;
- public launch security hardening.

None of the above is authorized to be built from this document alone — this records the ratified
*frame*. Each application needs its own scoped implementation plan and operator sign-off, exactly as
the Passport doctrine's §5 already establishes for its own subject matter.

## Provenance

Developed in the same working session as the BitCent pilot treasury authority gate, as a
generalization of that gate's ad hoc three-part structure (passcode+signature / signatory policy /
mandate object) into a named, portable doctrine intended to organize every future consequential-
authority surface, not just BitCent's.
