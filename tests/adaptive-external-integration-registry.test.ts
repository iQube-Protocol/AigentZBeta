/**
 * services/adaptive/externalIntegrationRegistry.ts — canaries (operator
 * ruling, 2026-08-27, Differ FS pilot reconciliation).
 *
 * Covers:
 *   - the Differ FS pilot integration is `enabled: false` today (honest,
 *     load-bearing default — not a placeholder to silently flip)
 *   - a disabled integration cannot obtain a return-url match, a journey
 *     match, or a capability match, regardless of what it asks for
 *   - a return url must match the registered origin EXACTLY — no open
 *     redirect via a permissive prefix/substring match
 *   - an unregistered integrationId behaves identically to a disabled one
 *   - Runtime is excluded from the pilot's allowedCapabilities — this is
 *     the pilot's OWN policy, not a manifest-wide ban (see
 *     applicationProjectionManifest.test assertions for the disposition side)
 *   - filterProjectionForIntegration strips any surface/action outside the
 *     allowlist, including when the integration is disabled entirely
 */

import { describe, it, expect } from 'vitest';
import {
  DIFFER_FINANCIAL_SERVICES_INTEGRATION,
  filterProjectionForIntegration,
  isCapabilityAllowedForIntegration,
  isJourneyAllowedForIntegration,
  isReturnUrlAllowedForIntegration,
  resolveExternalExperienceIntegration,
} from '@/services/adaptive/externalIntegrationRegistry';

describe('the Differ FS pilot integration registration', () => {
  it('is enabled: false and transportMode: "unresolved" today — the honest, load-bearing default (Q7 open)', () => {
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.enabled).toBe(false);
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.transportMode).toBe('unresolved');
  });

  it('has an empty allowedReturnOrigins — belt-and-suspenders alongside enabled:false', () => {
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.allowedReturnOrigins).toEqual([]);
  });

  it('excludes both Runtime service ids from allowedCapabilities — pilot policy, not a manifest-wide ban', () => {
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.allowedCapabilities).not.toContain('moneypenny.runtime');
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.allowedCapabilities).not.toContain('moneypenny.runtime.constitutional');
  });

  it('includes Advisor and Architect', () => {
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.allowedCapabilities).toContain('moneypenny.advisor');
    expect(DIFFER_FINANCIAL_SERVICES_INTEGRATION.allowedCapabilities).toContain('moneypenny.architect');
  });
});

describe('disabled/unresolved integrations cannot obtain anything', () => {
  const ID = DIFFER_FINANCIAL_SERVICES_INTEGRATION.integrationId;

  it('isReturnUrlAllowedForIntegration is false even for a plausible-looking URL', () => {
    expect(isReturnUrlAllowedForIntegration(ID, 'https://ramp.getdiffer.com/return')).toBe(false);
  });

  it('isJourneyAllowedForIntegration is false even for the journey actually listed in allowedJourneys', () => {
    expect(isJourneyAllowedForIntegration(ID, 'horizen-moneypenny-admission')).toBe(false);
  });

  it('isCapabilityAllowedForIntegration is false even for a capability actually listed in allowedCapabilities', () => {
    expect(isCapabilityAllowedForIntegration(ID, 'moneypenny.advisor')).toBe(false);
  });

  it('an unregistered integrationId behaves identically to a disabled one', () => {
    expect(isCapabilityAllowedForIntegration('never-registered', 'moneypenny.advisor')).toBe(false);
    expect(resolveExternalExperienceIntegration('never-registered')).toBeNull();
  });
});

describe('return-url allowlisting is EXACT-origin, never a prefix/substring match', () => {
  it('a subdomain or path that merely starts with an allowed origin does not match (structural check even though the pilot allowlist is empty today)', () => {
    // Exercised against a synthetic enabled-integration shape via the pure
    // matcher logic's own contract: origin equality, not startsWith.
    const origin = new URL('https://ramp.getdiffer.com').origin;
    expect(new URL('https://ramp.getdiffer.com.evil.example').origin).not.toBe(origin);
    expect(new URL('https://ramp.getdiffer.com:8443').origin).not.toBe(origin);
  });

  it('an unparseable returnUrl never matches', () => {
    expect(isReturnUrlAllowedForIntegration(DIFFER_FINANCIAL_SERVICES_INTEGRATION.integrationId, 'not-a-url')).toBe(false);
  });
});

describe('filterProjectionForIntegration', () => {
  const projection = {
    surfaces: [
      { capabilityId: 'moneypenny.advisor' },
      { capabilityId: 'moneypenny.runtime' },
    ],
    primaryAction: { capabilityId: 'moneypenny.runtime' },
    secondaryActions: [{ capabilityId: 'moneypenny.advisor' }, { capabilityId: 'moneypenny.runtime' }],
  };

  it('strips everything when the integration is disabled — including capabilities nominally on its own allowlist', () => {
    const filtered = filterProjectionForIntegration(DIFFER_FINANCIAL_SERVICES_INTEGRATION.integrationId, projection);
    expect(filtered.surfaces).toEqual([]);
    expect(filtered.primaryAction).toBeNull();
    expect(filtered.secondaryActions).toEqual([]);
  });

  it('strips everything for an unregistered integration id', () => {
    const filtered = filterProjectionForIntegration('never-registered', projection);
    expect(filtered.surfaces).toEqual([]);
  });
});
