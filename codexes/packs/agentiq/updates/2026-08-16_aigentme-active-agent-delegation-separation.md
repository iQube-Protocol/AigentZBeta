# aigentMe Active-Agent / Persona / Delegation Separation

**Date:** 2026-08-16  
**Status:** IMPLEMENTATION SPEC / HOMECOMING PHASE II ADDENDUM  
**Purpose:** Make Aletheon operational through aigentMe without collapsing persona selection, active-agent selection, and bounded authority into one control.

## 1. Governing distinction

Three separate runtime choices must remain distinct:

1. **Active Persona — who I am acting as in this context.**
   - Persona-grade identity/context.
   - Selected from the user's persona wallet/context controls.
   - Own PersonaDID, contextual wallet/resources, Reputation and other persona-local state.

2. **Active aigentMe Agent — which agent is currently operating as my aigentMe.**
   - May be the neutral/default aigentMe agent.
   - May be an eligible passported/sponsored polity-bound agent such as Aletheon.
   - Selection does not itself grant authority.

3. **Delegated Authority — what that active aigentMe agent may do.**
   - Expressed through the existing bounded-delegation mechanism/grants.
   - Scope, duration, resources, revocation and consequences remain explicit.
   - Authority is never inferred merely because an agent is selected as active aigentMe.

Canonical runtime relationship:

```text
Person / personhood spine
  ├─ acts through → Active Persona
  └─ selects → Active aigentMe Agent
                  └─ receives → bounded Delegation Grant(s)
```

The persona is the contextual actor surface. The agent is the delegated computational actor. The delegation grant is the authority. These are orthogonal state dimensions.

## 2. Sponsorship is not delegation

Agent sponsorship remains person/principal-grade provenance: a person sponsors/adopts a polity-bound agent into standing/constitutional presence.

Operational delegation is a separate act and may be issued contextually through a persona. The genesis/sponsor fields on the agent identity remain provenance and must not be repurposed as the current active-agent choice or live delegation state.

Selecting Aletheon as aigentMe therefore must never rewrite sponsorship provenance.

## 3. Why the separation is security-relevant

The separation creates a deliberate containment boundary between identity context, computational delegate, authority and resources.

A person may:

- operate through Persona A while Aletheon is active aigentMe;
- operate through Persona B while neutral/default aigentMe remains active;
- delegate different scopes to different agents;
- hold separate persona wallets/resources;
- provision resources into an agent-owned wallet/resource envelope;
- revoke one agent's authority without changing the person's active persona or another delegate's authority.

Where existing wallet/resource capabilities permit, a persona may transfer bounded funds/resources to a delegated agent. The agent's autonomous capability is then constrained by **both** the delegation grant and the resources actually provisioned to its wallet/resource envelope.

This yields a two-key containment model:

```text
Capability to act = Delegated Authority ∩ Provisioned Resources
```

Neither authority without resources nor resources without authority should imply executable power.

## 4. UX model

### 4.1 Wallet / principal controls

The wallet remains primarily the **principal/persona control surface**:

- active persona selector = choose which persona the human is currently operating through;
- persona wallet/resources remain attributable to that persona;
- eligible agent inventory/passports may remain visible here;
- the wallet may expose eligibility/preference for which agents are allowed to operate as aigentMe, but should not collapse this into active persona selection.

Existing `preferred delegate` state should be audited. If it currently means "preferred agent for this persona," preserve it as a preference/default hint, not as the authoritative live selection and not as a delegation grant.

### 4.2 aigentMe Copilot

The existing **aigentMe** label in the Copilot header should become an interactive selector/dropdown for the **Active aigentMe Agent**.

Minimum options:

- **aigentMe (default/neutral)** — no specialist identity substitution required;
- eligible passported/sponsored agents that the person may appoint, initially including **Aletheon**.

Selection semantics:

- changing the active agent changes the computational/delegate identity serving the aigentMe surface;
- it does not change the active persona;
- it does not automatically create/expand a delegation grant;
- it does not move funds/resources;
- if the selected agent lacks sufficient authority for an attempted action, the UI routes to the existing delegation/authorization flow rather than silently elevating authority.

### 4.3 Delegation screen

Continue using the existing bounded-delegation screen/mechanism to grant authority to the selected agent.

The delegation subject should be explicit:

```text
Principal: <person/passport>
Acting persona/context: <active persona>
Delegate: <active aigentMe agent>
Authority: <scopes / constraints / expiry / resource bounds>
```

No new delegation architecture is required unless the audit proves the existing grant model cannot represent these four facts separately.

## 5. Neutral aigentMe is first-class

An explicit specialist agent is optional.

