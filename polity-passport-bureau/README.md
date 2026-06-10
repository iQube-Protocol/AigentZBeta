# Polity Passport Bureau — Schema Bundle v0.1

Operator-authored JSON Schema bundle for the Polity Passport Bureau cartridge
(Citizen + Agent Participant passports). This directory is the canonical
in-repo home of the bundle; the Bureau's machine-readable surfaces
(`/polity-passport/*.schema.json`, doctrine bundle, OpenAPI, MCP) will serve
these files in later stages.

**PRD:** `codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-prd-v1.md`
**Implementation plan:** `codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-implementation-plan.md`

## Layout

```
polity-passport-bureau/
  schemas/      11 JSON Schemas + bundle manifest (draft 2020-12)
  examples/     example citizen + participant application objects
```

## Amendments applied to the operator's verbatim v0.1 draft (Stage 0 alignment)

The operator issued the base bundle plus three amendment sets in the PRD.
The files here are the **cumulative** result. Deviations from the verbatim
base draft, each traceable to an operator amendment:

1. **Self-Custody blakQube Passport Vault (PRD Addendum A)**
   - `common.schema.json`: added `selfCustodyBlakQubeRef` `$def` (verbatim from
     the addendum, with `third_party_key_custodian` as `["string","null"]` —
     draft 2020-12 has no `nullable` keyword). `blackQubeDisclosureMap` is
     retained for participant-class private review data, marked legacy.
   - `citizen-passport.application.schema.json`: `optional_private_details`
     uses `self_custody_blakqube_ref` (replacing `blackqube_disclosure_map`);
     `consents.self_custody_acknowledgements` added as a **required** block.
   - Manifest: `storage_policy` object added.
2. **Irrevocability correction (PRD Addendum D)**
   - `common.schema.json`: added `citizenPassportStatus` (no `revoked`) and
     `participantPassportStatus` (adds `delisted`) `$defs`. `passportStatus`
     became the documented superset union for shared surfaces
     (status-transition records).
   - `polity-passport.credential.schema.json`: `allOf` if/then enforces the
     per-class status enum by `passport_type`, and pins
     `revocation.revoked: false` for citizen-class credentials.
   - Manifest: two irrevocability design principles appended.
3. **Reputation addendum module (PRD Addendum C + schema addendum)**
   - Four new schema files: `reputation-binding`, `citizen-privilege-standing`,
     `participant-standing`, `reputation-infraction` (+ manifest entries).
   - `credential.schema.json`: `reputation_binding_ref` + `citizen_irrevocability`.
   - `registry-record.schema.json`: `reputation_binding_ref` + `standing_summary`;
     `private_payload_map` accepts `selfCustodyBlakQubeRef` or the legacy map.
4. **Examples** updated to validate against the amended citizen schema
   (self-custody ref + acknowledgements).

## Identifier-tier guardrails (CLAUDE.md PARAMOUNT — not schema-enforced yet)

`personaRef.persona_id`, `kybe_did`, and `root_did` appear in these schemas
as **server-internal** fields. T0 rule:

- The **public registry projection** and ALL **browser-bound JSON** must
  substitute `public_identifier` / commitment hashes (the `hashPersonaRef`
  pattern) — never raw `persona_id`, `kybe_did`, or `root_did`.
- `did_refs.kybe_did_public_ref` / `root_did_public_ref` on the registry
  record are defined as public commitment references, never raw DIDs.
- Chain-bound receipts carry T2 identifiers only.
- `$comment` markers sit on every affected object; enforcement lands in the
  Stage 1+ projection code and the canary test
  (`tests/passport-bureau.test.ts`, mirroring `tests/access-spine.test.ts`).

## Open items for schema v0.2 (operator decisions)

1. **`denied` / application-phase statuses**: Addendum D's per-class passport
   enums omit `denied`, but applications can be denied (review-decision +
   registry pending records). v0.1 keeps `denied` in the shared
   `passportStatus` union and in `review_state.decision`; v0.2 should split
   application-phase status from passport-phase status explicitly.
2. **`PassportQube` qube class**: the `qubeClass` enum introduces
   `PassportQube`. Adding it as a registry primitive type requires the
   registry vocabulary gate (registry PRD v1.1 §A.6); the standing
   recommendation is to carry `registry_record_type: 'polity_passport'` on
   existing primitives instead. Unresolved — blocks nothing in Stage 0.
3. **`persona_reference` in the registry record** requires `persona_id`
   (T0). v0.2 should make a public-safe persona reference shape
   (`public_identifier` + `persona_handle`) the registry-facing variant.
