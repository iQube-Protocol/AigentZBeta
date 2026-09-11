// @vitest-environment jsdom
/**
 * SpecialistResponseCard's `onAction` click-through (Factor + Aegis Bankr
 * PRD, Phase 6). Before this change, `availableActions` rendered as inert
 * `<span>` labels regardless of the host; this proves the new contract:
 * omitting `onAction` preserves the old inert rendering exactly (no
 * regression for hosts that haven't opted in), and supplying it turns each
 * action into a real, clickable control that calls back with the exact
 * FactorActionDescriptor clicked.
 */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { SpecialistResponseCard, type SpecialistResponseData } from '../components/metame/cards/SpecialistResponseCard';
import type { FactorActionDescriptor } from '../services/factor/factorCapabilityManifest';

afterEach(() => cleanup());

const explainAction: FactorActionDescriptor = {
  id: 'bankr_tokenization:explain',
  label: 'Explain Bankr tokenization',
  mode: 'explain',
  handlerId: 'factor:explain',
  exposure: 'internal',
  requiresApproval: false,
};

const prepareLaunchAction: FactorActionDescriptor = {
  id: 'bankr_tokenization:prepare_launch',
  label: 'Prepare a launch proposal',
  mode: 'prepare',
  handlerId: 'factor:bankr-prepare-launch',
  exposure: 'moneypenny',
  requiresApproval: false,
  requiredScope: ['agentRef'],
};

const submitAction: FactorActionDescriptor = {
  id: 'bankr_tokenization:submit',
  label: 'Submit an approved launch to Bankr',
  mode: 'execute',
  handlerId: 'factor:bankr-submit',
  exposure: 'external',
  requiresApproval: true,
  requiredAuthority: ['bankr-token-launch-submit'],
};

function baseData(overrides: Partial<SpecialistResponseData> = {}): SpecialistResponseData {
  return {
    specialistId: 'factor',
    specialistLabel: 'Aigent Factor',
    requestType: 'system_guidance',
    title: 'Bankr tokenization',
    summary: 'Real, tested handlers exist for issuer readiness and launch preparation.',
    recommendations: [],
    suggestedArtifacts: [],
    requiresApproval: false,
    confidence: 'medium',
    source: 'template',
    generatedAt: '2026-01-01T00:00:00Z',
    resolvedCapabilityId: 'bankr_tokenization',
    capabilityStatus: 'partial',
    affordance: 'ACTION_AVAILABLE',
    availableActions: [explainAction, prepareLaunchAction, submitAction],
    ...overrides,
  };
}

describe('SpecialistResponseCard availableActions', () => {
  it('renders as inert, non-clickable labels when no onAction is supplied (unchanged prior behavior)', () => {
    render(<SpecialistResponseCard data={baseData()} />);
    const label = screen.getByText('Prepare a launch proposal');
    expect(label.tagName).toBe('SPAN');
  });

    it('renders as clickable buttons when onAction is supplied, and clicking calls back with the exact action', () => {
    const onAction = vi.fn();
    render(<SpecialistResponseCard data={baseData()} onAction={onAction} />);

    const button = screen.getByText('Prepare a launch proposal');
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(prepareLaunchAction);
  });

  it('clicking a different action calls back with THAT action, never a stale or shared reference', () => {
    const onAction = vi.fn();
    render(<SpecialistResponseCard data={baseData()} onAction={onAction} />);

    fireEvent.click(screen.getByText('Submit an approved launch to Bankr'));
    expect(onAction).toHaveBeenCalledWith(submitAction);
    expect(onAction).not.toHaveBeenCalledWith(prepareLaunchAction);
  });

  it('a requiresApproval action still shows its approval marker whether inert or clickable', () => {
    const { rerender } = render(<SpecialistResponseCard data={baseData()} />);
    expect(screen.getByText('Submit an approved launch to Bankr').parentElement?.textContent).toContain('•');

    rerender(<SpecialistResponseCard data={baseData()} onAction={vi.fn()} />);
    expect(screen.getByText('Submit an approved launch to Bankr').textContent).toContain('•');
  });
});
