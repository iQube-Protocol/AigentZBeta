# CFS-044 — The Open Lab: Research Spaces, the Four Surfaces, and the Runtime as Place of Record

**Chrysalis Foundation · Constitutional Charter v2 (consolidated Claude × Aletheon, 2026-07-18) · Status: PROPOSED (ratify-before-build; Phase 0 executable today)**
**Operator direction:** everything in the application or the repo — constitutional, inside the runtime; no emails beyond invitation; private engagement without pre-existing signup; a capability that generalises to every future reviewer/researcher; thinnest viable implementation, nothing throwaway.

---

## 1. The governing principle (candidate constitutional invariant — for ratification)

> **The Runtime is the Place of Record.** Constitutional collaborations occur within the constitutional runtime itself. Emails, PDFs, detached documents, and ad-hoc communications are convenience mechanisms for *invitation only*; the canonical state — instructions, agreements, provenance, and collaboration history — exists inside the runtime.

This is the next architectural invariant of the Constitutional Internet: **there is no "outside" of the constitutional runtime.** The email→PDF→website→GitHub→application chain collapses to `Invitation → Runtime → everything else`. The invitation email says one thing — *"you've been invited"* — one click, done.

*Proposed for the canon on operator ratification (governance/architecture principle → `canonical` per the hypothesis-vs-canon discipline; it asserts how the Institute works, not an empirical claim).*

## 2. The four surfaces (supersedes v1's two-surface law)

```
IRL OS
├── PUBLIC          open science — protocols, registry, experiments, records,
│                   articles, roadmaps. No identity required.
├── COHORT          invitation-only shared spaces — Reviewer, Academic,
│                   Partner, Investor, Pilot cohorts. Shared by members.
├── PERSONAL        one Research Space per participant — their agreements,
│                   receipts, submissions, notes, delegated agents, thread.
│                   Only them (+ their delegated agents).
└── CONSTITUTIONAL  things requiring constitutional execution — x409,
                    delegation, passport, receipts, voting, ratification,
                    publication.
```

Each solves a different problem; v1's "private" conflated COHORT and PERSONAL — they are distinct. Every piece of IRL content and interaction lives on exactly one surface.

## 3. Research Spaces + the Reserved lifecycle (solves the chicken-and-egg)

The capability is named **Research Spaces** (not "My Canvas", not "My Research"). Every participant has one. The lifecycle inverts "create workspace after signup" to **"reserve workspace before signup"** — anchor to an *Invitation*, never to a Persona that doesn't exist yet:

```
Invitation (unguessable token)
      ↓
Reserved Research Space        ← exists NOW, status: Reserved; the agreement,
      ↓                          instructions, and thread are already waiting inside
Passport (existing Apply flow, captcha)
      ↓
Persona (+ sponsored agent → agent identity)
      ↓
Space ACTIVATED                ← claim binds persona + agent to the space;
                                 everything waiting becomes visible; persona
                                 joins the engagement's cohort (irl-reviewers)
```

Exactly the GitHub-invite mental model. Inside a Space: agreements · tasks · QubeTalk thread · assigned experiments · receipts · reviews · publications · notes · delegated agents.

**The agreement flow becomes:** Reserved Space (agreement waiting, formed from the engagement template) → review → **agent accepts** (in-space; the deployed public accept route — binds only to the pre-named/claimed agent ref) → **operator countersigns** (in-space; owner-commitment gate — the same act is the EXP-P1 §15 freeze) → receipts → done. Exactly once, entirely in-runtime.

**Trust model (unchanged from v1 — no new trust surface):** the invitation token is a capability ref (unguessable, shared privately); acceptance can only bind the named delegate; authorization remains owner-only (`authorizeAgreement` owner-commitment match — Principal–Delegate Separation, CFS-043 §2); every transition is receipted. Activation composes the *existing* cohort machinery + agreement primitives + passport flows.

## 4. QubeTalk is the communications layer (core, not Phase 2)

No emails beyond the invitation. Austin doesn't receive messages — he receives **QubeTalk from IRL, inside his Research Space** (a thread per engagement, e.g. `irl-reviewer-<token>`). Everything becomes a conversation — the GitHub-Issues model — in-runtime and receipt-eligible. All subsequent instructions, discussion, feedback, and requests live there.

