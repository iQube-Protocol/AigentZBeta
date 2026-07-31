# Commit Brief: `bd1bc83` — fix(chain of intent): make every pill expand inline on both surfaces

| Field | Value |
|-------|-------|
| SHA | [`bd1bc83`](https://github.com/iQube-Protocol/AigentZBeta/commit/bd1bc832798c563505d888529ea0b1e00448845f) |
| Author | Claude |
| Date | 2026-06-03T14:59:01Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix(chain of intent): make every pill expand inline on both surfaces

WorkbenchLedger and MyWorkspaceTab pills now both expand inline on
click to show the chain-of-intent timeline. Fixes two regressions
that left both surfaces unclickable in practice:

1. WorkbenchLedger pills wrapped their content in a <button>, which
   contained an <a target="_blank"> for artifact links. Nested
   interactive content is invalid HTML; some browsers swallow the
   parent click. Swapped to <div role="button" tabIndex={0}> with an
   Enter/Space key handler, and wrapped the ArtifactList in a
   stopPropagation div so opening an artifact link doesn't also
   toggle the panel.

2. MyWorkspaceTab pills were gated behind hasChain (intentToChain
   map). Intents created via /api/assistant/intent — the vast
   majority of pills — never have an intent_chains row attached, so
   every card was disabled. Replaced with the same expand-inline
   pattern as WorkbenchLedger; uses the shared useIntentChainCache
   hook + IntentChainPanel component. The "Open full chain" deep
   link into ChainDetailDrawer is rendered only when the timeline
   actually reports an attached chain.

Refactor: extracted IntentChainPanel + useIntentChainCache into
components/metame/workbench/IntentChainPanel.tsx so both surfaces
share one implementation of the timeline UI + lazy fetch.
```

## Body

WorkbenchLedger and MyWorkspaceTab pills now both expand inline on
click to show the chain-of-intent timeline. Fixes two regressions
that left both surfaces unclickable in practice:

1. WorkbenchLedger pills wrapped their content in a <button>, which
   contained an <a target="_blank"> for artifact links. Nested
   interactive content is invalid HTML; some browsers swallow the
   parent click. Swapped to <div role="button" tabIndex={0}> with an
   Enter/Space key handler, and wrapped the ArtifactList in a
   stopPropagation div so opening an artifact link doesn't also
   toggle the panel.

2. MyWorkspaceTab pills were gated behind hasChain (intentToChain
   map). Intents created via /api/assistant/intent — the vast
   majority of pills — never have an intent_chains row attached, so
   every card was disabled. Replaced with the same expand-inline
   pattern as WorkbenchLedger; uses the shared useIntentChainCache
   hook + IntentChainPanel component. The "Open full chain" deep
   link into ChainDetailDrawer is rendered only when the timeline
   actually reports an attached chain.

Refactor: extracted IntentChainPanel + useIntentChainCache into
components/metame/workbench/IntentChainPanel.tsx so both surfaces
share one implementation of the timeline UI + lazy fetch.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` |
| Added | `components/metame/workbench/IntentChainPanel.tsx` |
| Modified | `components/metame/workbench/WorkbenchLedger.tsx` |

## Stats

 3 files changed, 381 insertions(+), 328 deletions(-)
