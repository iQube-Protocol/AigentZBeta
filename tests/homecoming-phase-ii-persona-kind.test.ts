/**
 * Persona-Type Cleanup (Homecoming Phase II, operator brief 2026-08-16).
 *
 * Human-vs-agent persona classification must come SOLELY from the
 * persisted `world_id_status` field, never from display name / FIO
 * handle / FIO domain naming conventions. The name must have ZERO effect
 * on classification — the exact regression this replaces: ArcAgent (a
 * human persona) was rendered as an agent purely because its name
 * contained "Agent".
 */

import { describe, it, expect } from 'vitest';
import { getPersonaKind, isAgentPersonaKind } from '@/utils/personaKind';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('getPersonaKind / isAgentPersonaKind — name has zero effect', () => {
  it('a human persona named "ArcAgent" classifies as human', () => {
    // The exact real-world regression this fix closes.
    expect(getPersonaKind('verified_human')).toBe('human');
    expect(isAgentPersonaKind('verified_human')).toBe(false);
  });

  it('an agent persona named "John" classifies as agent', () => {
    expect(getPersonaKind('agent_declared')).toBe('agent');
    expect(isAgentPersonaKind('agent_declared')).toBe(true);
  });

  it('a human persona named "aigentAnything" classifies as human', () => {
    expect(getPersonaKind('unverified')).toBe('human');
    expect(isAgentPersonaKind('unverified')).toBe(false);
  });

  it('an absent/null world_id_status defaults to human (fail-closed, never a guess)', () => {
    expect(getPersonaKind(undefined)).toBe('human');
    expect(getPersonaKind(null)).toBe('human');
  });
});

describe('PersonaSelector.tsx and useSupabaseSessionPersonas.ts no longer classify by name', () => {
  it('PersonaSelector.tsx has no name/domain-based agent heuristic', () => {
    const code = stripComments(readSource('app/components/wallet/PersonaSelector.tsx'));
    expect(code, 'the ArcAgent-misclassifying heuristic is back').not.toMatch(
      /name\.includes\(['"]a?i?gent['"]\)/,
    );
    expect(code).not.toMatch(/name\.includes\(['"]agent['"]\)/);
    expect(code).not.toMatch(/domain\.includes\(['"]aigent['"]\)/);
    expect(code).toContain('isAgentPersonaKind');
  });

  it('useSupabaseSessionPersonas.ts has no name-based agent heuristic', () => {
    const code = stripComments(readSource('app/hooks/useSupabaseSessionPersonas.ts'));
    expect(code).not.toMatch(/n\.includes\(['"]agent['"]\)/);
    expect(code).not.toMatch(/h\.includes\(['"]aigent['"]\)/);
    expect(code).toContain('isAgentPersonaKind(worldIdStatus)');
  });
});
