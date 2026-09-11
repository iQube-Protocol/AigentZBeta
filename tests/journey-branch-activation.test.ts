// @vitest-environment jsdom
/**
 * journeyBranchActivation — AEE-XP-001 §4, Main Spine (2026-09-01
 * correction). Pins: activating a branch persists BOTH the activation flag
 * and the declared intent, keyed per journey+branch (never cross-journey
 * leakage), and dispatches the same `journey:select-stage` event the
 * existing companion-driven navigation already relies on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  activateJourneyBranch,
  isJourneyBranchActivated,
  getJourneyBranchIntent,
} from '@/services/journey/journeyBranchActivation';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('journeyBranchActivation', () => {
  it('a branch is not activated until activateJourneyBranch is called', () => {
    expect(isJourneyBranchActivated('knyts-bridge-crossing', 'financial-services')).toBe(false);
    expect(getJourneyBranchIntent('knyts-bridge-crossing', 'financial-services')).toBeNull();
  });

  it('activateJourneyBranch persists the activation flag and the declared intent', () => {
    activateJourneyBranch('knyts-bridge-crossing', 'financial-services', 'JOIN_FINANCIAL_SERVICES', 'fs-discover');
    expect(isJourneyBranchActivated('knyts-bridge-crossing', 'financial-services')).toBe(true);
    expect(getJourneyBranchIntent('knyts-bridge-crossing', 'financial-services')).toBe('JOIN_FINANCIAL_SERVICES');
  });

  it('dispatches journey:select-stage with the entry stage id', () => {
    const onSelect = vi.fn();
    window.addEventListener('journey:select-stage', onSelect);
    activateJourneyBranch('knyts-bridge-crossing', 'financial-services', 'LEARN_FINANCIAL_SERVICES', 'fs-discover');
    expect(onSelect).toHaveBeenCalledTimes(1);
    const event = onSelect.mock.calls[0][0] as CustomEvent<{ stageId?: string }>;
    expect(event.detail.stageId).toBe('fs-discover');
    window.removeEventListener('journey:select-stage', onSelect);
  });

  it('is scoped per journey id — activating the branch on one journey never activates it on another', () => {
    activateJourneyBranch('knyts-bridge-crossing', 'financial-services', 'JOIN_FINANCIAL_SERVICES', 'fs-discover');
    expect(isJourneyBranchActivated('constitutional-internet-bridge', 'financial-services')).toBe(false);
    expect(getJourneyBranchIntent('constitutional-internet-bridge', 'financial-services')).toBeNull();
  });

  it('is scoped per branch name — activating one branch never activates a differently-named branch on the same journey', () => {
    activateJourneyBranch('knyts-bridge-crossing', 'financial-services', 'JOIN_FINANCIAL_SERVICES', 'fs-discover');
    expect(isJourneyBranchActivated('knyts-bridge-crossing', 'some-other-branch')).toBe(false);
  });
});
