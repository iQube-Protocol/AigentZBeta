# Handover — Aigent Nakamoto's Constitutional Admission Journey

**Date:** 2026-08-03
**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Head at handover:** `104854d2c`
**Suite:** 263 files / 5180 tests passing · `npm run report:resolutions` clear
**Subject:** Aigent Nakamoto, tokenId `8798`, base-sepolia
**Principal:** ArkAgent (operator persona)

---

## 1. Read this first

Do **not** replay completed acts. Registration, Claim, Passport submission, Passport
approval and Factory ingestion have all really happened. The recurring defect all
day was not that acts failed — it was that observers could not see acts that had
succeeded, and surfaces then offered to perform them again.

The governing rule, which every remaining task descends from:

```
canonical outcome record
  → observer settlement
    → receipt as corroboration
      → stepper projection
```

Never:

```
receipt missing → act treated as absent
```

---

## 2. Where the journey actually is

| Stage | Live state | Notes |
|---|---|---|
| Register | ✅ complete | settled fact, tokenId 8798 |
| Claim | ✅ complete | control proof recognised; resumes without re-signing |
| Passport | ⚠️ **application submitted and approved in reality**, stage not projecting it | the live defect — see §4 |
| Delegate | ⛔ blocked behind Passport's projection | |
| aigentMe | not started | disposition act, not a gate |
| Factory (Ingest) | **already published as an L4 AigentQube** | do NOT re-ingest — see §5 |
| Standing | eligible once Factory reconciled | |
| FS (Pulse/P&L) | optional, last | gates nothing |

---

## 3. What shipped today (all pushed)

| Commit | What |
|---|---|
| `0ada69ec7` | Claim resumes from existing `agent_control_proven`; agent-scoped receipt lookup |
| `197f8c0ba` | Observer reads the agent the surfaces act on (`stateUrl` carried no `agentSlug`) |
| `0b2666ca5` | **Marketa removed from Claim at all three layers** — contract, observer, executor |
| `baa75f6be` → `4c35d8912` | Passport recognition: credential-first, then DID lookup removed entirely |
| `d041a5804` | Passport reads scoped to the **holder**, not the active persona |
| `86d7bcdfa` | Build-breaking brace fixed + parser canary over all journey sources |
| `80fdfa47a` | Admin sponsorship-capacity override |
| `7eb39f681` | Absolute Agent Card URL (a path was passed where a URL was required) |
| `806ff0ccf`, `104854d2c` | Steward Review Queue mirrored into Venture Lab (Participate + Administer) |

Most of these were **deletions**. The repeated shape was *one fact with two
observers*; the fix was almost always to remove the second observer, not to add
reconciliation between them.

---

## 4. TRACK 1 — the live defect, do this first

**Symptom:** the steward approved Nakamoto's Delegate Passport application. The
Journey then reverted to "ready for sponsorship."

**Cause**, in `app/api/journey/moneypenny-horizen/state/route.ts`:

```ts
passport: {
  operatorPolityCitizenPassportValid: operatorPassport.valid || hasReceipt(...), // canonical-first ✅
  sponsorBinding:         hasReceipt('agent_sponsorship_recorded'),      // receipt-ONLY ❌
  delegatePassportIssued: hasReceipt('agent_delegate_passport_issued'),  // receipt-ONLY ❌
},
delegate: { /* every signal receipt-ONLY ❌ */ }
```

The first was fixed 2026-08-03; its siblings were not. Approval wrote a Passport
record and **no receipt**, so the observer honestly reported nothing.

### Work

1. Make `sponsorBinding`, `delegatePassportIssued` and every Delegate signal read
   canonical records first (`polity_passport_records`, the delegation table),
   receipts as corroboration only.
2. Passport lifecycle states that survive refresh:
   `submitted → pending_steward_approval → approved → issued`.
   **Submission must never render as "approved."** Refresh must not collapse
   pending back to ready.
3. Write the missing receipts — `agent_sponsorship_recorded`, `agent_delegated` —
   as audit trail, **never as the gate**.
