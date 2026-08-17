/**
 * WPA-3 finishing pass, item 2 (operator brief 2026-08-17) — "add existing
 * TTS speaker control to floating copilot."
 *
 * The main/embedded copilot (SmartTriadCopilotLayer) already had a message-
 * level "Listen" TTS control (useTTSPlayer -> /api/skills/tts, Cartesia
 * Sonic primary). The real floating copilot (CodexCopilotLayer, identified
 * during WPA-3) had none. This proves BOTH mount the SAME shared hook
 * (useTTSListen) and button (TTSListenButton) — never a second TTS
 * subsystem — and that the floating copilot's R/T-dots busy-pulse now
 * includes the TTS-loading signal, per the platform's documented busy-pulse
 * convention (CLAUDE.md "metaMe Client Protocol Primitive").
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const FLOATING = 'app/components/codex/CodexCopilotLayer.tsx';
const MAIN = 'components/smarttriad/copilot/SmartTriadCopilotLayer.tsx';
const SHARED_HOOK_PATH = 'components/smarttriad/copilot/useTTSListen';
const SHARED_BUTTON_PATH = 'components/smarttriad/copilot/TTSListenButton';

describe('the floating copilot (CodexCopilotLayer) reuses the SAME TTS hook/button as the main copilot', () => {
  it('imports useTTSListen and TTSListenButton from the shared module, not a local reimplementation', () => {
    const code = stripComments(readSource(FLOATING));
    expect(code).toMatch(new RegExp(`useTTSListen.*from ["']@/${SHARED_HOOK_PATH}["']`));
    expect(code).toMatch(new RegExp(`TTSListenButton.*from ["']@/${SHARED_BUTTON_PATH}["']`));
    // No second useTTSPlayer wiring in this file — the shared hook owns it.
    expect(code).not.toMatch(/useTTSPlayer/);
  });

  it('the main copilot ALSO imports from the shared module (both consumers, one implementation)', () => {
    const code = stripComments(readSource(MAIN));
    expect(code).toMatch(/useTTSListen.*from ["']\.\/useTTSListen["']/);
    expect(code).toMatch(/TTSListenButton.*from ["']\.\/TTSListenButton["']/);
  });

  it('the floating copilot mounts <TTSListenButton> with isSpeaking/isLoading/hasContent/onToggle, matching the main copilot\'s prop contract', () => {
    const code = stripComments(readSource(FLOATING));
    expect(code).toMatch(/<TTSListenButton\s+isSpeaking=\{ttsIsSpeaking\}\s+isLoading=\{ttsIsLoading\}\s+hasContent=\{ttsHasContent\}\s+onToggle=\{handleTTSListenToggle\}/);
  });

  it('the floating copilot\'s R/T dots busy-pulse includes ttsIsLoading (matches the documented busy-pulse convention)', () => {
    const code = stripComments(readSource(FLOATING));
    const uses = code.match(/renderDots\([\s\S]{0,120}?\|\|\s*ttsIsLoading\)/g) ?? [];
    expect(uses.length, 'expected both R and T dots calls to include ttsIsLoading').toBeGreaterThanOrEqual(2);
  });
});

describe('the shared TTS pieces only read assistant messages, matching the pre-existing rule exactly', () => {
  it('useTTSListen.ts scans for role === "assistant" with string content, same rule as before extraction', () => {
    const code = stripComments(readSource(`${SHARED_HOOK_PATH}.ts`));
    expect(code).toMatch(/messages\[i\]\.role === ["']assistant["'] && typeof messages\[i\]\.content === ["']string["']/);
  });

  it('TTSListenButton.tsx is presentational only (no useTTSPlayer of its own — state comes from useTTSListen)', () => {
    const code = stripComments(readSource(`${SHARED_BUTTON_PATH}.tsx`));
    expect(code).not.toMatch(/useTTSPlayer/);
  });
});
