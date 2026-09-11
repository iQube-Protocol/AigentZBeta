## Summary
<!-- What does this PR change? Keep it crisp. -->

## Why
<!-- Link to brief/work item. What user/system outcome does this enable? -->

## Integrate, Don't Rebuild (REQUIRED)
- Reused (existing components):
  - 
- Extended (small additions/hooks/adapters):
  - 
- Rebuilt (if any):
  - 
  Justification (required if rebuilt):
  - 

## Existing Work Audit (REQUIRED)
- Existing modules checked (paths/files):
  - 
- Decision: Integrate / Extend / Replace
- Notes: Why this path is minimal and avoids duplication

## Scope & Ownership
- Primary folders touched:
  - 
- Ownership: Cascade-owned / Codex-owned / Shared
- Hot files touched? (auth/core routing/db/payments) Yes/No
  - If Yes, explain why and confirm Cascade-led.

## Contracts & Versions
- OpenAPI version:
- Schemas validated:
  - capabilities:
  - ui_assembly_packet:
  - component_registry:
- Any breaking changes? Yes/No
  - If Yes, include migration notes and version negotiation updates.

## Security / Gating / Invariants (REQUIRED)
- Tenant scope enforced: Yes/No
- RBAC enforced: Yes/No
- Locked content cannot leak: Yes/No
- Wallet actions server-authoritative: Yes/No
- Idempotency handled (if unlock/payment): Yes/No
- Receipts emitted for state changes: Yes/No
- Provenance updated (if relevant): Yes/No

## Capability and Invariant Completion (CCR-001)
<!--
Constitutional Capability Completion Law: a capability that is implemented but
has no completion artifact is operationally present, not constitutionally
complete. Template: codexes/packs/aigency/items/build_/templates/CAPABILITY_COMPLETION_ARTIFACT_TEMPLATE.md
Write N/A on every line if this PR touches no registered capability.
-->
- Does this PR complete or materially change a registered capability? Yes/No
  - If Yes, Capability Completion Artifact (CCB) path:
- New invariants discovered in this work:
  - ID / statement / provenance (§8 kind) / canary shipped in this PR:
- Defect fixed by this PR maps to invariant (CCR-INV-9): `<ID>` / new candidate / N/A
- Every invariant marked `canonical` names at least one canary: Yes/No/N/A
- Artifact updated to match the shipped behaviour (CCR-INV-11): Yes/No/N/A

## Testing
- Unit tests added/updated:
- Pack integrity checks run: Yes/No
- Local smoke test performed:
  - [ ] Shelves
  - [ ] Collection
  - [ ] Item preview/full (access_state)
  - [ ] Unlock + receipt
  - [ ] Provenance timeline

## Receipts / Provenance
- Receipt IDs (if applicable):
- AgentiQ Codex updates made:
  - BACKLOG.md / DECISIONS.md / brief link:

---

## AIGENTZ_DECISIONS
<!--
List decisions made in this PR. Use the structure below for each decision.
Write "N/A" if no architectural or design decisions were made.
-->
- Decision:
  Context:
  Options:
  Tradeoff:
  Result:

## AIGENTZ_PROBLEMS
<!--
List problems encountered and how they were resolved.
Write "None encountered" if the PR was straightforward.
-->
- Problem:
  Symptom:
  Root cause:
  Fix:
  Verification:
  Follow-up:

## AIGENTZ_IMPACT
<!--
Summarise the systemic impact of this change.
-->
- Breaking: yes/no
- Migration: yes/no (+ steps if yes)
- Security/Privacy:
- Performance:

## Codex Checklist
- [ ] I filled **AIGENTZ_DECISIONS** (or wrote "N/A")
- [ ] I filled **AIGENTZ_PROBLEMS** (or wrote "None encountered")
- [ ] I filled **AIGENTZ_IMPACT**
- [ ] I updated `codexes/packs/aigency/items/architecture/system-map.md` if core flows or contracts changed
