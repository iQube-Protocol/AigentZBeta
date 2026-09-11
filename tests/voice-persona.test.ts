/**
 * The voice co-pilot speaks as the surface's agent (operator, 2026-07-26).
 *
 * It was hardcoded to Marketa in four places at once, so every mount of the
 * copilot introduced her regardless of who the citizen was actually talking
 * to — Agent Me in the Companion, a cartridge lead elsewhere. The copilot is
 * ONE conversation rendered three ways (text / avatar / voice, SCOPE-MMC-004
 * D-8); an agent whose identity changes with the modality breaks the premise
 * that there is one agent to address.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  resolveVoicePersona,
  canonicalAgentId,
  DEFAULT_VOICE_ID,
  FALLBACK_AGENT_ID,
} from '@/services/metame/voicePersona';

const COPILOT = 'app/components/codex/CodexCopilotLayer.tsx';

describe('the voice follows the surface, not a fixed agent', () => {
  it('THE canary: no agent name is hardcoded into the voice session', () => {
    const code = stripComments(readSource(COPILOT));
    for (const literal of ['"Talk to Marketa"', '"Stop Marketa"', 'name: "Marketa"', 'You are Marketa']) {
      expect(code, `a hardcoded voice identity is back: ${literal}`).not.toContain(literal);
    }
    // …and the config reads the resolved persona instead.
    expect(code).toContain('name: voicePersona.name');
    expect(code).toContain('firstMessage: voicePersona.greeting');
    expect(code).toContain('content: voicePersona.systemPrompt');
    expect(code).toContain('voiceId: voicePersona.voiceId');
  });

  it('the persona derives from the host agent prop', () => {
    const code = stripComments(readSource(COPILOT));
    expect(code).toMatch(/resolveVoicePersona\(agent\)/);
  });

  it('Agent Me speaks as Agent Me', () => {
    const p = resolveVoicePersona({ id: 'aigent-me', name: 'Agent Me' });
    expect(p.name).toBe('Agent Me');
    expect(p.greeting).toContain('Agent Me');
    expect(p.systemPrompt).toMatch(/^You are Agent Me\./);
    expect(p.systemPrompt).not.toContain('Marketa');
  });

  it('a mount that names no agent is UNCHANGED — it still gets Marketa', () => {
    // The fallback is what makes this safe to land everywhere at once: a
    // surface that never declared an agent cannot be silently re-voiced.
    const p = resolveVoicePersona(undefined);
    expect(FALLBACK_AGENT_ID).toBe('aigent-marketa');
    expect(p.name.toLowerCase()).toContain('marketa');
    expect(p.voiceId).toBe(DEFAULT_VOICE_ID);
  });

  it('the name comes from the registry when the host supplies none', () => {
    // Derived from the canonical profile map, never a second list of names.
    const p = resolveVoicePersona({ id: 'aigent-marketa' });
    expect(p.name.toLowerCase()).toContain('marketa');
    expect(p.systemPrompt.length).toBeGreaterThan(40);
  });

  it('accepts short or canonical agent ids', () => {
    expect(canonicalAgentId('kn0w1')).toBe('aigent-kn0w1');
    expect(canonicalAgentId('aigent-kn0w1')).toBe('aigent-kn0w1');
    expect(canonicalAgentId('  AIGENT-ME ')).toBe('aigent-me');
    expect(canonicalAgentId('')).toBeNull();
    expect(canonicalAgentId(null)).toBeNull();
  });

  it('an unknown agent still speaks as itself rather than as someone else', () => {
    const p = resolveVoicePersona({ id: 'aigent-community-concierge', name: 'Community Concierge' });
    expect(p.name).toBe('Community Concierge');
    expect(p.systemPrompt).not.toContain('Marketa');
  });

  it('does not invent a voice it has not been given', () => {
    // One Cartesia voice is provisioned. Every agent uses it until more are
    // commissioned — what changes is who the agent SAYS it is.
    for (const id of ['aigent-me', 'aigent-z', 'aigent-marketa']) {
      expect(resolveVoicePersona({ id }).voiceId).toBe(DEFAULT_VOICE_ID);
    }
  });
});
