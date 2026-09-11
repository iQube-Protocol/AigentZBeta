/**
 * Role-based authoritative persona resolution (services/workflows/
 * identityEnvelope.ts) — Aigent Z as the platform-state reporter.
 *
 * Operator ruling (2026-07-30, superseding an earlier suggestion that
 * MoneyPenny would become the report producer): the daily/weekly Horizen
 * workspace report is produced by Aigent Z, based on authoritative platform
 * state. MoneyPenny remains the Financial Services Runtime orchestrator and
 * may supply financial-services evidence into the report, but never becomes
 * the report producer. `platform-state-reporter -> aigentz@aigent` is the
 * deterministic role mapping that encodes this.
 *
 * What these guard:
 *  1. The role resolves to exactly one persona (aigentz@aigent) when that
 *     persona is present in the authoritative registry.
 *  2. The resolver fails CLOSED — throws — when zero personas in the
 *     registry satisfy the role (never falls back to a guess).
 *  3. The resolver fails CLOSED when more than one persona would satisfy the
 *     role (ambiguous — refuses to silently pick one).
 *  4. Resolution reads the SAME WORKFLOW_AUTHORITATIVE_PERSONAS registry the
 *     pipeline-authority gate uses — no parallel allowlist.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveAuthoritativePersonaForRole,
  resolveExactlyOneAuthoritativePersona,
  type AuthoritativeRole,
} from '../services/workflows/identityEnvelope';

const ORIGINAL_ENV = process.env.WORKFLOW_AUTHORITATIVE_PERSONAS;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.WORKFLOW_AUTHORITATIVE_PERSONAS;
  else process.env.WORKFLOW_AUTHORITATIVE_PERSONAS = ORIGINAL_ENV;
});

describe('platform-state-reporter role resolves to aigentz@aigent', () => {
  it('resolves when aigentz@aigent is present in an explicit registry', () => {
    const registry = ['aigentz@aigent', 'marketa@aigent', 'qriptiq@qripto', 'aigent-marketa@aigent'];
    expect(resolveAuthoritativePersonaForRole('platform-state-reporter', registry)).toBe('aigentz@aigent');
  });

  it('resolves from the live WORKFLOW_AUTHORITATIVE_PERSONAS env var', () => {
    process.env.WORKFLOW_AUTHORITATIVE_PERSONAS =
      'aigentz@aigent,marketa@aigent,qriptiq@qripto,aigent-marketa@aigent';
    expect(resolveAuthoritativePersonaForRole('platform-state-reporter')).toBe('aigentz@aigent');
  });

  it('resolves from the built-in default registry when the env var is unset', () => {
    delete process.env.WORKFLOW_AUTHORITATIVE_PERSONAS;
    expect(resolveAuthoritativePersonaForRole('platform-state-reporter')).toBe('aigentz@aigent');
  });

  it('never resolves to MoneyPenny or any other agent for this role', () => {
    const registry = ['aigentz@aigent', 'marketa@aigent', 'qriptiq@qripto', 'aigent-marketa@aigent'];
    expect(resolveAuthoritativePersonaForRole('platform-state-reporter', registry)).not.toBe('marketa@aigent');
  });
});

describe('fail-closed: zero or ambiguous matches never resolve', () => {
  it('throws when the registry is empty', () => {
    expect(() => resolveAuthoritativePersonaForRole('platform-state-reporter', [])).toThrow(
      /no persona in the authoritative registry satisfies this role/i,
    );
  });

  it('throws when the registry does not contain the mapped candidate', () => {
    const registry = ['marketa@aigent', 'qriptiq@qripto'];
    expect(() => resolveAuthoritativePersonaForRole('platform-state-reporter', registry)).toThrow(
      /refusing to guess an actor/i,
    );
  });

  it('throws when an unmapped role is requested', () => {
    expect(() =>
      resolveAuthoritativePersonaForRole('not-a-real-role' as AuthoritativeRole, ['aigentz@aigent']),
    ).toThrow(/no persona is mapped to authoritative role/i);
  });

  it('the fail-closed core throws on zero matches', () => {
    expect(() => resolveExactlyOneAuthoritativePersona(['ghost@nowhere'], ['aigentz@aigent'])).toThrow(
      /refusing to guess an actor/i,
    );
  });

  it('the fail-closed core throws on ambiguous (multiple) matches', () => {
    // A role with two eligible candidates, both present in the registry —
    // the resolver must refuse to silently pick one.
    expect(() =>
      resolveExactlyOneAuthoritativePersona(
        ['aigentz@aigent', 'aigent-marketa@aigent'],
        ['aigentz@aigent', 'aigent-marketa@aigent', 'qriptiq@qripto'],
      ),
    ).toThrow(/ambiguous, refusing to pick one/i);
  });

  it('never returns undefined/empty string on failure paths — it always throws', () => {
    expect(() => resolveExactlyOneAuthoritativePersona([], [])).toThrow();
    expect(() => resolveExactlyOneAuthoritativePersona(['aigentz@aigent'], [])).toThrow();
  });
});
