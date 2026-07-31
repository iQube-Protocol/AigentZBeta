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

## Immutability (Autodrive)

The machine-readable frameworks are published to Autodrive (Autonomys) for
content-addressed immutability. CIDs are recorded in the Amendment Records so
the on-chain copy can be verified against the in-repo source.