4. Approved Passport unlocks Delegate; Nakamoto appears in the Delegate selector
   and in the principal's Locker; delegation binds and projects to the stepper.

Adding the receipts *without* step 1 will make this look fixed while leaving the
fault in place. That is the trap.

**Expect stages to turn emerald from state that already exists.** Doing step 1
first tells you how much of the rest is genuinely missing versus merely unobserved.

---

## 5. TRACK 2 — Factory, now narrow (operator de-scoped it)

Nakamoto is **already published as an L4 Production Approved AigentQube**. The
operator's ruling: that L4 status carries a richer approval history than any field
mapping would synthesise, so leave the asset card alone.

The remaining question is one check:

> Does the application's stored JSON carry the Agent Card comprehensively?

If yes → mark Factory reconciled against the existing published asset. Done.

**Do not:** re-ingest, create a second asset, or build a field-mapping layer into
`trustScorerService` / `validatorService`. That work was sized and then explicitly
de-scoped.

---

## 6. Constitutional rulings established today

These were operator-ratified during the session and are binding on further work.

| Ruling | Consequence |
|---|---|
| **Claim = registration + wallet control proven** | Marketa is a post-aigentMe financial-services enrichment. It gates nothing. |
| **FSE is additive, never requisite** | Pulse/P&L/Marketa must not gate Factory ingestion or Standing. |
| **The Passport is the surfaced constitutional identifier** | KybeDID/RootDID are protected primitives *behind* it. Never a discovery key. |
| **Passport issuance mints the DID** | So requiring a DID to *find* a Passport inverts cause and effect. |
| **Human = KybeDID; Agent = RootDID** | An agent lacking a kybe is correct, not a defect. Nakamoto has no RootDID until her Delegate Passport creates one. |
| **A credential belongs to the holder** | Not to whichever persona is active when asked. |
| **Which passport is immaterial** | Any usable Citizen Passport owned by the sponsoring holder suffices. |
| **Execution / observation / projection are distinct** | No layer may substitute for or reinterpret another. |
| **Admin capacity is an ordinary tier variance** | The cap is already tier-gated (Free 3 → … → Portfolio unlimited). Admin is not an extraordinary exception. |

---

## 7. Open items

| Item | Status |
|---|---|
| Delegate/sponsorship observer signals receipt-only | **the live defect** — Track 1 |
| Passport lifecycle states don't survive refresh | Track 1 |
| `agent_sponsorship_recorded` / `agent_delegated` not written | Track 1 |
| Admin override surfaced but not receipted at the genesis call site | open |
| Admin capacity better expressed as a `sponsorship_capacity_base` grant than a branch | operator-suggested, not started |
| `Base 3` implies the operator persona resolves to the **Free** plan | worth checking — the tier may be the real fix, not the override |
| Factory: verify Agent Card completeness in application JSON | Track 2 |
| aigentMe recognition disposition | not started |

---

## 8. Two process lessons worth carrying

**Text canaries cannot catch a syntax error.** The suite passed 5128 tests over a
journey route that did not parse; Amplify caught it seven minutes later. Every
canary guarding those routes reads them as *text*, and no test imports them.
`tests/journey-response-honesty.test.ts` now runs the TypeScript parser over every
file under `app/api/journey`, `components/journey` and `services/journey`.

**Fix the class, not the instance.** The same defect was repaired three times on
individual surfaces (Register, Verify, Claim) before anyone fixed the observer —
which was the layer that actually decided stage completion. When a fix is the
third of its shape, stop and find what they share.

---

## 9. Preflight before writing code

Per `CLAUDE.md`'s Resolution → Invariant Loop, state before implementing:

- which resolution records you reviewed (`npm run report:resolutions`)
- which invariants apply
- which canaries protect them
- whether the work could invalidate, bypass, duplicate or regress an earlier resolution

Directly relevant: `CI-2026-08-03-ACTOR-SUBJECT-OWNER-001` (recurred three times
this session alone), `inv.engineering.036/037` (one authoritative location), and
`RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001`.

---

