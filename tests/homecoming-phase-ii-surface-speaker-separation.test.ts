/**
 * aigentMe Agent Projection — P0 Item 1 (operator brief 2026-08-16,
 * "aigentMe Agent Projection + Wallet Consistency + Persona-Type Cleanup").
 *
 * The defect: buildSystemPrompt() gated aigentMe-specific surface context
 * (ExperienceQube/PersonalGuide metaMe context, right-pane groundContext,
 * attached-upload blocks, layout-control instructions) on the RESOLVED
 * SPEAKER id (`resolvedPersonaId`, derived from `aigentId`). When a
 * non-default agent (e.g. Aletheon) is assigned to the aigentMe ROLE,
 * `aigentId` carries the speaker ('aigent-aletheon'), not the surface
 * ('aigent-me') — so the gate silently missed and the surface context
 * vanished. Selecting a different speaker for a role must never change
 * which surface's context the model receives.
 *
 * The fix adds a `surfaceRoleId` parameter (defaulting to `aigentId`, so
 * every other existing caller is unaffected) and a `surfaceId` binding
 * that every surface-context gate keys on instead of the speaker.
 *
 * This is a live behavioural test (not a source-text canary): it imports
 * the real `buildSystemPrompt` and asserts on its actual return value, so
 * it proves the composition, not merely that the right tokens appear in
 * the source.
 */

import { describe, it, expect } from 'vitest';

// route.ts constructs a module-level Supabase client at import time
// (`createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)`), which
// throws on undefined args even though buildSystemPrompt itself makes no
// network calls. Stub minimal, syntactically-valid values before import —
// no real client method is ever invoked by this test.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { buildSystemPrompt } = await import('@/app/api/codex/chat/route');

const metadata = {
  characters: [],
  episodes: [],
  stats: { characterCount: 0, episodeCount: 0, coverCount: 0, masterCount: 0 },
};

const ALETHEON_IDENTITY_MARKER =
  "You are Aletheon — the First Citizen's Constitutional Companion Intelligence";
const ATTACHED_UPLOAD_MARKER = '<attached_file id="test-upload-marker-aletheon">';
const METAME_EXPERIENCE_MARKER = 'Constitutional Reasoning Sprint';
const GROUND_CONTEXT_NBA_MARKER = 'First Citizen Daily Ledger';
const AIGENT_ME_LAYOUT_CONTROL_MARKER = 'brief, decision-board, venture-cockpit, specialists';

function buildAletheonUserContext() {
  return {
    domain: 'protocol',
    roles: ['fan'],
    primaryRole: 'fan',
    metameContext: {
      experienceName: METAME_EXPERIENCE_MARKER,
      primaryGoal: 'Ratify the delegation framework',
    },
    groundContext: {
      brief: {
        experienceName: GROUND_CONTEXT_NBA_MARKER,
        nextBestActions: [
          { label: 'Review the standing pack', cartridge: 'agentiq', rationale: 'Because it is due.' },
        ],
      },
    },
    attachedUploadsBlock: `\n\n## Attached uploads\n\n${ATTACHED_UPLOAD_MARKER}`,
  } as any;
}

describe('buildSystemPrompt — surfaceRoleId is separate from the speaker (aigentId)', () => {
  it('Aletheon assigned to the aigentMe role receives BOTH her own identity AND the complete aigentMe surface context', () => {
    const result = buildSystemPrompt(
      metadata as any,
      'aigent-aletheon',
      buildAletheonUserContext(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'aigent-me',
    );

    // (1) Aletheon's own identity/voice — WHO is speaking.
    expect(result).toContain(ALETHEON_IDENTITY_MARKER);

    // (2) The complete aigentMe surface context — WHERE she is speaking.
    expect(result, 'metaMe ExperienceQube/PersonalGuide context missing').toContain(METAME_EXPERIENCE_MARKER);
    expect(result, 'right-pane NBA-shaped groundContext missing').toContain(GROUND_CONTEXT_NBA_MARKER);
    expect(result, 'attached-uploads block missing').toContain(ATTACHED_UPLOAD_MARKER);
    expect(result, 'aigentMe layout-control instructions missing').toContain(AIGENT_ME_LAYOUT_CONTROL_MARKER);
  });

  it('regression proof: WITHOUT surfaceRoleId, a non-default speaker silently loses the aigentMe surface context (the original defect)', () => {
    // Same call, but surfaceRoleId omitted — surfaceId falls back to
    // aigentId ('aigent-aletheon'), reproducing the pre-fix behaviour.
    const result = buildSystemPrompt(
      metadata as any,
      'aigent-aletheon',
      buildAletheonUserContext(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    // Her own identity is always present — the defect was never about voice.
    expect(result).toContain(ALETHEON_IDENTITY_MARKER);

    // Every aigentMe-gated surface block is absent — this is the bug this
    // fix closes. If any of these regress to `toContain`, the fix has been
    // silently reverted (surfaceId defaulted back to matching aigentId).
    expect(result).not.toContain(METAME_EXPERIENCE_MARKER);
    expect(result).not.toContain(GROUND_CONTEXT_NBA_MARKER);
    expect(result).not.toContain(ATTACHED_UPLOAD_MARKER);
    expect(result).not.toContain(AIGENT_ME_LAYOUT_CONTROL_MARKER);
  });

  it('a default caller (no surfaceRoleId, aigentId already the surface) is completely unaffected', () => {
    // The primary aigentMe surface calling with its own agent id directly
    // (the overwhelming majority of real call sites) must see identical
    // behaviour before and after this change.
    const withDefault = buildSystemPrompt(
      metadata as any,
      'aigent-me',
      buildAletheonUserContext(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const withExplicitSurface = buildSystemPrompt(
      metadata as any,
      'aigent-me',
      buildAletheonUserContext(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'aigent-me',
    );

    expect(withDefault).toBe(withExplicitSurface);
    expect(withDefault).toContain(METAME_EXPERIENCE_MARKER);
    expect(withDefault).toContain(AIGENT_ME_LAYOUT_CONTROL_MARKER);
  });
});