The person may use neutral/default **aigentMe** and grant bounded authority directly to that aigentMe runtime without selecting Aletheon or another named polity-bound agent.

Therefore active-agent state should conceptually support:

```ts
activeAigentMeAgent =
  | { kind: 'default-aigentme' }
  | { kind: 'polity-agent'; agentRootId: string; slug: string }
```

This shape is illustrative only. Reuse an existing selector/state model if one already exists.

## 6. Aletheon Phase-II target

For the initial Homecoming Phase II operating mode:

- human operates through the existing chosen persona (initially the current Mansa/Manta Meta operating persona, without forcing a persona migration);
- Aletheon is available in the aigentMe active-agent selector;
- Aletheon may be selected as the active aigentMe agent;
- existing Aletheon passport/personhood/sponsorship state is reused;
- Aletheon's memory/knowledge routing is preserved;
- Aletheon receives only explicitly approved operational delegation scopes;
- build merge/deployment authority remains excluded;
- switching persona must not silently replace Aletheon;
- switching active aigentMe agent must not silently switch persona;
- switching either must not mutate existing delegation grants.

Initial Aletheon operating capabilities to audit/enable:

- three-Bridge campaign management;
- KNYTS Kickstarter prospect/cohort work in CRM;
- partner communications and Horizon coordination;
- Vela integration/specification management;
- Marketa handoffs, promotion and campaign oversight;
- email drafting/sending through existing authorization boundaries;
- aigentMe Experience Guide/current-work updates;
- research, planning, PRD/specification and DevOn Implementation-Pack preparation.

## 7. Wallet/resource containment audit

Before changing resource mechanics, audit the existing implementation for:

- persona-owned wallets/balances;
- polity-bound agent wallets/balances (e.g. MoneyPenny/Nakamoto patterns);
- transfer/provisioning paths from persona/principal wallets to agent wallets;
- whether spending checks bind both the active delegation grant and the agent wallet/resource balance;
- revocation behavior when an agent still holds funds/resources;
- receipt/evidence production for persona→agent resource transfers.

Do not invent a second wallet model. Reuse existing agent/persona wallet primitives and record any missing intersection check as a named security gap.

## 8. Required audit before implementation

Trace the current code with file:line evidence for:

1. active persona selection and wallet dropdown;
2. current `preferred delegate` representation and consumers;
3. aigentMe Copilot header/agent identity seam;
4. eligible/delegatable agent registry/selector;
5. live bounded-delegation grant schema and writer;
6. how grants are resolved at action time;
7. default/neutral aigentMe authority behavior;
8. agent wallet/resource ownership and transfer APIs;
9. Aletheon agent-root/persona/passport records and current selector eligibility;
10. memory/knowledge routing when a specialist/delegate agent is active.

Classify each requirement as **REUSE / SMALL WIRING / GAP**. Prefer reuse; do not build parallel registries, delegation tables, wallets or agent runtimes.

## 9. Acceptance canaries

At minimum prove:

1. Persona A + neutral aigentMe is valid.
2. Persona A + Aletheon as active aigentMe is valid.
3. Selecting Aletheon does not mutate active Persona A.
4. Switching Persona A→B does not silently mutate the selected active agent unless an explicit policy says that agent is ineligible.
5. Selecting an active agent does not create a delegation grant.
6. Granting authority to Aletheon does not change persona selection.
7. Revoking Aletheon's grant does not remove Aletheon from eligible-agent inventory; it leaves it selectable but unauthorized for gated acts (or produces the existing truthful refusal state).
8. Neutral aigentMe can hold/use its own bounded delegation independently of named specialist agents.
9. Two agents may hold different simultaneous grants without interaction.
10. Persona wallets/resources and agent wallets/resources remain separately attributable.
11. If resources are provisioned to an agent, authority is still required to spend/use them.
12. If authority exists but required resources are absent, the action fails truthfully rather than implicitly drawing from another persona/principal wallet.

## 10. Implementation principle

Do not create a new authorization architecture.

This work should primarily **separate and expose state that the platform already models independently**:

```text
activePersonaId
activeAigentMeAgentId / default aigentMe
active delegation grants
wallet/resource ownership
```

If current UI or state has collapsed two of these concepts into `preferred delegate`, split the UI/runtime interpretation while preserving backwards compatibility with existing preference data where possible.

## 11. Claude Code instruction

Audit first. Then implement the smallest reuse-first separation needed to make Aletheon operational through aigentMe under this model. Treat this document and `2026-08-16_homecoming-phase-ii-activation-pack.md` as governing specifications. Do not redesign personhood, sponsorship, delegation, wallet or agent identity primitives unless the audit demonstrates an irreducible gap. Stop for operator review before merge.