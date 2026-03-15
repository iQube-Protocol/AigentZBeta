# Thin Client Handoff: Codex-Backed ExperienceQube Runtime Publication

This update is for the Lovable Thin Client workstream so Qriptopian-related runtime responses can include Composer-created ExperienceQubes as codex-native content, not only Studio preview links.

## What Has Been Implemented

We have completed the first codex-targeted runtime publication slice locally in AigentZBeta.

The key change is that runtime deployment is being moved from:

- URL-only Studio preview handoff

to:

- `ExperienceQube -> runtime capsule projection -> codex/cartridge runtime feed`

## What The New Publication Model Carries

Published ExperienceQubes now project a runtime-facing record with:

- `experience_id`
- `primary_codex_id`
- `primary_codex_tab`
- `cartridge_id`
- `intent`
- `quick_link`
- `content_kind`
- portrait image asset
- landscape image asset
- video asset if present
- preferred deployment asset
- stub persona / CRM / policy assignments

## Current Codex/Tab Defaults

For the current golden path:

- Qriptopian article/image/video article experiences publish to:
  - codex: `qripto-codex`
  - tab: `features`
  - intent: `read`

- KNYT-oriented experiences publish to:
  - codex: `knyt-codex`
  - tab: `scrolls`

- fallback tab stub:
  - `experiences`

This means article-led image/video experiences should be surfaced as `read` experiences in the Qriptopian cartridge/runtime, not as generic watch/play capsules.

## Runtime / Thin Client Expectations

The runtime handoff now carries:

- active codex
- target codex tab
- runtime cartridge
- read/watch intent
- portrait and landscape image variants
- video asset URL when present

Device behavior:

- mobile prefers portrait image
- tablet/desktop prefer landscape image

This orientation-aware rendering is a core part of the current experience innovation and should be preserved in thin-client runtime presentation.

## What We Need From Thin Client / Runtime Behavior

For Qriptopian codex-related queries in the thin client runtime:

1. Treat published ExperienceQubes as codex-backed runtime capsules, not just external launches.
2. Include Qriptopian-published ExperienceQubes in cartridge/codex response sets when:
   - active codex is `qripto-codex`
   - target tab is `features` or future `experiences`
3. Respect the runtime delivery metadata:
   - `intent=read`
   - `quick_link=read`
   - `runtimeCodexTab`
   - portrait / landscape image variants
4. Render the correct asset for device orientation:
   - portrait on mobile
   - landscape on tablet/desktop

## Why This Matters

The immediate golden-path proof we want now is:

- Composer-created ExperienceQubes
- published into Qriptopian codex context
- discoverable and callable in the thin client runtime
- rendered inside the Qriptopian cartridge as actual codex/runtime content

That is the proof point beyond Studio preview.

## Near-Term Runtime Goal

The next runtime-visible milestone is:

- ExperienceQubes created in Composer appear in the Qriptopian cartridge runtime feed
- they can be launched from codex/tab context
- they render with the correct generated assets
- they use Smart Actions / Liquid UI intent like other runtime content

Persona / CRM / policy assignment is currently stubbed and can be wired later.
