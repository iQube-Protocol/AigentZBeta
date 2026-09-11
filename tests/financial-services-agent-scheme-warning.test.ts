/**
 * FinancialServicesTab — agent-identifier-scheme mismatch warning
 * (operator report, 2026-08-06: an agreement got formed+authorized for
 * "agr-cap-financial-intelligence-agent-nakamoto", which never matched the
 * real runtime invocation's "aigent-nakamoto" — a different identifier
 * scheme from the one the Journey Ratify stage displays a screen away
 * ("agent-<slug>"). Both schemes are real and both in live use; the
 * FinancialServicesTab's Agent field could silently hold a stale/mismatched
 * value between mount and the Agent Bench fetch resolving, with no visible
 * sign anything was wrong until the "not found" 400 on Authorize.
 *
 * Fix: show the exact agreementId this panel is about to bind, and warn
 * inline when the current agentRef is not one of the known Service Ready
 * agents — catching the mismatch before the click, not after.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PATH = 'app/triad/components/codex/tabs/FinancialServicesTab.tsx';

describe('FinancialServicesTab: agent-scheme mismatch is visible before Authorize', () => {
  const code = () => stripComments(readSource(PATH));

  it('shows the exact agreementId that Form/Accept/Authorize will bind', () => {
    const c = code();
    expect(c).toMatch(/Will bind:[\s\S]{0,80}\{agreementId\}/);
  });

  it('warns when the current agentRef does not match any known Service Ready agent', () => {
    const c = code();
    expect(c).toMatch(/!agentOptions\.some\(\(o\) => o\.id === agentRef\)/);
    expect(c).toContain('is not one of the Service Ready agents');
  });
});
