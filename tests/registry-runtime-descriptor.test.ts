/**
 * services/registry/runtimeDescriptor.ts — the Agent Runtime Endpoint,
 * Phase 1 (operator ruling, 2026-08-04).
 *
 * registry_assets.metadata.runtime is authoritative; Agent Cards project it.
 * This file covers ONLY structural validation and deterministic URL
 * resolution — no network call, no reachability test, no invocation. Those
 * are explicitly out of Phase 1 scope (see this file's own header).
 */
import { describe, it, expect } from 'vitest';
import { validateRuntimeDescriptor, resolveRuntimeHealthUrl } from '@/services/registry/runtimeDescriptor';

describe('validateRuntimeDescriptor', () => {
  it('accepts an empty/absent descriptor — every field is optional', () => {
    expect(validateRuntimeDescriptor(null)).toEqual({ ok: true, value: {} });
    expect(validateRuntimeDescriptor(undefined)).toEqual({ ok: true, value: {} });
    expect(validateRuntimeDescriptor({})).toEqual({ ok: true, value: {} });
  });

  it('rejects a non-object input', () => {
    expect(validateRuntimeDescriptor('https://example.test')).toMatchObject({ ok: false });
    expect(validateRuntimeDescriptor(['https://example.test'])).toMatchObject({ ok: false });
  });

  it('accepts a fully populated, well-formed descriptor', () => {
    const result = validateRuntimeDescriptor({
      endpoint: 'https://nakamoto.metame.ai',
      health: '/health',
      invoke: '/invoke',
      protocol: 'mcp',
      version: '1.0',
    });
    expect(result).toEqual({
      ok: true,
      value: { endpoint: 'https://nakamoto.metame.ai', health: '/health', invoke: '/invoke', protocol: 'mcp', version: '1.0' },
    });
  });

  it('requires endpoint to be absolute HTTPS for Pulse eligibility', () => {
    expect(validateRuntimeDescriptor({ endpoint: 'http://nakamoto.metame.ai' })).toMatchObject({ ok: false });
    expect(validateRuntimeDescriptor({ endpoint: 'not-a-url' })).toMatchObject({ ok: false });
  });

  it('rejects embedded credentials in endpoint', () => {
    expect(validateRuntimeDescriptor({ endpoint: 'https://user:pass@nakamoto.metame.ai' })).toMatchObject({ ok: false });
  });

  it.each(['https://localhost', 'https://127.0.0.1', 'https://10.0.0.5', 'https://192.168.1.1', 'https://172.16.0.1', 'https://169.254.1.1'])(
    'rejects loopback/private-network endpoint %s',
    (endpoint) => {
      expect(validateRuntimeDescriptor({ endpoint })).toMatchObject({ ok: false });
    },
  );

  it('normalizes a trailing slash off endpoint deterministically', () => {
    const result = validateRuntimeDescriptor({ endpoint: 'https://nakamoto.metame.ai/' });
    expect(result).toMatchObject({ ok: true, value: { endpoint: 'https://nakamoto.metame.ai' } });
  });

  it('accepts health/invoke as a relative path starting with "/"', () => {
    expect(validateRuntimeDescriptor({ health: '/health' })).toEqual({ ok: true, value: { health: '/health' } });
    expect(validateRuntimeDescriptor({ invoke: '/invoke' })).toEqual({ ok: true, value: { invoke: '/invoke' } });
  });

  it('rejects health/invoke as a bare non-rooted string (neither absolute nor a path)', () => {
    expect(validateRuntimeDescriptor({ health: 'health' })).toMatchObject({ ok: false });
  });

  it('accepts health/invoke as an absolute HTTPS URL and rejects a non-HTTPS one', () => {
    expect(validateRuntimeDescriptor({ health: 'https://status.example.test/nakamoto' })).toMatchObject({ ok: true });
    expect(validateRuntimeDescriptor({ health: 'http://status.example.test/nakamoto' })).toMatchObject({ ok: false });
  });

  it('protocol is an open string, not a closed enum', () => {
    expect(validateRuntimeDescriptor({ protocol: 'some-future-platform' })).toEqual({ ok: true, value: { protocol: 'some-future-platform' } });
  });
});

describe('resolveRuntimeHealthUrl — deterministic derivation (operator ruling, 2026-08-04)', () => {
  it('no endpoint → null, regardless of health', () => {
    expect(resolveRuntimeHealthUrl({ health: '/health' })).toBeNull();
    expect(resolveRuntimeHealthUrl(null)).toBeNull();
    expect(resolveRuntimeHealthUrl(undefined)).toBeNull();
  });

  it('no health field → use endpoint', () => {
    expect(resolveRuntimeHealthUrl({ endpoint: 'https://nakamoto.metame.ai' })).toBe('https://nakamoto.metame.ai');
  });

  it('relative health path → resolve against endpoint', () => {
    expect(resolveRuntimeHealthUrl({ endpoint: 'https://nakamoto.metame.ai', health: '/health' })).toBe('https://nakamoto.metame.ai/health');
  });

  it('absolute health URL → use it, ignoring endpoint entirely', () => {
    expect(
      resolveRuntimeHealthUrl({ endpoint: 'https://nakamoto.metame.ai', health: 'https://status.example.test/nakamoto' }),
    ).toBe('https://status.example.test/nakamoto');
  });
});
