# Machine-Readable Source of Legitimacy

The Polity Core Cartridge is both human- and machine-readable. The machine
layer is what autonomous agents and platform services actually bind to.

## Endpoint

```
GET /api/polity-core/constitution
```

Returns the current ratified bundle:

```json
{
  "ok": true,
  "currentVersions": {
    "constitutionVersion": "1.0.0",
    "agentCharterVersion": "1.0.0",
    "delegationFrameworkVersion": "1.0.0"
  },
  "constitution": { "...": "..." },
  "agentCharter": { "...": "..." },
  "delegationFramework": { "...": "..." }
}
```

## Source files

| Framework | Machine-readable source |
|---|---|
| Polity Constitution | `services/polity/frameworks/constitution.v1.json` |
| Autonomous Agent Charter | `services/polity/frameworks/agent-charter.v1.json` |
| Delegation Framework | `services/polity/frameworks/delegation-framework.v1.json` |

The typed accessor `services/polity/constitution.ts` is the single import
surface for code. Option A enforcement uses it to:

- read `CURRENT_CONSTITUTIONAL_VERSIONS` to stamp an Agent Passport's binding,
- check `isConstitutionallyCurrent(binding)` (mismatch ⇒ automatic suspension),
- enforce `checkAgentClassConstraints({ hasKybeDid, isHuman, passportClass })`
  (no kybe DID, never human, never a citizen passport),
- reference `REVOCATION_STATES` (active · paused · suspended · revoked ·
  quarantined · destroyed).

## Constitutional Internet for Agents package

The agent-facing companion edition is available under:

`codexes/packs/polity-core/items/commentary/constitutional-internet/agent-edition/`

Machine-readable artifacts:

| Artifact | Source |
|---|---|
| Agent constitutional orientation | `constitutional-internet-for-agents.v0.1.json` |
| Agent accession compact | `agent-accession-compact.v0.1.json` |
| Agent accession intent schema | `agent-accession-intent.schema.v0.1.json` |

Human-readable controlling source for this draft:

`01-ci-agent-edition-manuscript-v0.1.md`

These objects are **constitutional commentary and orientation**, not new sources of authority. They do not confer personhood, self-authorization, sponsorship, mandate, or accession. Consequential authority still requires the ratified constitutional bundle, a valid principal and mandate, and the required state transitions and receipts.

## Immutability (Autodrive)

The machine-readable frameworks are published to Autodrive (Autonomys) for
content-addressed immutability. CIDs are recorded in the Amendment Records so
the on-chain copy can be verified against the in-repo source.
