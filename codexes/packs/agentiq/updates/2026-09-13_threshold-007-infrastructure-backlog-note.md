# Threshold 007 — Infrastructure Implications Note (Backlog, Not Evidence)

**Status:** Infrastructure/architecture backlog note. Not research evidence, not part of the Evidence-Resolution Pass, not a claim about Threshold 007's scientific maturity. Kept separate per operator instruction: "the Evidence Access ClusterQube is backlog/architecture, not research evidence, so it shouldn't go into the evidence-resolution prose."

Both items below are also recorded as real rows in `research_backlog_items` (CFS-051's existing backlog home — see `codexes/packs/irl/foundation/CFS-051A_prospective-evolution-roadmaps.md` Roadmap C), so they persist as structured backlog, not only as prose.

## 1. Evidence Access ClusterQube (general infrastructure)

A future Evidence Access ClusterQube / IRL Invitation mechanism has been discussed as a way to give authorized reviewers governed access to private evidence associated with each Threshold essay, rather than evidence being either fully public or fully inaccessible. This is a proposed architectural refinement — **not implemented**, and it must not be classified as existing evidence unless independently found to already exist in code (it was not, per the evidence-resolution sweep).

Candidate eventual shape (operator-supplied):

```
Threshold 007 → Evidence ClusterQube → Lehigh Corpus
IRL Invitation → ClusterQube entitlement → authorized artifact resolution
```

`research_backlog_items` row: `threshold-007-evidence-access-clusterqube`.

## 2. Lehigh corpus constitutionalization (specific, time-bound backlog item)

**Artifact integrity and availability: established. Constitutional asset registration: pending.**

The 8 dense Lehigh REIT Risk corpus artifacts (`DATA_RISK_FOR_MARKETPLACES_V2.md`, `Pricng_Data_and_Risk_Final_Project_Paper.pdf`, `Plan_v.02.pdf`, `Final_Report_metaMe1.pdf`, `PoTS_Protocol_Integration_Pack_v0.1.pdf`, `Value_engine_Logic.docx`, `Book4.xlsx`, `Dhrunal_Belani_Final_Report_MetaMe_2.pdf`) are now durably hosted with verified sha256 integrity and repository-manifested locations (`codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/README.md`). They are presently direct Supabase Storage objects (public bucket `content-assets`, `research/lehigh-reit-risk-corpus/` prefix) rather than assets registered through the normal content-asset / iQube-trinity provenance pipeline. This affects constitutional registration and governed-access status, **not** the evidentiary contents of the artifacts themselves — the Evidence Agent should treat them as primary-source verified artifacts regardless of their current registration state.

Their being in a public bucket resolved today's evidence-availability problem but is not the intended end state for internal research materials, and conflicts with the access architecture item 1 describes above.

**Backlog item — Lehigh corpus constitutionalization:** migrate/attach the eight currently public Supabase Storage artifacts to the canonical content-asset/iQube provenance system once Threshold MCP OAuth is restored; preserve existing sha256 fingerprints as continuity anchors; associate them with the Threshold 007 Evidence ClusterQube (once item 1 exists); move governed/internal artifacts behind IRL Invitation access; verify byte-identical resolution after migration before retiring public exposure.

`research_backlog_items` row: `threshold-007-lehigh-corpus-constitutionalization`.

**Do not block the Evidence Agent on this.** Registration is infrastructure; evidence resolution proceeds now against the Storage-hosted artifacts as-is.

## 3. QubeTalk Locker Bridge — Aletheon ↔ Claude artifact/action handoff with constitutional receipts

**Status:** Captured 2026-09-15, per operator (Aletheon-side) direction. **Not implemented. Not scheduled ahead of the Trusted Intelligence / Threshold work.** The operator was explicit: "I would not stop the Trusted Intelligence work to implement it now" — this is a near-term infrastructure item, not a request to build anything.

### The problem this solves

Aletheon and Claude (this session, operating with GitHub/repo-native write access) currently have no neutral, asynchronous handoff surface. Work either happens inside one agent's own session, or is manually relayed by the human operator pasting content between sessions (as happened with the Merit-to-Falsify review and the Threshold 007.3 candidate files earlier in this session). That works but doesn't scale past one agent pair, and it conflates "artifact was handed over" with "action was authorized and performed."

### The proposed bridge (operator's own framing, preserved verbatim in substance)

> Aletheon → QubeTalk packet → Locker → Claude / MCP → GitHub → receipt back to Locker

The **Locker becomes the neutral handoff surface** — Aletheon and Claude do not pretend to communicate directly. Each handoff is a small **constitutional work packet** containing: the artifact(s), intended destination/path, requested action, authority/delegation, provenance/hash, publication status, and an expected completion receipt.

### Operating model

1. Aletheon creates/refines strategy, papers, prompts, specs, evidence packages.
2. Aletheon pushes the approved artifact packet into the Locker via QubeTalk/MCP.
3. Claude reads the packet through the same MCP bridge.
4. Claude performs repo-native actions using its own GitHub access.
5. Claude returns commit/PR/hash/status as a receipt into the Locker.
6. Aletheon inspects the receipt and continues from actual repository state.

### Governing design invariant (paramount, must survive any implementation)

> **Artifact handoff is not execution authority.**

A packet can say "candidate for publication to `docs/...`," but the receiving agent must still hold the appropriate delegated authority before performing any GitHub write — packet delivery is transport, not permission. The return receipt must distinguish, at minimum, **received / acted / committed / merged / published**, so transport success is never confused with execution success. This composes directly with this repo's own existing invariants — the Aegis "assess but cannot admit" separation-of-powers pattern (`services/aegis/aegisAssessmentService.ts`) and the Factor `authorityChain.ts` delegation/revocation model are the closest existing implementations of exactly this discipline, and should be the reference pattern if this is ever built rather than a fresh design.

### Candidate packet schema (operator-supplied, preserved as given)

```
packet_id
sender_persona
recipient_persona
artifact_refs
artifact_hashes
intent
requested_action
target_repo
target_branch
target_paths
authority_scope
status
execution_receipts
created_at
expires_at
```

### Why this belongs in the backlog, not the evidence record

This is architecture/infrastructure, not research evidence — same reasoning as items 1 and 2 above. It must not be read as an existing capability, a validated design, or evidence bearing on Threshold 007/007.3's scientific claims. It is an operating-model proposal for how future artifact handoffs between Aletheon and Claude (and, per the operator's own note, potentially any authorized agent, not just this pair) should work.

### Prerequisite, per the operator's own sequencing

"Once the Threshold/metaMe MCP is visible to me in a session again, we can implement and test the first end-to-end packet using one low-risk document publication — before trusting it with canonical research artifacts." I.e.: (1) Aletheon's own MCP visibility is a precondition this session cannot resolve from the Claude side; (2) the first real test should be a low-risk, non-canonical document, not a Threshold research artifact; (3) canonical-artifact use is explicitly deferred until the low-risk test succeeds.

`research_backlog_items` row: `threshold-qubetalk-locker-bridge`.

## Status summary

| Concern | Status |
|---|---|
| Content integrity (sha256 fingerprints) | Resolved |
| Primary-source accessibility (durable URLs) | Resolved |
| Evidence analysis | Proceed now — see the Evidence-Resolution Pass and its v1.1 addendum |
| iQube registration/provenance | Backlog (item 2 above) |
| IRL-governed reviewer access | Backlog (item 1 above) |
| Public exposure of internal corpus | Temporary state, to retire once item 2 completes |
