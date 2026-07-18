# CFS-044 — The Open Lab: Reviewer Engagement, Private Slices, and the IRL OS Repo

**Chrysalis Foundation · Constitutional Charter · Status: PROPOSED (plan for ratification; Phase 0 is executable today)**
**Date:** 2026-07-18
**Operator direction:** "Everything either in the application or in the repo. All constitutional, within the runtime. No emails and notifications. Public + user-agnostic → the IRL OS cartridge and repo. User-specific → gated in the application. Give them a private space without requiring them to be signed up already. Don't turn this into a massive parallel operation — I need a framework whereby they can sign the contract in their slice of the IRL OS cartridge and we get on with it."

---

## 1. The two-surface law

Every piece of IRL content and interaction lives on exactly one of two surfaces:

| Surface | What lives there | Access |
|---|---|---|
| **PUBLIC** — the IRL OS cartridge + the IRL OS repo | The open corpus: CFS specs, experiment protocols, validation records, the invariant registry/field, published results, the one-pager, the runner scripts | Anonymous. No login, no persona. |
| **PRIVATE** — the Reviewer Desk (a persona-gated slice of the IRL OS cartridge) | Anything addressed to a specific participant: their agreement, their instructions, their engagement thread, their research workspace | Spine-gated: persona + cohort membership (+ delegated agents under them). |

Nothing travels by email. An "invitation to the open lab" is one link into the public surface; everything specific to a participant materialises in their private slice once they exist.

## 2. The chicken-and-egg, solved: the invite-claim pattern

The problem: Austin's agreement is specific to him, but he has no personaId and his agent has no agent id yet. The solution is a **claim code** (the pattern the platform already uses for capability-URLs):

1. **The Institute creates a Reviewer Engagement record** keyed by an unguessable `inviteCode`, carrying: display label, the agreement template (capability, bounded authority terms), the participant-facing instructions (markdown), and the doc links. **No persona fields — it is addressed to whoever claims the code.**
2. **The invitation is one public link**: the IRL OS cartridge with `?invite=<code>` — e.g. `…/triad/embed/codex/irl-os-cartridge?tab=irl-os-reviewer-desk&invite=<code>&theme=dark&density=wide`.
3. **Austin onboards through the existing flows** (nothing new): Passport Apply (captcha, anonymous-citizen) → sponsor his agent (existing bounded-delegation surface). Now a personaId and agent ref exist.
4. **Claiming binds identity to engagement**: with the invite code present and a persona resolved, the Reviewer Desk claims the engagement — the persona joins the **`irl-reviewers` cohort**, the engagement record binds `personaCommitment` + agent ref, and his private slice populates: instructions, the agreement card, the thread.
5. **Signing happens in the slice**: the agreement is formed from the engagement's template at claim time (his real agent ref as `selectedAgentRef`), his agent accepts (in-app button → the public accept route already deployed), you authorize (owner-gated, in-app button on your side of the same card). Receipted end-to-end; the countersignature = EXP-P1 §15 freeze.

One code, one link, zero emails, no pre-existing identity required — and the identity that claims it is the identity the contract binds.

## 3. The Reviewer Desk (the "My Canvas of IRL OS")

A new persona-gated tab in the IRL OS cartridge: **`irl-os-reviewer-desk`**. Renders, for the resolved persona's engagements:

- **Instructions panel** — the engagement's markdown (this replaces "send them a doc").
- **Agreement card** — live status (proposed → accepted → authorized), terms, TTL/budget; Accept button (delegated agent side), Authorize button (owner side only — the same owner-commitment gate).
- **Submission panel** — their submissions under the agreement + remaining budget (reads the same public endpoints).
- **Engagement thread** — Phase 2: a QubeTalk thread per engagement (`irl-reviewer-<code>`) for the 1:1 channel, in-runtime, receipted.

Generalises to every future reviewer/researcher: one engagement record each, same tab, same mechanics. This is the rollout capability, not a one-off for Austin.

## 4. The IRL OS repo (open-source split)

Mirror the AgentiQ OS pattern: a **separate public repo** (proposed name: `iQube-Protocol/IRL-OS`) that carries the open corpus — the contents of `codexes/packs/irl/` (specs, protocols, records, seed crystal, appendix) plus the public runner scripts (`run-instrument-validation.mjs`, `export-grounding-slice.mjs`, `evaluate-exp001.mjs`).

- **Sync direction: one-way, AigentZBeta → IRL-OS.** AigentZBeta stays the source of truth; a GitHub Action on pushes to `dev` touching `codexes/packs/irl/**` (or the named scripts) copies/subtree-pushes into IRL-OS. The cartridge and the repo can never drift because both render the same files.
- **Access rule = the two-surface law**: anything in the pack is by definition public and user-agnostic (this is already true — the pack ships in the open cartridge). Anything user-specific lives in the application, never in either repo.
- **Constraint**: this session's GitHub scope is `iQube-Protocol/AigentZBeta` only — the new repo must be created by the operator (or a session granted access); the sync workflow + content layout can be prepared in this repo in advance.

## 5. What ships when

| Phase | What | Status |
|---|---|---|
| **0 — out the door NOW (no build)** | Invitation = public cartridge links; contract via the already-deployed public agreement route; operator signs via runbook; docs readable at the cartridge + GitHub page links | **Live today** — this is the current Austin path; Phase 1 upgrades its ergonomics, not its trust model |
| **1 — the Desk (small build, the one that removes curl + email)** | `irl-reviewers` cohort + Reviewer Engagement record (table + claim route) + `irl-os-reviewer-desk` tab (instructions, agreement card with in-app Accept/Authorize, submissions) + invite-claim binding | The framework asked for; single tab + one small table + thin routes over existing agreement/cohort primitives |
| **2 — the channel + the split** | QubeTalk thread per engagement; `iQube-Protocol/IRL-OS` public repo + one-way sync action; CFS-043a guided onboarding surfaced inside the Desk | Follow-on |

**Phase discipline:** Phase 1 invents no new trust surface — the cohort gate is the existing cohort machinery, the agreement card calls the existing form/accept/authorize + public routes, the Desk is one more spine-gated tab. Extend, don't duplicate.

## 6. Decision points for the operator

1. Ratify the two-surface law + invite-claim pattern (this charter).
2. Approve Phase 1 build (the Desk) — or ship Austin on Phase 0 now and build the Desk in parallel for the next reviewer.
3. Create `iQube-Protocol/IRL-OS` (operator action — outside this session's repo scope) when ready for the open-source split.

---

## Ratification record

- [ ] PROPOSED 2026-07-18 (operator direction: everything in app or repo, constitutional, no email; private slices without pre-existing signup; reviewer cohort; IRL OS child repo; QubeTalk as the 1:1 framework).
- [ ] Operator ratifies the two-surface law + invite-claim pattern.
- [ ] Phase 1 (Reviewer Desk) build authorized.
- [ ] IRL-OS repo created + sync action landed (Phase 2).
