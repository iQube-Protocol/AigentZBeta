# CFS-024 — Constitutional Identity Hierarchy & the Constitutional Context primitive

**Chrysalis Foundation Specification · v1 · Status: Ratified 2026-07-10 (operator direction; discovery by Aletheon)**
Substrate: `types/constitutionalContext.ts` · resolver `services/identity/constitutionalContext.ts` · canary `tests/constitutional-context.test.ts`
Companion to: the Identity & Access Spine (CLAUDE.md) · `CFS-023` (Chrysalis Homecoming)

> The surfaces disagreed not because of a bug but because a **primitive was missing** — the distinction between the constitutional **Person**, their **Personas**, and **Agent Authority**. This spec names it.

---

## The discovery

While debugging why the Wallet, the Delegation Bureau, and the persona dropdown showed *different* delegation/aigentMe state, the real cause surfaced: the system assumed `Persona → Agent` (an agent is owned by a persona), which makes "which persona owns this agent?" ambiguous when a citizen has many personas and one agent (e.g. Metayé is aigentMe for one persona but merely available to another).

The correct model is **Citizen → Bound Agents → Persona → Active Assignment → Current aigentMe**. Delegation does not sit at the citizen or the passport. **It sits at the persona.**

## The hierarchy

```
Citizen (Human)   — who HAS authority
  ↓ Passport      — the personhood credential
  ↓ Personhood    — the fact the passport establishes
  ↓ Person        — ONE: continuity, standing, sovereignty, authority
  ↓ Personas      — MANY: constitutional operating contexts (projections of the person)
  ↓ Delegated Agents — assigned to a persona; BOUND to the person
  ↓ Sessions
  ↓ Tasks
```

(Pinned as `CONSTITUTIONAL_IDENTITY_HIERARCHY`; delegation level pinned as `DELEGATION_LEVEL = 'persona'`.)

- **The Passport establishes Personhood, not a persona.** It makes the constitutional *person* — there is only one, with continuity, standing, sovereignty, and authority.
- **Personas are constitutional projections** — Mansa Meta, Metayé, Kn0w1, ArkAgent are not different citizens; they are different *operating contexts* of the same person.
- **Agents are bound to the Person, not the Persona.** Alethean belongs to *you* — not to Mansa Meta, not to Metayé. Likewise Marketa, MoneyPenny, Kn0w1, Nakamoto.
- **Delegation occurs through Personas.** The citizen says *"I authorise Alethean"* (binding). Then a persona says *"while operating as Mansa Meta, Alethean acts as my aigentMe"* (assignment). The same agent can hold different constitutional roles depending on the persona through which authority is exercised.

## The two constitutional relationships

| Relationship | Endpoints | Permanence | Answers |
|---|---|---|---|
| **Binding** | Citizen ↔ Agent | **Permanent** | Which constitutional delegates belong to the person? |
| **Assignment** | Persona ↔ Agent | **Temporary** | Which delegate is acting in this capacity right now? |

(Pinned as `AGENT_RELATIONSHIPS` + `RELATIONSHIP_PERMANENCE`. `BoundAgent.relationship = 'binding'`; `PersonaAssignment.relationship = 'assignment'`.)

Bindings rarely change (Dele ↔ Alethean, forever). Assignments change freely (Mansa Meta → Alethean today; Metayé → Metayé tomorrow; or None). **Agent isn't inside Persona; the Assignment is.**

This dissolves the bug. The question is no longer *"which persona owns this agent?"* but *"which agent is currently assigned to this persona?"* — and every surface answers it from one place.

## The three constitutional invariants

Proposed under Law XI (the operator ratifies); pinned as `CONSTITUTIONAL_IDENTITY_INVARIANTS`:

1. **Constitutional Agent Binding** — Agents SHALL be permanently bound to constitutional persons through their Passport and Personhood.
2. **Constitutional Agent Assignment** — Agents SHALL be assigned to personas through bounded delegation.
3. **Constitutional Authority** — Constitutional authority originates from the citizen, is established by the Passport, accrues through Standing, and is exercised through Personas.

## The Constitutional Context primitive — the single source of truth

Rather than every surface independently resolving "active persona", "active aigentMe", "active delegation", or "effective persona", each surface asks **one resolver**:

```ts
const context = await resolveConstitutionalContext(sessionId);
```

and receives (`ConstitutionalContext`):

```ts
{
  citizen,        // WHO has authority
  passport,       // WHO is the constitutional person
  standing,       // WHAT authority they have earned
  persona,        // IN WHAT capacity they are acting
  boundAgents,    // WHICH delegates belong to them (permanent)
  assignedAgent,  // WHICH delegate is acting in this capacity (temporary)
  currentAigentMe,
  workspace,
  session,
}
```

From that point the Wallet, Delegation Bureau, Founder Office, Studio, Registry, and Aigent Z all render from the **same** constitutional state. The resolver **composes the existing identity spine** (`getActivePersona` et al.) — it never forks it (the spine remains the canonical contract per CLAUDE.md).

## Separation of concerns (the model completed)

| Layer | Answers |
|---|---|
| Citizen | Who has authority? |
| Passport | Who is the constitutional person? |
| Standing | What authority have they earned? |
| Agent Binding | Which constitutional delegates belong to them? |
| Persona | In what capacity are they acting? |
| Agent Assignment | Which delegate is acting in that capacity? |
| Session | What are they doing right now? |

---

## Ratification record

- [x] Ratified 2026-07-10 (operator direction; Aletheon discovery)
- [x] Phase 0 — the contract (`types/constitutionalContext.ts`: hierarchy, relationships, invariants, `ConstitutionalContext`, resolver contract) + canary
- [x] Phase 1 — the resolver: `services/identity/constitutionalContext.ts` `resolveConstitutionalContext(req)` composes the spine (`getActivePersona`) + the durable stores (`delegation_grants`, `agent_root_identity`, `polity_passport_records`), returning one context. **`boundAgents` are gathered across EVERY persona the caller owns** (the person's roster) — the load-bearing correction that makes a delegate sponsored under one persona visible when another is active. Client seam: `GET /api/identity/constitutional-context` (T1 projection strips T0 persona/auth ids). Pure mappers canary-covered.
- [ ] Phase 2 — surface adoption: migrate the Wallet, Delegation Bureau, persona dropdown (and the rest) to render from `/api/identity/constitutional-context` — the consolidation that closes the observed inconsistency. **This is a live-surface rewire; do it incrementally with operator verification.**
- [ ] Phase 3 — persist `PersonaAssignment[]` as first-class rows (assignment ≠ the grant; a persona's aigentMe choice is an assignment, delegation is its authority). Until then Phase 1 DERIVES the assignment from the active `delegation_grant` + the persona's `is_aigent_me` designation.

## Honest limits

- **Phases 0–1 ship the contract, the ratified model, AND the resolver — but NOT the consolidation.** The observed Wallet↔Bureau↔dropdown disagreement is resolved only once those surfaces adopt `/api/identity/constitutional-context` (Phase 2). Until then they still each resolve their own "active persona", so the inconsistency the operator sees persists on the live surfaces even though the correct single-source-of-truth now exists and is callable.
- **Phase 1 leaves `standing` null.** The Bureau composes standing lanes via its own CRM join today; threading it through the resolver is Phase 2 work rather than duplicating the join now.
- **`PersonaAssignment` is not yet a persisted table.** Today an "assignment" is inferred from `is_aigent_me` (binding-time flag) + the active `delegation_grant` (authority). Making assignment a first-class, per-persona record (so the same agent can be aigentMe for persona A and not for B) is Phase 3.
- **The three invariants are proposed, not canonical** — the operator ratifies them into the substrate.
