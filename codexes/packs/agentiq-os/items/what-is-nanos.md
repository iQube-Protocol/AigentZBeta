# What Is nanOS?

nanOS is metaMe's **proprietary production distribution** of AgentiQ OS. It is the private, operator-facing intelligence layer that runs metaMe — managing the live production population of users, personas, developers, partners, investors, Aigents, cartridges, SmartWallets, delegations, journeys, and commercial workflows.

nanOS is not a low-level execution kernel. It is the **operating cartridge** that metaMe's operators and authorized Aigents use to govern the ecosystem after developers and users arrive via the AgentiQ OS open layer.

---

## The Relationship in One Sentence

> AgentiQ OS lets the world build. nanOS lets metaMe operate, govern, and grow.

---

## You Are Not Building for nanOS

This is important to understand: **AgentiQ OS is not a funnel into nanOS.** It is a sovereign, open-source framework for building agent systems — independently of metaMe, independently of nanOS, and independently of any proprietary stack.

As an AgentiQ OS developer, you can:

- Build your own **runtime** using iQube primitives, without ever touching the metaMe production runtime
- Build your own **studio** for composing agentic experiences without the metaMe Studio
- Run your own **registry** and governance model for your ecosystem
- Create fully independent **agent harnesses** — sets of Aigents, SkillQubes, WorkflowQubes, and ConnectorQubes that operate entirely outside the metaMe commercial framework
- Publish **open-source utilities** that others in the AgentiQ OS ecosystem can call, compose, and build on

AgentiQ OS defines the **protocol layer**: the shared primitives (iQube, Qripto, Aigent), the permission and disclosure model, the trust band taxonomy, the bounded delegation contract, the mission and receipt model. Everything above that layer is yours to design.

nanOS is metaMe's opinionated application of those primitives. Your application can be something completely different.

---

## AgentiQ OS vs nanOS — By Purpose

| Area | AgentiQ OS (open) | nanOS (metaMe proprietary) |
|------|-------------------|----------------------------|
| **Access** | Public / developer-facing | Private / authorized / operator-facing |
| **Purpose** | Build, submit, onboard, govern independently | Govern metaMe's live production ecosystem |
| **Audience** | All builders — independent or ecosystem | metaMe operators, Aigents, authorized partners |
| **Runtime** | Reference runtime patterns — build your own | Production metaMe Runtime management |
| **Studio** | Reference studio patterns — build your own | Production Studio with experience vibing for non-technical users |
| **Registry** | Open submission registry — anyone can publish | Curated, vetted, production-grade studio registry |
| **Aigents** | Reference Aigent (Aigent C-OS) | Production Aigent Z, C, Marketa, Kn0w1 |
| **Persona** | Developer persona creation | Full population identity and persona management |
| **Wallet** | SmartWallet onboarding stubs | Production wallet, delegation, Qc readiness |
| **Missions** | Developer onboarding missions | Population, campaign, partner, operator missions |
| **Intelligence** | Reference patterns | Proprietary NBE/NBA, Experience Matrix, CRM |
| **Boundary** | Open-source | Proprietary production distribution |

---

## Shared Primitives — Technical Interoperability

Both AgentiQ OS and nanOS operate on the same underlying iQube protocol primitives:

- Persona and Root DiD
- SmartWallet and bounded delegation
- Aigent cards and cartridge manifests
- ExperienceQube depth ladders
- Registry submissions and trust bands
- Mission boards and DVN-ready receipts
- iQube permissions and disclosure classes

This means assets built independently on AgentiQ OS are **technically interoperable** with nanOS and the metaMe production stack — not because developers are required to integrate, but because both systems speak the same protocol language. A SkillQube built by an independent developer uses the same interface contract as one built internally by metaMe. A WorkflowQube published to the open registry can, if it clears the production vetting bar, be called from within the metaMe Studio.

This interoperability is a property of the protocol, not of any commercial relationship.

---

## Why nanOS Has a Higher Trust Threshold — Experience Vibing

The metaMe Studio introduces a concept called **experience vibing**: non-technical users compose and deliver live, personalized, agent-powered experiences without writing any code. A creator, community manager, or business operator opens the Studio, selects from available SkillQubes, WorkflowQubes, ToolQubes, and Aigents, configures their intent in natural language, and publishes a live experience — without touching a terminal.

