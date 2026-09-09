# Persona-scoped iQube projection through Threshold MCP

Status: implementation slice — 2026-09-09

## Decision

MCP, Companion, native Runtime and cartridge UI are projection surfaces, not
access authorities. The resource boundary is the iQube. The current Threshold
implementation binds one crossing to one active persona through its persisted
T2 public reference and evaluates that persona's rights for every iQube.

The connected agent additionally needs `iqube.read` in both the scoped bearer
and the live Constitutional Agreement. That capability only permits the agent
to request a canonical access decision; it is not an entitlement and cannot
turn a denied resource into an allowed one.

## Reused authorities

- Persona context: `services/identity/getActivePersona.ts`
- T2-to-T0 lookup: `resolvePersonaIdByPublicRef`
- Agent delegation: the exact Threshold Constitutional Agreement
- Global iQube identity/metadata: `services/registry/resolver.ts`
- Resource decision: `services/access/evaluateAccess.ts`
- Ownership: `services/rewards/assetOwnership.ts`
- DiDQube: constitutional identity continuity, not a shortcut that unions
  persona entitlements
- Smart Triad: presentation of the authorized result, never authorization
- DCIR: T2-safe observation/receipts, never an access gate

## Implemented

- `list_accessible_iqubes`
- `get_accessible_iqube`
- `read_accessible_iqube_text`
- Live agreement revalidation on every call
- Exact persona-owner and selected-agent binding checks
- ContentQube edition ownership recognized by the canonical ownership resolver
- Registry `caller_can_read` upgraded from the Stage-2 approximation to
  `evaluateAccess`
- Missing and unauthorized single-iQube reads are intentionally indistinguishable

## Explicit boundary

This slice projects every primitive already represented by the canonical iQube
Registry. Existing public-knowledge tools continue to cover explicitly
allowlisted public Qriptopian, IRL OS, AgentiQ OS and Polity Core documents.
Native systems whose assets are not yet registered as iQubes still need source
adapters/backfill before they can appear in the global iQube catalogue. A text
payload is returned only where the native ContentQube already stores an
`extracted_text` rendition; binary/decrypted and other-native-system rendition
providers remain separate follow-on work and must reuse their canonical secure
delivery paths.

## Backlog — Root DID aggregation

Do not silently combine sibling personas today, even when they share one auth
profile, Root DID or DiDQube. A future Root-DID/DiDQube aggregation mode may be
introduced only as an explicit, human-authorized scope with provenance showing
which persona supplied each entitlement and which persona context was active
for the delegated read. KybeDID/personhood remains an exceptional proof and
standing anchor; it is not the default content-access key.

## Acceptance fixtures

The development estate contains two active personas under the same auth
profile—ArkAgent and Aigent Z—with different ContentQube edition sets. The
regression suite models that exact topology: shared human ownership must not
cause either persona to inherit the other's iQubes.
