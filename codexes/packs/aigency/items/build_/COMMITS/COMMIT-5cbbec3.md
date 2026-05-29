# Commit Brief: `5cbbec3` — metaMe protocol primitive: R/T dots spec + TTS console diagnostics + iframe Open removal

| Field | Value |
|-------|-------|
| SHA | [`5cbbec3`](https://github.com/iQube-Protocol/AigentZBeta/commit/5cbbec335bace62a43c314be9d7fa044fd27d27b) |
| Author | Claude |
| Date | 2026-05-29T17:06:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
metaMe protocol primitive: R/T dots spec + TTS console diagnostics + iframe Open removal

Three changes rolled up:

1. R/T scoring dots — formalised as a metaMe client protocol primitive.
   - New AgentiQ updates doc: codexes/packs/agentiq/updates/
     2026-05-29_metame-client-rt-dots-spec.md. Covers 5-dot strip math
     (Math.ceil(value/2)), colour ramps (R: red→yellow→purple,
     T: red→yellow→green), dot geometry, busy-pulse semantics (two
     independent signals: isProcessing OR ttsIsLoading → animate-pulse
     + staggered 0.15s per-dot animationDelay), and a canonical TSX
     implementation any thin-client can copy verbatim.
   - Registered in codexes/packs/agentiq/collections.json under
     col_updates so it surfaces in the AgentiQ Cartridge Updates tab.
   - CLAUDE.md gains a "metaMe Client Protocol Primitive — R/T
     scoring dots + busy pulse" section right above the aigentMe
     Capsule ↔ Layout Contract entry. Diverging on dot count, colour,
     or pulse semantics breaks the trust glance the strip exists to
     deliver; thin-clients must mirror line-for-line.

2. useTTSPlayer — console diagnostics for the still-not-working
   Cartesia path. On every /api/skills/tts response, log
   X-TTS-Provider (cartesia / openai) and, if present, the
   X-TTS-Cartesia-Error header so the operator can see WHY Cartesia
   fell through without DevTools-trawling response headers. On 4xx/5xx
   responses the route body is now read once and surfaced in the
   thrown Error so the FE error tooltip carries the actual upstream
   reason instead of bare "TTS 500".

3. IframeTab — remove the chrome-strip Open button per operator
   request ("if not just remove it"). The cartridge sub-header
   already shows the embed URL + label; the chrome row was eating
   vertical space the embedded site needed. Iframe now occupies the
   full tab area. ExternalLink import dropped alongside.
```

## Body

Three changes rolled up:

1. R/T scoring dots — formalised as a metaMe client protocol primitive.
   - New AgentiQ updates doc: codexes/packs/agentiq/updates/
     2026-05-29_metame-client-rt-dots-spec.md. Covers 5-dot strip math
     (Math.ceil(value/2)), colour ramps (R: red→yellow→purple,
     T: red→yellow→green), dot geometry, busy-pulse semantics (two
     independent signals: isProcessing OR ttsIsLoading → animate-pulse
     + staggered 0.15s per-dot animationDelay), and a canonical TSX
     implementation any thin-client can copy verbatim.
   - Registered in codexes/packs/agentiq/collections.json under
     col_updates so it surfaces in the AgentiQ Cartridge Updates tab.
   - CLAUDE.md gains a "metaMe Client Protocol Primitive — R/T
     scoring dots + busy pulse" section right above the aigentMe
     Capsule ↔ Layout Contract entry. Diverging on dot count, colour,
     or pulse semantics breaks the trust glance the strip exists to
     deliver; thin-clients must mirror line-for-line.

2. useTTSPlayer — console diagnostics for the still-not-working
   Cartesia path. On every /api/skills/tts response, log
   X-TTS-Provider (cartesia / openai) and, if present, the
   X-TTS-Cartesia-Error header so the operator can see WHY Cartesia
   fell through without DevTools-trawling response headers. On 4xx/5xx
   responses the route body is now read once and surfaced in the
   thrown Error so the FE error tooltip carries the actual upstream
   reason instead of bare "TTS 500".

3. IframeTab — remove the chrome-strip Open button per operator
   request ("if not just remove it"). The cartridge sub-header
   already shows the embed URL + label; the chrome row was eating
   vertical space the embedded site needed. Iframe now occupies the
   full tab area. ExternalLink import dropped alongside.

## Files Changed

| Change | File |
|--------|------|
| Modified | `CLAUDE.md` |
| Modified | `app/hooks/useTTSPlayer.ts` |
| Modified | `app/triad/components/codex/tabs/IframeTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-29_metame-client-rt-dots-spec.md` |

## Stats

 5 files changed, 216 insertions(+), 26 deletions(-)
