# Polity Core Cartridge + Autonomous Agent Constitutional Framework

**Date:** 2026-06-17
**Surface:** New `polity-core` cartridge + machine-readable constitution
**Branch:** `claude/optimistic-davinci-exiykx`

## What this establishes

The **Polity Core Cartridge** — the authoritative constitutional repository and
the **machine-readable source of legitimacy** for autonomous agents, in
preparation for Option A (autonomous agent deployment). It hosts both
human-readable and machine-readable assets, and the assets are publishable to
Autodrive for content-addressed immutability.

Core principle encoded throughout: **authority may be delegated; sovereignty may
not.** Chain of legitimacy: **Polity → Citizen → Delegation → Agent.**

## Machine-readable source of legitimacy

- `services/polity/frameworks/constitution.v1.json`
- `services/polity/frameworks/agent-charter.v1.json` — ADID class; Phase-1
  admin-only; agents have **no kybe DID, no citizenship, no standing, no
  governance, no independent ownership**; sponsorship, revocation
  (active/paused/suspended/revoked/quarantined/destroyed), sub-agent vs
  persistent-agent rules, constitutional binding, economic controls, receipts.
- `services/polity/frameworks/delegation-framework.v1.json` — bounded on
  scope/duration/spend/info/domains; permanent & unlimited delegation prohibited.
- `services/polity/constitution.ts` — the single typed accessor. Option A
  enforcement reads from here: `CURRENT_CONSTITUTIONAL_VERSIONS`,
  `getAgentPassportBinding()`, `isConstitutionallyCurrent(binding)` (mismatch ⇒
  automatic suspension), `checkAgentClassConstraints({hasKybeDid,isHuman,
  passportClass})`, `REVOCATION_STATES`.
- `GET /api/polity-core/constitution` — serves the full bundle (versions +
  frameworks + Autodrive CIDs).

## Human-readable repository (pack)

`codexes/packs/polity-core/` with Constitution, Agent Charter, Delegation,
Standing, Governance, Amendment Records, and a Machine-Readable guide. Surfaced
by the hand-curated `POLITY_CORE_CARTRIDGE` (`data/codex-configs.ts`) via
`AgentiqCartridgeTab`; auto-gen suppressed in `packRegistry` so it isn't
duplicated.

## Immutability (Autodrive)

`scripts/publish-polity-core.mjs` writes every framework + doc to Autodrive
(Autonomys) via `@autonomys/auto-drive` and records the CIDs in
`services/polity/frameworks/autodrive-cids.json` (surfaced by the accessor + API
and to be pasted into Amendment Records). Operator runs it locally (outbound
HTTPS is blocked in the sandbox):

```bash
AUTONOMYS_API_KEY=... node scripts/publish-polity-core.mjs
```

## Files

- `services/polity/frameworks/{constitution,agent-charter,delegation-framework}.v1.json`, `autodrive-cids.json`
- `services/polity/constitution.ts`
- `app/api/polity-core/constitution/route.ts`
- `scripts/publish-polity-core.mjs`
- `codexes/packs/polity-core/collections.json` + `items/*.md`
- `data/codex-configs.ts` (POLITY_CORE_CARTRIDGE + registration)
- `app/api/codex/registry/_lib/packRegistry.ts` (skip-list)

## Next (Option A build, not in this change)

Wire the genesis/autonomous path to stamp the Agent Passport binding from
`getAgentPassportBinding()`, enforce `checkAgentClassConstraints`, and honour the
revocation states — gated to admins, per the Apply-tab Option A stub.