For experience vibing to work, **every utility callable from Studio must be production-grade, composable, and reliable without customization.** Studio users do not debug SkillQubes. They call them. If a service fails silently, requires configuration the user cannot provide, or behaves inconsistently across calls, the experience breaks — and the user cannot fix it.

metaMe therefore maintains a robust vetting process before any asset enters the Studio-accessible production registry. Assets that clear the bar must demonstrate:

- **Reliability under concurrent calls** — no race conditions, no hidden state, predictable outputs
- **Clean, documented interfaces** — input/output schema is explicit and correct
- **Correct iQube permission declarations** — forbidden actions declared, disclosure class set, no scope creep
- **Composability** — plays well with other iQubes; no hidden external dependencies
- **No customization required** — works out of the box for its declared purpose
- **Trust band integrity** — the asset does what it claims to do at the trust band it claims

This higher standard is why nanOS operates within **additional commercial and governance parameters** beyond what would be practical for the open-source stratum. The open AgentiQ OS registry welcomes L1_EXPERIMENTAL submissions from any developer. The metaMe production registry is a curated subset of those assets that have been validated to the standard experience vibing requires.

The path from open registry to metaMe production registry is the nanOS Bridge.

---

## What nanOS Adds (Beyond the Open Layer)

nanOS adds the production intelligence layer that AgentiQ OS deliberately does not include:

- **Population intelligence** — tracks users, personas, developers, partners, and investors across stages, segments, and cartridges
- **Production Aigent coordination** — Aigent Z, Aigent C, Marketa, and Kn0w1 operate under production bounded delegation envelopes with receipt requirements
- **Experience Matrix** — tracks development and commercialization maturity; generates next-best-action recommendations
- **CRM and relationships** — manages investor, partner, developer, and commercial relationships with staged engagement logic
- **Commercial rails** — Qc readiness, $KNYT eligibility, campaign attribution, partner revenue flows
- **Registry governance** — submission review, approval/rejection/escalation, Qube scoring, commercial eligibility and production vetting
- **Governance and policy** — production delegation policy, iQube access policy, Aigent permissions, DVN receipt audit trail
- **AgentiQ OS Bridge** — identifies which open-source developers are ready for production ecosystem onboarding

---

## The Operating Model

The canonical flow between both cartridges:

```
AgentiQ OS (open)
→ developer reads KB and builds developer persona
→ connects SmartWallet, grants bounded delegation
→ completes developer missions
→ builds and submits cartridge / Aigent / ToolQube to Registry
→ becomes a nanOS Bridge candidate (optional — not required)

nanOS (authorized access)
→ sees candidate via AgentiQ OS Bridge
→ reviews persona, wallet, delegation, Registry submissions, mission state
→ assigns Aigent Z / C / Marketa as appropriate
→ routes to Studio, Runtime, Registry, partner path, or commercial path
→ tracks next-best-action and DVN receipts
```

You are also free to skip the Bridge entirely. Your AgentiQ OS stack is complete and sovereign on its own.

---

## From a Developer's Perspective

As an AgentiQ OS developer, you have two valid paths:

**Independent path** — build and operate entirely within the open ecosystem. Publish to the open registry. Run your own runtime. Serve your own users. The iQube protocol gives you everything you need: identity, delegation, receipts, trust bands, experience depth, and composable asset types. No metaMe involvement required.

**Bridge path** — complete developer missions, achieve trust band progression, and become a nanOS Bridge candidate. If your assets meet the production vetting standard, they may be integrated into the metaMe production registry and become callable from the metaMe Studio. At that point, a metaMe Aigent may reach out via the AgentiQ OS Bridge.

Both paths are valid. Both use the same primitives. The difference is who governs and distributes the final experience.

---

## What Is Not Documented Here

nanOS internals — its Population Console, Aigent Z copilot, Runtime Ops, Studio Ops, CRM, Experience Matrix, and commercial rails — are proprietary to metaMe. Aigent C-OS will not speculate about nanOS internals.

If you are an authorized operator or partner seeking access to nanOS documentation, contact the metaMe team.