## 10. Adjacent workstreams the next agent should hold in view

These were not this session's focus, but they share surfaces and constraints with
the journey work. Each has a canonical doc — **read it rather than trusting this
summary**, which is deliberately thin.

### EXP-P1 / Crystal freeze path

| | |
|---|---|
| Canonical | `codexes/packs/agentiq/updates/2026-08-02_exp-p1-crystal-constitution-and-verification-regime.md` |
| Companion doc | `codexes/packs/agentiq/updates/2026-08-02_track2-freeze-path-readiness.md` |
| Status | **Internal Readiness. Nothing ratified, frozen, published or assigned.** |

The zero counts on EXP-P1 describe an **unstarted acquisition, not a defective
crystal** — do not "fix" them. The Track 2 readiness audit asked whether the path
from an external source to a frozen crystal actually runs; it did not, and four
links were repaired, one of which would have failed at the moment of the
constitutional act itself.

Open items carried from that work: verify the review package (agent JSON)
completeness, and end-to-end acceptance tests for all six reviewer paths.

**Discipline that governs it:** the hypothesis-vs-canon rule in `CLAUDE.md` —
empirical hypotheses stay `proposed` until their experiments produce evidence.
Never canonize one because a fix worked.

### Bitcent (B¢)

| | |
|---|---|
| Etch record | `codexes/packs/agentiq/updates/2026-07-30_bitcent-testnet-etch-broadcast.md` |
| Reserve ratification | `2026-07-30_bitcent-governed-reserve-ratification.md` |
| Ops wiring | `2026-07-30_bitcent-supabase-wiring-and-ops-surfacing.md` |
| Mainnet readiness | `2026-07-31_bitcent-mainnet-readiness-and-indexer-search.md` |

Real Bitcoin Runes **testnet** etch, tx
`551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65`.

**Mainnet is entirely operator-gated** — `scripts/deploy-qct-bitcoin.js` carries an
unconditional refusal. Do not weaken or route around it.

Two live constraints:
- No working Runes-aware **testnet indexer** was found. The wallet therefore shows
  *"Awaiting Runes indexer"* rather than `0 B¢` — an honest unknown, never a
  fabricated zero. Preserve that distinction.
- Terminology: **Bitcent / B¢** is Q¢'s Bitcoin-native *denomination*; QriptoCENT
  is the currency class; **CryptoSent** is a separate settlement-routing agent and
  is not a misspelling. See `CLAUDE.md`'s Q¢ section before editing any of it.

### metaMe Companion — and how it reaches the workspace for context

| | |
|---|---|
| Invariants | `codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md` |
| Recent fixes | `2026-07-26_companion-live-drive-fixes.md` |
| Phase plans | `2026-07-23_prd-mmc-impl-00{1,2,4}-companion-phase{2,3,5}-*.md` |

Eleven invariants (MS-1 … MS-11), **eight of which were the same shape** — two
things owning or describing one thing, with the stale one winning. That is the
same defect class this journey session spent the day on, which is why the
Companion work is worth reading even when you are not touching it.

**How the Companion gets workspace context:** it observes the page and forwards
an observation, gated by a live grant check. Two things routinely mislead:

- `{ok: true}` from the `OBSERVATION` handler is the **local consent result**,
  returned *before* the server forward resolves. It is compatible with every
  forward failing. The page console cannot tell you whether an observation landed.
- The real outcome is logged only in the **service worker** console:
  `chrome://extensions` → metaMe Companion → *Inspect views* → `service worker`.
  Check `chrome.storage.local.get(null, console.log)` for the grant state the
  worker actually holds.

MS-10 and MS-11 matter most for context access: *one observer, one record* (a
stale observation must never render as current), and *a cache may not answer
authoritatively before it is hydrated* — an MV3 worker is evicted after ~30s idle,
so the message that wakes it is dispatched before its own async hydration
callback runs. Answering "denied" for "not loaded yet" is a lie with the same
consequences as wrongly answering "granted".

**Open:** live browser acceptance test for the Horizen companion carousel
(passes 1–2) remains unverified.
