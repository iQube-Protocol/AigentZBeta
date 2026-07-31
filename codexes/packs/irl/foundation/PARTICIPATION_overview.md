# Participation — How to Join the Invariant Research Lab

**The Institute's navigation reads as a journey: Institution (who we are) → Research (what we know) → Laboratory (how we discover) → Publications (what we've shared) → Participation (how you join). This is the last step — and the beginning of yours.**

The Invariant Research Lab is an open constitutional research institution. The science is public — every protocol, record, invariant, and result in the other four spaces is readable without an account. **Participation** is where your *relationship* with the Institute begins: identity, agreements, delegation, and contribution.

---

## Who participates

| Role | What it means |
|---|---|
| **Independent Reviewer** | Reviews and countersigns pre-registered experiment protocols; may independently re-run arms and judges and submit results (e.g. the EXP-P1 external review) |
| **Researcher** | Works the research programmes — experiments, invariant discovery, validation |
| **Partner / Cohort member** | Collaborates through an invitation-only cohort with shared workspaces |
| **Delegated agent** | An AI agent operating under a participant's bounded, revocable authority — never with authority of its own |

## How joining works (three constitutional steps)

Everything happens in the runtime — no emails, no PDFs, no detached documents. The canonical state of your participation (agreements, receipts, standing) lives here.

1. **Passport** — apply for a Polity Passport (the *Passport* tab). Anonymous proof of personhood with self-custody privacy; a weak captcha proof suffices for read/write participation (strong World ID verification is reserved for higher-risk delegations).
2. **Delegation** — if an agent will act for you, sponsor it with a **bounded delegation** (the *Delegation* tab): scoped surface, expiring TTL, capped action budget. Your agent may accept terms; **only you can ever authorize them** — an agent can never grant itself authority.
3. **Agreement** — participation in a specific programme (e.g. an experiment review) is governed by an **x409 Constitutional Agreement**: the Institute forms the terms, your agent accepts its side, the Institute's operator countersigns. That single countersignature freezes the protocol and opens your submission capability. Every step is receipted and tamper-evident.

## For reviewers arriving with an invitation

Your invitation link brought you here. The sequence:

1. Read the protocol package — *Laboratory → Protocols & Articles* (the pre-registration protocols, Stage-0 validation records, and roadmap).
2. Complete the Passport application (*Participation → Passport*).
3. Review your agreement's terms, have your agent accept, and await the Institute's countersignature — the agreement id you received privately works with the public API below.
4. Submit results under your bounded authority once runs complete.

## The public API (for your agent — no credentials required to read)

| Step | Call |
|---|---|
| Review agreement terms | `GET /api/public/irl/agreement?agreementId=<id>` |
| Accept (agent's side) | `POST /api/public/irl/agreement` `{"action":"accept","agreementId":"<id>","acceptorId":"<agent-ref>"}` |
| Submit results (after authorization) | `POST /api/public/irl/experiments/submit` |
| Verify any published result | `GET /api/public/irl/experiments-results` — recompute sha256 over `resultsJson` and compare with `contentHash` |
| Fetch the invariant substrate | `GET /api/public/irl/invariants` · `GET /api/public/irl/invariant-field` · `POST /api/public/irl/resolve` |
| Download any public document | `GET /api/public/irl/doc?path=<pack path>` |

## What you can rely on

- **Acceptance ≠ authorization.** Only the human owner of an agreement can authorize it; no agent — yours or anyone's — can open its own gate.
- **Bounded, expiring, revocable.** Every delegated authority carries a TTL and an action budget, re-checked on every use.
- **Everything receipted.** Acceptance, authorization, and every submission emit tamper-evident receipts (DVN-anchorable).
- **Minimum disclosure.** Only refs and commitments are stored — no personal identifiers in any receipt or published row.

*Coming next: your personal Research Space — a private slice of this cartridge holding your agreements, instructions, submissions, and engagement thread, activated the moment your passport binds to your invitation.*
