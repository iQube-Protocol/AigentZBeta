# Passport Application Branching Invariants (canonical, not Horizen-specific)

**Operator ruling, 2026-07-31.** The Passport application wizard (`app/triad/components/codex/tabs/PassportBureauApplyTab.tsx`) treated a Citizen application and a Delegate/agent application as one fixed linear sequence. That is a genuine structural defect, not a labeling issue: a Polity Delegate Passport application was being routed through a human personhood-binding step it has no business touching. These invariants generalize the repair beyond the Horizen pilot — any future Passport-issuing surface built on this wizard must follow them.

## The defect, precisely

Before this fix, `PassportBureauApplyTab.tsx` ran every applicant — Citizen or Delegate/agent — through `Class → Account → Identity → (Agent | Private Vault) → Consents → Submit`. The class choice only affected which panel appeared at the fourth slot; it never changed whether the wizard visited Account or Identity at all. An agent application therefore always passed through the "Bind identity" (personhood-binding) step, in direct violation of Human Personhood Exclusivity below.

## Canonical Passport application model

```
Who is this Passport for?
  Polity Citizen Passport   = continuing constitutional personhood of a human principal
  Polity Delegate Passport  = revocable authority credential for a non-human agent,
                              derived from a Polity Citizen Passport
```

`Participant` remains the internal `PassportClass` identifier (and the DB/API `agent_participant` family) where renaming would break shipped code — see `services/passport/passportWizardSteps.ts`. It is no longer the public-facing name for the credential.

## Global invariants

1. **Personhood Before Identity** — a Polity Citizen Passport binds continuing personhood; identity and persona are secondary expressions of that personhood.
2. **Branch by Constitutional Subject** — human and non-human Passport applicants must not be forced through a common sequence where their constitutional requirements differ.
3. **Human Personhood Exclusivity** — only the human Citizen route may establish or bind personhood. An agent route must never manufacture or imply human personhood.
4. **Delegate Authority Derivation** — a Polity Delegate Passport must derive its authority from an eligible Polity Citizen Passport, and may be prepared before sponsorship approval, but not approved or activated before that authority source exists.
5. **Account–Personhood Separation** — account credentials prove access to an account. They do not prove personhood.
6. **Persona–Personhood Separation** — a persona name identifies how a person acts or appears within an application. It is not the constitutional personhood anchor.
7. **Evidence Autofill** — authoritative information already resolved from an Agent Card, AigentQube, Passport, or registry should populate downstream applications automatically rather than being re-entered by the participant. *(Not yet implemented — see Deferred below.)*
8. **Confirmation of Consequence** — autofilled facts may be accepted as evidence, but sponsorship, delegation, consent, and mandate decisions must still be explicitly confirmed by the principal.
9. **Continuity Without Premature Approval** — Citizen and agent applications may be completed in one continuous journey while preserving the rule that the Citizen authority source must be approved before the Delegate credential can be approved.
10. **One Journey, Conditional Steps** — wizard step numbers and progression must reflect the selected constitutional route. Hidden or inapplicable steps must not appear to have been completed or skipped mysteriously.

## What shipped in this pass

- **Branching step machine** — `services/passport/passportWizardSteps.ts` is now the single authoritative source for the routing rule, imported by the wizard component (no more inline duplicated branching logic across three handlers):
  - Citizen: `Class → Account → Personhood → Private Vault → Consents → Submit` (unchanged order, renamed).
  - Delegate/agent: `Class → Agent → Consents → Submit` — never visits Account or Identity, not even as a "skipped" ghost step. If the applicant is already signed in, Class goes straight to Agent; if not, it visits Account only long enough to establish access, then continues to Agent, never Identity.
- **Dynamic stepper** — the step-strip is derived from `wizardSteps(passportClass)` (4 boxes for Delegate, 6 for Citizen) rather than a fixed six-box line.
- **Canonical naming** — "Participant Passport" replaced with "Polity Delegate Passport" across the wizard, `PassportDoctrineTab.tsx`, `PassportClaimModal.tsx`, and `HomecomingTestTab.tsx`'s live badge/tooltip. "Identity"/"Bind identity" renamed to "Personhood"/"Bind personhood" with copy establishing the KybeDID as a personhood anchor, never an identity claim. "Username" renamed to "Persona name" with explanatory copy distinguishing account/persona access from personhood; the optional display-name field is now labeled "Display name — optional, defaults to your persona name" and actually defaults to the persona name (previously it silently defaulted to a hardcoded placeholder server-side).
- **Citizen-to-agent continuation** — after a successful Citizen submission, the wizard now offers "Do you also want to apply for a Polity Delegate Passport for an agent? / Continue with my agent / Not now," carrying the applicant straight into the Agent step without restarting the wizard.
- **Canaries** — `tests/passport-wizard-branching.test.ts` (14 tests) pin: Citizen advances to Account/Personhood correctly; Delegate advances directly to Agent; agent applications never reach the Identity step under any routing path; the Delegate/agent step sequence never contains `account` or `identity`; canonical terminology is present and "Participant Passport" no longer renders.

## Deliberately deferred (not implemented in this pass — flagged, not silently dropped)

- **Agent Card autofill.** Confirmed zero existing code anywhere in this codebase resolves a pasted Agent Card URL and populates downstream fields — this is genuinely new work (fetch, parse, source/confidence display per field), not a rename or a routing fix. Needs its own pass.
- **Live sponsor/approval-dependency display** ("Citizen Passport approval pending" / "Delegate approval blocked pending sponsor eligibility" badges on a submitted-but-not-yet-approved Delegate application). The existing `sponsor_passport_id`/`bound_passport_id` linkage on `agent_root_identity` is populated by the admin-driven Homecoming automation (`services/homecoming/issueDelegatePassport.ts`), not by any live UI signal the wizard reads today. Building an honest "submitted, pending sponsor eligibility" state requires new plumbing beyond this file.
- Historical governance decision-log entries (`GovernanceDecisionLogTab.tsx`, `GovernanceReceiptsTab.tsx` — e.g. GD-005) and the public `.well-known/polity-passport/route.ts` API description still say "Participant Passport." These were left untouched deliberately: the decision-log entries are dated, ratified historical records (renaming them would rewrite what was actually decided at the time, not just relabel current UI), and the `.well-known` route is a public, externally-consumed API contract description that shouldn't change without confirming nothing external depends on the literal string. Flagging both for an explicit operator call rather than silently deciding either way.
