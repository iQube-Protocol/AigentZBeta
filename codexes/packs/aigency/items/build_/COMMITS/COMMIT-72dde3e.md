# Commit Brief: `72dde3e` — document wallet-over-cartridge overlay pattern + aletheon activation walkthrough

| Field | Value |
|-------|-------|
| SHA | [`72dde3e`](https://github.com/iQube-Protocol/AigentZBeta/commit/72dde3ebda4ffeb0c4ae3bb8eb747866903c99a7) |
| Author | Claude |
| Date | 2026-06-13T20:31:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
document wallet-over-cartridge overlay pattern + aletheon activation walkthrough

CLAUDE.md additions:

- new section 'Wallet-Over-Cartridge Overlay — CANONICAL PATTERN'
  documenting the only working approach to mount SmartWalletDrawer
  on top of a cartridge layer: variant='embedded' INSIDE
  <CodexCopilotLayer>'s flex container, NOT as a parallel
  slide-over.

  references the canonical implementation at
  app/components/codex/CodexCopilotLayer.tsx:1700-1724 and the
  anti-pattern warning comment at line 113 ('the parallel
  SmartWalletDrawer (which has z-index conflicts)').

  per-operator-confirmed working surfaces (2026-06-13 screenshots):
  - metaMe → AgentiQ OS → Polity Passport → Apply tab with copilot +
    wallet visible alongside the cartridge content
  - AgentiQ OS → Registry → Persona → 'Mint your persona as iQube'
    wallet overlay

  rule for new cartridges that need wallet access: add to the
  hardcoded codexId list in CodexPanelDynamic.tsx:1071-1121, let the
  copilot own the wallet activation (setWalletPanelOpen), never
  parallel-mount. non-negotiable until a config-driven copilot+wallet
  system replaces the hardcoded list (Phase B Sprint 8 follow-on).

new operator doc:

- codexes/packs/agentiq/updates/2026-06-13_aletheon-activation-walkthrough.md
  end-to-end workflow for activating Aletheon as bound delegate.
  two paths:
    Path A (demo, works today, ~10 steps) — sponsor-side flow:
      genesis Aletheon → submit participant → steward issues →
      claim VC on behalf → bounded delegation → AgentKit attest
      (verified_human: true because First Citizen has World ID) →
      Locker upload + grant → QubeTalk channel auto-bind →
      ProveKit personhood + delegation_authority proofs →
      ENS claim.
    Path B (architecturally clean, Phase B work, ~3 days) — Aletheon
      owns her own persona context, switches in wallet, claims own
      VC. requires POST /api/identity/persona/agent endpoint +
      re-anchor script + persona switcher.

  doc includes: per-step expected DB writes, expected JSON
  responses, canonical id reference table, verification checklist
  for the demo gate, and a 'if it fails, check...' troubleshooting
  pointer to the auth_profile_id migration fix + amplify build fix.

- collections.json registers the new doc in agentiq col_updates.

per operator request, 2026-06-13 20:27Z.
```

## Body

CLAUDE.md additions:

- new section 'Wallet-Over-Cartridge Overlay — CANONICAL PATTERN'
  documenting the only working approach to mount SmartWalletDrawer
  on top of a cartridge layer: variant='embedded' INSIDE
  <CodexCopilotLayer>'s flex container, NOT as a parallel
  slide-over.

  references the canonical implementation at
  app/components/codex/CodexCopilotLayer.tsx:1700-1724 and the
  anti-pattern warning comment at line 113 ('the parallel
  SmartWalletDrawer (which has z-index conflicts)').

  per-operator-confirmed working surfaces (2026-06-13 screenshots):
  - metaMe → AgentiQ OS → Polity Passport → Apply tab with copilot +
    wallet visible alongside the cartridge content
  - AgentiQ OS → Registry → Persona → 'Mint your persona as iQube'
    wallet overlay

  rule for new cartridges that need wallet access: add to the
  hardcoded codexId list in CodexPanelDynamic.tsx:1071-1121, let the
  copilot own the wallet activation (setWalletPanelOpen), never
  parallel-mount. non-negotiable until a config-driven copilot+wallet
  system replaces the hardcoded list (Phase B Sprint 8 follow-on).

new operator doc:

- codexes/packs/agentiq/updates/2026-06-13_aletheon-activation-walkthrough.md
  end-to-end workflow for activating Aletheon as bound delegate.
  two paths:
    Path A (demo, works today, ~10 steps) — sponsor-side flow:
      genesis Aletheon → submit participant → steward issues →
      claim VC on behalf → bounded delegation → AgentKit attest
      (verified_human: true because First Citizen has World ID) →
      Locker upload + grant → QubeTalk channel auto-bind →
      ProveKit personhood + delegation_authority proofs →
      ENS claim.
    Path B (architecturally clean, Phase B work, ~3 days) — Aletheon
      owns her own persona context, switches in wallet, claims own
      VC. requires POST /api/identity/persona/agent endpoint +
      re-anchor script + persona switcher.

  doc includes: per-step expected DB writes, expected JSON
  responses, canonical id reference table, verification checklist
  for the demo gate, and a 'if it fails, check...' troubleshooting
  pointer to the auth_profile_id migration fix + amplify build fix.

- collections.json registers the new doc in agentiq col_updates.

per operator request, 2026-06-13 20:27Z.

## Files Changed

| Change | File |
|--------|------|
| Modified | `CLAUDE.md` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-06-13_aletheon-activation-walkthrough.md` |

## Stats

 3 files changed, 268 insertions(+), 1 deletion(-)
