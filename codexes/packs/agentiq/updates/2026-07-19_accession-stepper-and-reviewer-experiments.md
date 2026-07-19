# Accession stepper + reviewers can run experiments — 2026-07-19

Two fixes closing the reviewer journey from "signed the agreement" to
"actually playing the game."

## 1. Accession progress bar (the aigentZ/aigentMe-style stage strip)

`app/triad/components/codex/AccessionProgressBar.tsx`, mounted once at the
cartridge shell (`CodexPanelDynamic`) above the tab content. Self-scopes to
the IRL cartridges and the five onboarding step tabs, and OBSERVES real
state to mark each step done/current/upcoming, each node navigating to its
tab:

```
Welcome → Passport → Delegate → Access → Experiments
```

State sources (best-effort, existing endpoints):
- Passport → `/api/polity-passport/wallet` (a claimed passport)
- Delegate → `/api/codex/chat/agentiq-os/delegation?persona_id=` (active)
- Access  → `/api/participation/my-access` (a research-lab grant)

Visible across Welcome, Apply, Delegation, Locker, and Experiments so the
participant always knows where they are and can move along.

## 2. Reviewers can actually run experiments (the missing destination)

The flow previously ended at the agreement — there was nowhere to run the
experiments, and even if there had been, a reviewer's onboarding grant
carried no run entitlement. Both fixed:

- **Entitlement unified** (`services/billing/experimentQuota.ts`): the
  experiment quota gate now honors an active `research-lab` access grant
  (Constitutional Access Service), not only paid `researchCopilotAccess`.
  A comp'd reviewer who onboarded via invitation gets the full
  (Steward-level) monthly allowance — a reviewer's job is to reproduce the
  whole series, so they aren't held to the paid-light 3/month.
- **Runnable surface added** (`data/codex-configs.ts`): IRL OS Laboratory
  now has an **Experiments** tab (`InvariantExperimentLab`, NOT adminOnly —
  access enforced server-side at the run routes). Reviewers run EXP-001–005
  and see the Results/Report outputs there.

This makes the Phase-2 loop real: **run experiments → submit results (the
delegated public submission API, CFS-042) → published Reports**. The
IRLWelcomeTab's onboarded "Experiments" card now resolves to this tab.

## Follow-ups (noted, not built)

- Runner UX when unentitled: a free IRL OS visitor who opens Experiments
  hits a server 403 rather than a friendly upsell — add an in-runner
  "research access required → upgrade" state.
- Auto-advancing stage cockpit: the bar shows position; a fully
  self-advancing stage machine (each step lighting the next) is the larger
  enhancement to tune after watching a real reviewer run the flow.