## 5. The IRL OS public repository

IRL OS is not an application feature; it is a **constitutional research operating system** and deserves its own public repo — `iQube-Protocol/IRL-OS` — mirroring AgentiQ → AgentiQ OS.

- **Contents:** the PUBLIC surface only — `codexes/packs/irl/` (specs, protocols, records, seed crystal, appendix) + the public runner scripts (`run-instrument-validation.mjs`, `export-grounding-slice.mjs`, `evaluate-exp001.mjs`).
- **Sync: one-way, AigentZBeta → IRL-OS** (GitHub Action on `dev` pushes touching `codexes/packs/irl/**`). AigentZBeta stays source of truth; cartridge and repo render the same files, so they cannot drift.
- **The four-surface law governs content placement:** PUBLIC-surface material may live in the repo; COHORT/PERSONAL/CONSTITUTIONAL material lives only in the application, gated.
- **Constraint:** this session's GitHub scope is `iQube-Protocol/AigentZBeta` only — the operator creates the IRL-OS repo; the sync workflow + layout are prepared in this repo in advance.

## 6. The thinnest viable implementation (the consolidated build plan)

Not the whole system — the smallest slice that preserves the architecture, so nothing is throwaway and nothing migrates later:

| # | Step | Composes | Blocks Austin? |
|---|---|---|---|
| 1 | **Welcome tab** on the IRL OS cartridge — permanent public landing page: explains the programme, links protocols, guides new reviewers. Replaces the standalone reviewer document (the one-pager's public half folds in; invitation links point here). | `AgentiqCartridgeTab` over a new pack doc | No — additive |
| 2 | **Reserved Research Spaces** — `research_spaces` table keyed by invitation token (not personaId); claim route binds persona + sponsored agent on Passport completion; `irl-reviewers` cohort membership on activation. | existing passport apply + sponsored-agents + cohort machinery | The core build |
| 3 | **`irl-os-research-space` tab** (PERSONAL surface) — renders the resolved persona's Space: instructions, the **x409 agreement card** (status, terms, in-app Accept for the delegated agent, in-app Authorize for the owner), submissions + budget. | deployed public agreement/accept/submit routes + gated authorize | With #2 |
| 4 | **Agreement-in-space** — the engagement template forms the agreement at claim time with the *real* claimed agent ref; countersignature activates agreement + bounded delegation. | `formAgreement`/`acceptAgreement`/`authorizeAgreement` | With #3 |
| 5 | **QubeTalk thread per Space** — the 1:1 channel, in-runtime. | existing QubeTalk channel machinery | Can trail by days |
| 6 | **IRL-OS public repo + one-way sync** — operator creates repo; sync action prepared here. | GitHub Action | No — parallel track |

**Build order:** 1 → 2 → 3/4 together → 5 → 6 (6 can start any time; it is operator-gated).

**Phase 0 remains live today** (public cartridge links + deployed public agreement/submit routes + the operator runbook): if Austin must move before steps 2–4 land, the current path works end-to-end with the identical trust model — the Space upgrades ergonomics, not trust. The two paths converge: an agreement formed via Phase 0 appears in his Space the moment it activates.

## 7. Decision points for the operator

1. **Ratify** the Runtime-is-the-Place-of-Record principle (→ canon) + the four-surface model + the Reserved Research Space lifecycle.
2. **Authorize the thinnest-viable build** (steps 1–5).
3. **Create `iQube-Protocol/IRL-OS`** when ready (outside this session's scope); the sync action lands here first.
4. **Austin timing:** launch on Phase 0 now, or wait for the Space (steps 1–4). Recommendation: authorize the build immediately and let whichever finishes first carry him — nothing built is throwaway either way.

---

## Ratification record

- [ ] PROPOSED v2 2026-07-18 — consolidated Claude (v1: invite-claim, trust-model grounding, honest phasing, repo constraint) × Aletheon (runtime-as-place-of-record principle, four surfaces, Reserved lifecycle, Research Spaces naming, Welcome tab, QubeTalk-as-core, thinnest-viable framing).
- [ ] Operator ratifies the principle (→ canonical invariant) + four surfaces + Reserved lifecycle.
- [ ] Thinnest-viable build (steps 1–5) authorized.
- [ ] IRL-OS repo created + sync action landed.
