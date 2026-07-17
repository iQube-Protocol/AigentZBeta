# Commit Brief: `70d3af5` — Make Research Copilot a first-class aigentMe roster specialist

| Field | Value |
|-------|-------|
| SHA | [`70d3af5`](https://github.com/iQube-Protocol/AigentZBeta/commit/70d3af55abe3ce7804655c51357985407c2ec7d2) |
| Author | Claude |
| Date | 2026-07-16T04:18:42Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Make Research Copilot a first-class aigentMe roster specialist

Operator-confirmed parity with the developer copilot: the Research Copilot
is now a specialist aigentMe can recommend and hand off to, gated by the
same researcher activation (Sovereignty tier — same price/stage as DevOn).

- personas: new aigent-researcher persona — a constitutional research
  environment (invariant corpus, hypotheses, protocols, receipts, standing),
  narrate/propose-never-ratify (C2.1), ground-and-cite, no fabrication
- specialistRouter: researcher SpecialistId + research_brief request type +
  persona-key + label + inferRequestType + template branch
- specialistRecommender: researcher label/description/activation-gate +
  irl cartridge->researcher primary mapping
- ask-agent route: researcher in VALID_SPECIALISTS + aliases
- bootstrap route: researcher in AVAILABLE_SPECIALISTS roster
- SpecialistsLayout: researcher quick-prompt templates
- wizard: pathway relabelled "Research & Discovery" (inclusive of analysts/
  founders/students) per the epistemic-value framing
- updates doc: record epistemic-value pathway framing + the seven-level
  research ladder as roadmap (not built); confirm same-tier purchase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator-confirmed parity with the developer copilot: the Research Copilot
is now a specialist aigentMe can recommend and hand off to, gated by the
same researcher activation (Sovereignty tier — same price/stage as DevOn).

- personas: new aigent-researcher persona — a constitutional research
  environment (invariant corpus, hypotheses, protocols, receipts, standing),
  narrate/propose-never-ratify (C2.1), ground-and-cite, no fabrication
- specialistRouter: researcher SpecialistId + research_brief request type +
  persona-key + label + inferRequestType + template branch
- specialistRecommender: researcher label/description/activation-gate +
  irl cartridge->researcher primary mapping
- ask-agent route: researcher in VALID_SPECIALISTS + aliases
- bootstrap route: researcher in AVAILABLE_SPECIALISTS roster
- SpecialistsLayout: researcher quick-prompt templates
- wizard: pathway relabelled "Research & Discovery" (inclusive of analysts/
  founders/students) per the epistemic-value framing
- updates doc: record epistemic-value pathway framing + the seven-level
  research ladder as roadmap (not built); confirm same-tier purchase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `app/api/assistant/bootstrap/route.ts` |
| Modified | `app/data/personas.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-07-16_researcher-pathway-fo-subscription-integration.md` |
| Modified | `components/metame/setup/ExperienceModelSetupWizard.tsx` |
| Modified | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |
| Modified | `services/agents/specialistRouter.ts` |
| Modified | `services/orchestration/specialistRecommender.ts` |

## Stats

 8 files changed, 176 insertions(+), 18 deletions(-)
