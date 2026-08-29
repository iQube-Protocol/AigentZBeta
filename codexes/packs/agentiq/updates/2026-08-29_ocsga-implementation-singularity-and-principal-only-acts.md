# OCSGA Boundary Research — Implementation Singularity & Principal-Only Constitutional Acts (2026-08-29)

**Status:** Session record — empirical basis / provenance for ratified doctrine.
**Ratified doctrine this record supports:** `inv.constitutional.361` (Implementation Singularity),
`inv.engineering.362-364/366/370`, `inv.constitutional.365/367-369` (Principal-Only Constitutional
Acts) in `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md`, and the promotion of
the five `CI-2026-08-28-*` candidate invariants to `status: "ratified"` in
`codexes/packs/agentiq/resolution-records/candidate-invariants/`.
**Design record (not yet implemented):** `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md`.

## Context

This record closes out the OCSGA (Ian's Reciprocal Artifact Exchange / Boundary Research) bridge
stabilisation work carried out across the preceding three phases of the same session:

1. Deployment and live acceptance of the OCSGA projection fix (`429dea146` → `b0d0aebda` on `dev`).
2. Gated, zero-behaviour-change runtime diagnostics for the shared ~3-second reset defect observed
   across aigentMe and bridge surfaces (`4b1df6558`).
3. Discovery and remediation of a principal-identity enforcement defect in orientation acknowledgement
   (`93aa78b04`, deployed together with (2) as `bbfa9d475` on `dev`).

While closing (3), constitutional research (not yet implementation) into *why* the defect was
possible — rather than only how to patch it — surfaced a pattern that recurred across multiple,
apparently unrelated defects in the same investigation. This record captures that pattern as the
empirical basis for the invariants above.

## Observed defect class

Five related observations, all drawn from the same investigation:

1. **Canonical reciprocal-exchange state was singular.** There was one authoritative table/shape
   for exchange, delegation, artifact and orientation state — the state itself was never forked or
   duplicated.
2. **Multiple implementation/journey paths imposed different semantics on that one state.** Despite
   (1), different code paths (bridge UI, MCP-mediated Copilot path, journey resolver) each carried
   their own logic for deciding what the same canonical state meant and how it could be changed —
   so the same fact could be read, or written, inconsistently depending on which path touched it.
3. **The canonical `confirmOperatorAssistedArtifact` primitive existed for the MCP path but the
   bridge lacked an invocation path to it.** A constitutionally correct primitive was present in
   the codebase but was not reachable from every channel that legitimately needed it — proving that
   a canonical primitive's mere existence does not guarantee canonical use.
4. **Principal-only orientation was recorded against a delegated aigentMe persona** (Ian's own
   aigentMe persona `25ebf4ca...`, not Ian's principal persona `29d22f83-a3cc-49d9-90be-a39391e9d8ae`)
   **because the execution boundary trusted whichever persona `getActivePersona()` happened to
   return**, rather than verifying that the acting persona was the specific principal the act
   required. This is the defect fixed in `93aa78b04` (`resolveOrientationPrincipalGate`,
   `services/journey/ianJourneyState.ts`).
5. **The correct repairs were, in both cases, structural rather than local:** (a) converge every
   channel on the same canonical resolver/primitive rather than adding a channel-specific patch, and
   (b) enforce principal identity at the execution boundary itself — as a gate the write path cannot
   bypass — rather than as a UI-level convention that a well-behaved caller happens to follow.

## Framing

State singularity is necessary but insufficient for Constitutional Computing. Constitutional
integrity requires implementation singularity: a single canonical, auditable means by which a given
class of constitutional state transition may legitimately occur. A constitutional system whose state
is singular but whose implementations are plural has not eliminated divergence — it has only moved
the divergence from data to code, where it is harder to see and just as capable of producing an
invalid constitutional record (as in observation 4 above).

## Relationship to prior ratified doctrine

- Extends `inv.engineering.036` (one authoritative location per concern) and `inv.engineering.037`
  (a parallel implementation of an existing capability is a defect) from *code duplication* to
  *constitutional transition semantics* specifically.
- Extends `inv.engineering.255` (One Predicate, One Projection) from read-side projection to
  write-side transition execution — the same "one predicate" discipline applied to "one execution
  path."
- Extends `inv.polity.310-316` (the DidQube three-class model; "citizen-level access rights sit at
  the personhood level, not the persona level") into an explicit, general Principal-Only Constitutional
  Acts doctrine, grounded in the concrete defect at observation 4.
- Shares its empirical root (`RES-2026-08-28-RAX-OPERATOR-ASSISTED-CHANNEL-CONVERGENCE-001`) with the
  five `CI-2026-08-28-*` candidate invariants promoted to ratified alongside this record.
- Is the named case study behind `codexes/packs/irl/foundation/CS-001_duplicate-capability-as-constitutional-drift.md`.

## Sequencing note

This record, the appendix-a additions, and the CTP-001 charter are a **doctrine and documentation
commit only**. No refactor of the reciprocal-exchange implementation and no CTP runtime, registry,
schema migration, or CI enforcement was introduced by this work. The CTP implementation workstream
is explicitly sequenced to follow after Ian's stabilisation/authorization path is fully closed —
i.e. after Ian has personally acknowledged orientation as his principal persona and live end-to-end
acceptance of the OCSGA exchange has been confirmed.
