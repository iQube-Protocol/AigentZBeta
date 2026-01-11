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
- Aigency Codex updates made:
  - BACKLOG.md / DECISIONS.md / brief link:
