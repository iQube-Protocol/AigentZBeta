# VELA-001: Signer/Privacy/Attestation Topology Findings + Consequence Ontology Collision

**Date:** 2026-08-22
**Workstream:** VELA-001 — MoneyPenny × Vela: Confidential Constitutional Execution

## What happened this session

Per the operator's staged execution order for VELA-001 ("read the starter-kit docs, run the official local environment unchanged, run the official sample WASM app, record exact upstream SHAs, inspect CLAUDE.md in the Vela repos, map the actual Vela request/encryption/attestation lifecycle — only then produce the topology/boundary artifacts and move into code"):

1. Read all four `vela-starterkit` docs in the recommended order (architecture summary, private-transfer app guide, TypeScript client guide, trigger-contract app guide).
2. Cloned `HorizenOfficial/vela`, `vela-common-ts`, `vela-common-go` and checked out their exact `v0.2.0` tags (all three carry an exact `v0.2.0` tag matching the starter kit's pin):
   - `vela` @ `335724c95ba7b58d64ec97bbb67d18640123278e`
   - `vela-common-ts` @ `c9d28e4107d08ed4a570449a577ac07089891344`
   - `vela-common-go` @ `fb4e716f197a4d761350f5d93a97708b5d972bee`
3. Read each repo's `CLAUDE.md` and the relevant crypto/attestation source (`pkg/crypto/{key_p521,key_secp256k1,cipher}.go`, `contracts/contracts/{TeeAuthenticator,AbstractTeeAuthenticator,mocks/NoAttestationTeeAuthenticator}.sol`, `vela-common-ts/src/crypto/{p521,wallet,seed}.ts`) to verify the starter-kit docs against actual source, per the starter kit's own `CLAUDE.md` instruction.
4. Produced three source-verified findings artifacts:
   - `docs/vela/VELA-SIGNER-TOPOLOGY-001.md` — the six distinct key roles in a Vela deployment (TEE SigningKey, TEE CommunicationKey, Manager tx-signer, Deployer role, Authenticator-contract admin, end-user wallet+derived-P521 key, plus the authority/auditor key), who holds each, and the conclusion that a MoneyPenny integration needs **zero new custody surface** — it participates purely as an ordinary end-user via its existing AgentKeyService wallet key.
   - `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` — field-by-field confidentiality map: what's genuinely encrypted end-to-end (state, payloads, per-user events, deanonymization reports) vs. what's plain on-chain metadata regardless of app design (deposit/withdrawal amounts, sender, applicationId/requestId, the `TRUSTPROCESS`/trigger wire path which is plaintext by design), plus the three states of the `EventSubType` privacy topic and the concrete implication for how a "Confidential Consequence Projector" must emit its verdict (as a `PlainEvent`, not an `AppEvent`) to avoid leaking the one thing that matters.
   - `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md` — the two `TeeAuthenticator` contract variants (real Nitro-attested vs. `NoAttestationTeeAuthenticator`) share an identical downstream verification path, so the attestation boundary is invisible from application-layer behavior; explicit statement that Slice 2A's successful local run exercised **zero** attestation guarantee (`TEE_NO_ATTESTATION=true`, emulated TEE per the starter kit's own stated limitation) and proved only the protocol/wire-format/crypto-interop lifecycle.
5. Before drafting the PRD's proposed `CONSEQUENCE-ONTOLOGY-001` types module, ran the codebase's own "extend, don't duplicate" check and found an already-ratified, already-implemented collision: `types/consequence.ts` + `services/consequence/*` (CFS-006a, the Consequence Operating Model) already has a `ConsequenceForecast` (prospective projection over an invariant graph), an `'execution'` pipeline stage, and an `executeApproved()` function whose returned `observation: 'confirmed' | 'contradicted'` is — in concept and largely in wording — the same distinction as the PRD's proposed `ConsequenceProjection`/`ObservedConsequence`. Wrote `docs/vela/CONSEQUENCE-ONTOLOGY-001.md` as a findings-plus-decision-needed document (no types module written) presenting three resolution options (compose into CFS-006a's existing slot; keep Vela's types adjacent-but-routed-through-the-canonical-pipeline; fully separate/not recommended) and is raising this to the operator rather than resolving it unilaterally, per the Prospective Evolution Capture rule and `inv.engineering.037`.

## Why this matters

This is exactly the failure shape the codebase has paid for repeatedly (`EXPERIMENT_REGISTRY`, the pack-corpus URL sniff, `ASSIGNABLE_EXPERIMENTS`) — a new subsystem quietly re-deriving a concept a ratified pipeline already owns. Surfacing it before writing code, rather than after, is the point of the staged plan the operator specified.

## Links

- `docs/vela/VELA-SIGNER-TOPOLOGY-001.md`
- `docs/vela/VELA-PRIVACY-BOUNDARY-001.md`
- `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`
- `docs/vela/CONSEQUENCE-ONTOLOGY-001.md`
- Collides with / must be reconciled against: `types/consequence.ts`, `services/consequence/{stages,operatingModel,pipeline,counterfactual}.ts` (CFS-006a)
