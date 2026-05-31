# Commit Brief: `f9cfb44` — metaMe: Cartesia TTS primary + myCanvas two-row header + metame.com iframe tab

| Field | Value |
|-------|-------|
| SHA | [`f9cfb44`](https://github.com/iQube-Protocol/AigentZBeta/commit/f9cfb44edb9ca2441af7d0d9ef74c41606b71dd2) |
| Author | Claude |
| Date | 2026-05-29T14:10:00Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
metaMe: Cartesia TTS primary + myCanvas two-row header + metame.com iframe tab

Three operator asks rolled into one commit:

1. TTS chain switched to Cartesia primary, OpenAI fallback
   The copilot inference playback (ListenButton, useTTSPlayer) was
   calling OpenAI tts-1 directly. Cartesia (Sonic English) sounds
   noticeably better and is already used elsewhere for Marketa voice
   via VAPI. Add a direct call to api.cartesia.ai/tts/bytes with the
   same voice id (694f9389-…-9d9369183238) the VAPI surface uses, and
   keep OpenAI tts-1 as the secondary path so quota / outage on
   Cartesia silently falls through.
   Response now carries an X-TTS-Provider header (cartesia / openai)
   so the FE can see which tier served the bytes.

2. myCanvas sidebar header — two-row layout
   The "PUBLIC · PUBLISHABLE" subtitle was squashed inline next to
   the "myCanvas" title in the 64-px-wide sidebar. Move the subtitle
   to a second row underneath the title, indented to align with the
   title text (pl-6 == icon column). myWorkbench gets the same
   treatment ("PRIVATE · INTERNAL").

3. metaMe cartridge: first-class metame.com tab
   New IframeTab generic component (app/triad/components/codex/tabs/
   IframeTab.tsx) that renders an external site inside a cartridge
   tab. Registered in TabRenderer.componentRegistry so any cartridge
   can drop a tab with `config.component: 'IframeTab', props.src: …`.
   Added to the metaMe cartridge as the first group (order: -1, before
   aigentMe) with a new TabGroup.iconOnly flag — chip renders only the
   Globe icon, no label, tight px-2 width. Group is not
   activation-gated so it persists as a first-class menu item.

   Hard constraint: metame.com MUST permit framing from the embedding
   host. If the response carries X-Frame-Options: DENY/SAMEORIGIN or a
   CSP frame-ancestors directive that excludes aigentz.me /
   metame.live, the iframe will render blank. Operator action then is
   on the metame.com server config, not on this tab.

Env allowlist (scripts/create-env-production.js) extended with
CARTESIA_API_KEY / CARTESIA_VOICE_ID / CARTESIA_MODEL /
CARTESIA_VERSION so the bootstrap propagates them through dev/prod.
```

## Body

Three operator asks rolled into one commit:

1. TTS chain switched to Cartesia primary, OpenAI fallback
   The copilot inference playback (ListenButton, useTTSPlayer) was
   calling OpenAI tts-1 directly. Cartesia (Sonic English) sounds
   noticeably better and is already used elsewhere for Marketa voice
   via VAPI. Add a direct call to api.cartesia.ai/tts/bytes with the
   same voice id (694f9389-…-9d9369183238) the VAPI surface uses, and
   keep OpenAI tts-1 as the secondary path so quota / outage on
   Cartesia silently falls through.
   Response now carries an X-TTS-Provider header (cartesia / openai)
   so the FE can see which tier served the bytes.

2. myCanvas sidebar header — two-row layout
   The "PUBLIC · PUBLISHABLE" subtitle was squashed inline next to
   the "myCanvas" title in the 64-px-wide sidebar. Move the subtitle
   to a second row underneath the title, indented to align with the
   title text (pl-6 == icon column). myWorkbench gets the same
   treatment ("PRIVATE · INTERNAL").

3. metaMe cartridge: first-class metame.com tab
   New IframeTab generic component (app/triad/components/codex/tabs/
   IframeTab.tsx) that renders an external site inside a cartridge
   tab. Registered in TabRenderer.componentRegistry so any cartridge
   can drop a tab with `config.component: 'IframeTab', props.src: …`.
   Added to the metaMe cartridge as the first group (order: -1, before
   aigentMe) with a new TabGroup.iconOnly flag — chip renders only the
   Globe icon, no label, tight px-2 width. Group is not
   activation-gated so it persists as a first-class menu item.

   Hard constraint: metame.com MUST permit framing from the embedding
   host. If the response carries X-Frame-Options: DENY/SAMEORIGIN or a
   CSP frame-ancestors directive that excludes aigentz.me /
   metame.live, the iframe will render blank. Operator action then is
   on the metame.com server config, not on this tab.

Env allowlist (scripts/create-env-production.js) extended with
CARTESIA_API_KEY / CARTESIA_VOICE_ID / CARTESIA_MODEL /
CARTESIA_VERSION so the bootstrap propagates them through dev/prod.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/tts/route.ts` |
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/IframeTab.tsx` |
| Modified | `app/triad/components/codex/tabs/MyCanvasTab.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `scripts/create-env-production.js` |
| Modified | `types/codex.ts` |

## Stats

 8 files changed, 271 insertions(+), 27 deletions(-)
