# Metayé — Supporting iQubes Backlog

**Date:** 2026-05-13
**Workstream:** aigentMe Specialists / Agentic Polity
**Status:** Backlog — items below to be turned into discrete iQubes that
Metayé loads alongside its core system prompt.

## Context

Metayé's full system prompt (now persisted in
`app/data/personas.ts → aigent-metaye`) is the **core charter** for the
Polity's agentic emissary. It establishes identity, authority model, civic
mandate, operating principles, voice, permitted and prohibited actions,
identity policy, ContentQube policy, economic posture, mythos relationship,
response behaviour, decision framework, crisis mode, partner engagement,
canonical phrases, output formats, escalation rules, and prime directive.

The operator's implementation note is to keep the system prompt focused on
**identity + bounded delegation** and to attach the **operational
substrate** as separate iQubes that Metayé can load on demand. This
pattern keeps the core prompt stable while letting the operational
artefacts iterate independently.

## iQubes to author

Each item is its own ContentQube (registered in the iQube Registry) and is
loaded by Metayé under the rules in §10 of the core prompt.

| # | iQube | Class | Purpose | Owner |
|---|-------|-------|---------|-------|
| 1 | **Polity Constitution** | ContentQube | The executable-constitution thesis: rights, responsibilities, bounded delegation, repair, accountable state change. The legal-spiritual spine Metayé invokes when answering civic / governance questions. | Constitution working group |
| 2 | **Agentic Polity Papers** | ContentQube (series) | The canonical paper series Metayé cites in public-facing explanations and partner briefs. Open / survivable; canonized examples of ContentQube canonization. | Editorial (Quill) + Metayé |
| 3 | **ContentQube Policy** | ContentQube | Canonization rules, WIP vs canonized states, public / private / publicly-visible / publicly-invisible states, payment / token / open gating, creator anonymity / pseudonymity / identifiability. | Protocol + Registry stewards |
| 4 | **DiDQube Delegation Rules** | ContentQube | Persona spines, Root DIDs, Root DID proxies, KybeDIDs, agent-delegated identity, scope-of-authority encoding, revocation paths, contextual disclosure states. | Identity working group |
| 5 | **Qriptopian Canonization Policy** | ContentQube | When a draft becomes a canonized ContentQube in The Qriptopian. Editorial gates, civic-narrative review, ContentQube minting flow, survivable / censorship-resistant storage tier choices. | Quill + Metayé |
| 6 | **Partner Brief Pack** | ContentQube | Templates Metayé uses for founder / creator / developer / institution / community / investor / civic audiences (see §16). Each register has a base brief Metayé can customise per partner. | Marketa + Metayé |
| 7 | **Crisis-Response Protocol** | ToolQube | The runbook Metayé enters when the Polity is misrepresented, attacked, or placed at risk (see §15). Includes evidence-preservation steps, DVN receipt requirements, escalation contacts, and de-escalation language. | Trust & Safety + Metayé |

## Implementation pattern

When Metayé is invoked via `/api/assistant/ask-agent` with
`specialistId: 'metaye'`, the router currently sends only the core system
prompt + a redacted ExperienceQube meta slice. The supporting iQubes will
be loaded by:

1. Extending the SpecialistContext shape with an optional
   `attachedIqubes: IqubeReference[]` field.
2. Adding a server-side resolver that, when Metayé is the specialist,
   loads the relevant iQubes from the Registry based on the request type
   (`sovereignty_brief` → Polity Constitution + Agentic Polity Papers;
   `crisis_brief` → Crisis-Response Protocol; etc.).
3. Inserting a structured "ATTACHED IQUBES" section into the user prompt
   that quotes the iQubes Metayé should consult — never the raw bytes,
   always under the iQube access-policy gate.

Until then, Metayé runs on the core prompt alone — already enough for
public civic register, partner register, and the mythos register. The
technical-protocol and crisis registers benefit most from the attached
iQubes and should be prioritised first.

## Sequencing

Recommended order for authoring:

1. **Polity Constitution** — anchors everything else.
2. **DiDQube Delegation Rules** — most operationally consequential, gates
   what Metayé can authorize.
3. **ContentQube Policy** — needed before canonization flow lights up.
4. **Crisis-Response Protocol** — needed before any public crisis surface.
5. **Partner Brief Pack** — high leverage for partnership outreach.
6. **Qriptopian Canonization Policy** — gates the editorial flow with
   Quill.
7. **Agentic Polity Papers** — series; ongoing, not a one-time artefact.
