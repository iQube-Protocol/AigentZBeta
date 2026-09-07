# T0/T1 Constitutional Decision Brief — Wallet Control vs. DiDQube Authority

**Status:** Awaiting operator ruling. Not implemented. Prepared per explicit instruction: "Do not
implement item 6 yet... Claude should present the exact affected code paths before we canonize
that."

**This is Phase 3 item 6** from `2026-09-07_didqube-canonical-resolver-execution-plan.md`'s Phase 3
plan, originally scoped narrowly ("Resolve the T0/T1 tension the prior audit flagged —
`polity_passport_records.passport_id` exposed via `/api/polity-passport/wallet`"). The operator's
own framing for this ruling is broader than that one route — restated here as the question actually
being decided:

> T0 proves present control; T1/DiDQube establishes constitutional identity and authority. A wallet
> must never become the constitutional subject merely because it authenticated the session.

## 1. The question, precisely

When a caller proves control of a wallet (a valid signature over a server-issued nonce — T0,
"present control of this key, right now"), what is that proof allowed to do?

- **Option A (the operator's stated likely ruling):** wallet-proof is *evidence fed into* resolving
  an already-established constitutional subject (a `kybe_identity`/DiDQube for a human, an
  `agent_root_identity`/DiDQube for an agent). The wallet is never itself the subject; it is a key
  that unlocks a lookup. If no subject already exists behind that wallet, proving control of it
  establishes nothing constitutional — at most a fact ("this session controls this address") with no
  authority attached.
- **Option B (the shape to rule against):** wallet-proof is treated as sufficient, on its own, to
  mint or assert a constitutional identity/session/authority — i.e., "you signed with this key" is
  read as "you ARE this principal" without the key having first been bound to an already-resolved
  DiDQube subject.

## 2. What the code actually does today, file by file

### 2a. Already aligned with Option A — `resolvePassportPrincipal`

`services/identity/passportPrincipal.ts:121-178` (`resolvePassportPrincipal`). The walk, exactly as
documented at the top of the file (lines 14-22):

```
proven wallet
  → wallet_alias_commitments (active, by address fingerprint)
     → root_identity
        → root_identity.kybe_id  ............ canonical personhood (the binding key)
           → polity_passport_records(kybe_identity_id)  ... the Passport
```

The function's own success type (`PassportPrincipal`, lines 81-89) names `kybeId` as "Canonical
personhood. THE binding key" — the wallet address never appears in the returned principal at all.
A wallet with no `wallet_alias_commitments` row returns `wallet_unknown` (line ~130s); a wallet whose
lineage resolves to a kybe with no Passport returns `no_passport`. **The wallet is structurally never
the subject — it is only ever the entry key into a lookup that must terminate at kybe + Passport, or
it fails.** This is Option A, already, in the code that exists.

The DiDQube resolver (`services/identity/didQubeResolver.ts`) makes the same structural choice at the
type level: a `proven_wallet` input resolves to a `DiDQubePrimitive` tagged `trustClass:
'proven_control'` (line ~62-65's own doc: *"a wallet address the caller has already
cryptographically proven control of"*) — the wallet is an **input kind**, never a field of the
resolved primitive itself. `constitutionalAnchor` is always `kybe_identity` or `agent_root_identity`,
never a wallet address.

### 2b. Session minting from wallet-proof — needs an explicit ruling on scope, not a code defect

`services/identity/passportSession.ts:114-` (`issuePassportSession`). Mints a real Supabase
application session **directly from an already-resolved `PassportPrincipal`** (i.e., only ever called
after `resolvePassportPrincipal` has already succeeded — the function's own doc, lines 106-112:
*"The caller MUST have completed both prior acts — a consumed holder-control challenge and a
`resolvePassportPrincipal` success... handing it an unverified principal would mint a session for
whoever was named."*). Callers: `app/api/passport-connect/proof/route.ts`,
`app/api/passport-connect/finalize/route.ts`, `app/api/passport-connect/handoff-grant/route.ts`.

This is the one place a wallet signature's consequence is genuinely large — it results in a live,
authenticated session. Under the walk in §2a, the session is minted for the **kybe/Passport
principal the wallet resolved to**, not for the wallet itself, so this reads as consistent with
Option A structurally. **What has not been explicitly ruled on**: whether this is the intended
*scope* of what wallet-proof should be allowed to do at all (mint a full session, vs. e.g. only
authorize a narrower, time-boxed action) — that is a product/authority-scope decision, not a
code-correctness one, and is named here so the ruling can address it explicitly rather than by
omission.

### 2c. A separate, different-direction flow — not part of this tension

`app/api/wallet/principal/control-proof/route.ts`. Requires an **already-active persona session**
(`getActivePersona(req)`, line 30) before it will even issue a nonce — it proves control of a wallet
**already bound to an existing persona**, the reverse direction from §2a/2b (identity first, wallet
control proven second, as an additional fact about that already-established identity). Included here
only to confirm it is **not** an instance of "wallet becomes the subject" — it never could be, since
a subject must already exist to call it.

### 2d. The one confirmed, unreconciled violation — `passport_id` exposure

**`app/api/polity-passport/wallet/route.ts:90`**: `passportId: record.passport_id` is serialized
directly into the JSON response sent to the browser.

**`services/identity/passportPrincipal.ts:71-72`** (inline doc on `PassportSnapshot.personaPublicRef`):
*"NEVER the raw Passport UUID (`passport_id`) — that stays server-internal."* (Note: `passport_id` is
actually a `text` business key like `ppp-<32 hex>`, not a Postgres `uuid`-typed column — the comment's
"UUID" phrasing is imprecise, but its instruction is unambiguous: this column must never leave the
server.)

**`app/triad/components/codex/tabs/PassportBureauApplyTab.tsx`** (client component) then consumes this
leaked value as `sponsorPassportId` (lines 422, 465, 477, 509) and renders it directly in an error
message (line 1032: `` `${json.error}${json.passportId ? ` (existing passport: ${json.passportId})` : ''}` ``)
— a second-order dependency on the leak, meaning removing it from the response is not
response-shape-only; the consuming component needs a coordinated change too.

**Is this the SAME kind of violation as §1's Option B?** No — it is not "a wallet became the
constitutional subject." It is a narrower, but real, T0-identifier-exposure violation: a
server-internal business-key column reaching the browser, contrary to this codebase's own stated
rule for it. It is the one concrete, already-existing inconsistency the prior architecture audit
found (`2026-09-07_didqube-passport-architecture-vs-code-report.md` §4) and flagged for an explicit
ruling rather than a unilateral fix.

**Scope check — is `/api/polity-passport/wallet` an owner self-view route?** Per CLAUDE.md's own
"Owner self-view exception" (Identity & Access Spine section): a Bearer-scoped route returning the
**caller's own** identifiers is a different exposure class than a cross-user leak. The route's query
(`app/api/polity-passport/wallet/route.ts:56-57`) scopes to `scopedPersonaIds` — the personas the
*authenticated caller* owns (via `listOwnedPersonaIds`), not an arbitrary persona. So **if** the
owner-self-view exception is read to cover this shape, the exposure is to the record's own owner
only, not a cross-user leak. That reading has never been made explicit anywhere in the code, which
is exactly the audit's finding: two pieces of the codebase's own stated intent (the "NEVER" comment,
and the owner-self-view exception) have never been reconciled against each other for this specific
column.

## 3. Competing options for §2d (the passport_id exposure)

1. **Codify an explicit owner-self-view exception for `passport_id`.** Update
   `passportPrincipal.ts`'s comment to state the exception precisely (owner-scoped Bearer routes may
   return `passport_id`; it must never appear in a DVN receipt, a cross-user route, or any
   non-owner-scoped surface). No code change to the route or `PassportBureauApplyTab.tsx`. Lowest
   effort; risk is that a *future* route copies the same pattern without the same owner-scoping
   discipline, since nothing enforces the scoping other than the one route's own query.
2. **Tighten the route: stop returning `passport_id`, return only T1/T2-safe fields
   (`persona_public_ref`, a Passport class/status summary).** Requires updating
   `PassportBureauApplyTab.tsx` to stop consuming `sponsorPassportId` (or to source it from a
   different, safe reference — e.g. a server-side lookup keyed by something T1-safe). Higher effort;
   removes the ambiguity entirely rather than documenting around it.
3. **Hybrid: keep `passport_id` in the OWNER-scoped route, but add a lint/test canary (mirroring
   `tests/access-spine.test.ts`'s pattern) that fails the build if `passport_id` is ever selected or
   serialized from a route NOT proven to be owner-scoped** — codifies option 1's exception while
   giving it the enforcement option 1 alone lacks, without option 2's UI rework cost.

## 4. Recommendation

For §2d: **Option 3.** It ratifies the owner-self-view reading (matching how this same exception is
already used elsewhere per CLAUDE.md), closes the "nothing stops the NEXT route from copying this
pattern unsafely" gap that option 1 alone leaves open, and avoids the `PassportBureauApplyTab.tsx`
rework option 2 requires for a value that is not, on the evidence gathered, actually reaching anyone
other than the record's own owner today.

For the broader §1 question: the operator's stated principle (T0 present-control feeds a lookup;
T1/DiDQube is the actual authority) already matches what `resolvePassportPrincipal` and the DiDQube
resolver do structurally, per §2a — recommend ratifying it as a **general rule for all future
identity-resolution code** (a natural sibling to the existing T0/T1/T2 identifier-tier rule in
CLAUDE.md's Identity & Access Spine section), with §2d's fix as the first concrete correction made
under it, and §2b's session-minting SCOPE (not its correctness) flagged as a separate, narrower
open question for the operator to weigh in on explicitly if it needs its own ruling.

## 5. What this brief does NOT do

No code changed. No route modified. No comment updated. This is the "present the exact affected code
paths" step the instruction asked for, before any ruling is canonized.
