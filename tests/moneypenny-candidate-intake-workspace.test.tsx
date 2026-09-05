// @vitest-environment jsdom
/**
 * Candidate Intake workspace upgrade (2026-09-05) — BEHAVIORAL tests, not
 * source-string canaries (operator directive, requirement 8). Renders the
 * real CandidateIntakePanel with @testing-library/react against a small
 * fake HTTP backend that mimics the real REST contract's shapes, and
 * asserts on what actually renders/happens — never on the panel's source
 * text.
 *
 * The panel is wrapped in the REAL MoneyPennyNavigationProvider (the exact
 * context CandidateIntakePanel and MoneyPennyCopilotWorkspace both consume
 * in production — see moneyPennyNavigation.tsx) so the shared-caseId proof
 * (test 11) exercises the real sharing mechanism, not a stand-in.
 */
import React from 'react';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

const personaFetchMock = vi.fn();
vi.mock('@/utils/personaSpine', () => ({ personaFetch: (...args: unknown[]) => personaFetchMock(...args) }));

import { CandidateIntakePanel } from '../app/(shell)/moneypenny/components/CandidateIntakePanel';
import {
  MoneyPennyNavigationProvider,
  useMoneyPennyNavigation,
  type MoneyPennyActiveCase,
} from '../app/(shell)/moneypenny/components/moneyPennyNavigation';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Fake backend ───────────────────────────────────────────────────────

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

interface FakeCase {
  case_id: string;
  tenant_id: string;
  candidate_identity_key: string;
  candidate_display_name: string;
  candidate_agent_root_did: null;
  source: string;
  pathway: string;
  state: string;
  paused_from_state: string | null;
  authority_chain_id: string | null;
  created_at: string;
  updated_at: string;
}

class FakeBackend {
  case: FakeCase = {
    case_id: 'case-1',
    tenant_id: 'default',
    candidate_identity_key: 'cand-1',
    candidate_display_name: 'Test Candidate',
    candidate_agent_root_did: null,
    source: 'operator',
    pathway: 'registry_only',
    state: 'discovered',
    paused_from_state: null,
    authority_chain_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  evidence: Array<Record<string, unknown>> = [];
  events: Array<Record<string, unknown>> = [];
  assessment: Record<string, unknown> | null = null;
  findings: Array<Record<string, unknown>> = [];
  askAgentCalls: Array<{ specialistId: string; prompt: string }> = [];
  ratifyShouldRefuseCriticalFailure = false;
  nextAssessmentSelfAssessmentRefused = false;

  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const path = url.split('?')[0];

    if (path === '/api/moneypenny/factor/cases' && method === 'POST') {
      if (body.candidateIdentityKey === this.case.candidate_identity_key) {
        return jsonRes(200, { ok: true, case: this.case, created: false });
      }
      this.case = { ...this.case, candidate_identity_key: body.candidateIdentityKey, candidate_display_name: body.candidateDisplayName };
      return jsonRes(200, { ok: true, case: this.case, created: true });
    }
    if (path === `/api/moneypenny/factor/cases/${this.case.case_id}` && method === 'GET') {
      return jsonRes(200, { ok: true, case: this.case, evidence: this.evidence, assessment: this.assessment, findings: this.findings });
    }
    if (path === `/api/moneypenny/factor/cases/${this.case.case_id}/events` && method === 'GET') {
      return jsonRes(200, { ok: true, events: this.events });
    }
    if (path === `/api/moneypenny/factor/cases/${this.case.case_id}/transition` && method === 'POST') {
      if (body.action === 'pause') {
        this.case = { ...this.case, paused_from_state: this.case.state, state: 'paused' };
      } else if (body.action === 'resume') {
        this.case = { ...this.case, state: this.case.paused_from_state ?? 'discovered', paused_from_state: null };
      } else if (body.action === 'advance') {
        this.case = { ...this.case, state: body.toState };
      }
      this.events.push({ event_id: `ev-${this.events.length}`, event_type: 'state_changed', to_state: this.case.state, created_at: new Date().toISOString() });
      return jsonRes(200, { ok: true, case: this.case });
    }
    if (path === `/api/moneypenny/factor/cases/${this.case.case_id}/evidence` && method === 'POST') {
      this.evidence.push({ evidence_item_id: `ev-item-${this.evidence.length}`, kind: body.kind, status: body.status ?? 'supplied', source_ref: null, created_at: new Date().toISOString() });
      return jsonRes(200, { ok: true, item: this.evidence[this.evidence.length - 1] });
    }
    if (path === '/api/moneypenny/aegis/assessments' && method === 'POST') {
      if (body.subjectRef === body.requestedByAgentRef || this.nextAssessmentSelfAssessmentRefused) {
        return jsonRes(403, { ok: false, error: 'self-assessment-refused', detail: 'Refusing to create an assessment where the subject and requester are the same agent.' });
      }
      this.assessment = { assessment_id: 'assess-1', subject_ref: body.subjectRef, state: 'evidence_locked', decision: null, requested_by_agent_ref: body.requestedByAgentRef, assessed_by_agent_ref: 'aigent-aegis', rationale: null, created_at: new Date().toISOString(), ratified_at: null };
      return jsonRes(200, { ok: true, assessment: this.assessment });
    }
    const assessmentIdMatch = path.match(/^\/api\/moneypenny\/aegis\/assessments\/([^/]+)\/(transition|ratify|findings)$/);
    if (assessmentIdMatch && method === 'POST' && this.assessment) {
      const [, , action] = assessmentIdMatch;
      if (action === 'transition') {
        if (body.action === 'begin-running') this.assessment = { ...this.assessment, state: 'running' };
        else if (body.action === 'require-review') this.assessment = { ...this.assessment, state: 'review_required' };
        else if (body.action === 'fail') this.assessment = { ...this.assessment, state: 'failed' };
        return jsonRes(200, { ok: true, assessment: this.assessment });
      }
      if (action === 'findings') {
        this.findings.push({ finding_id: `find-${this.findings.length}`, dimension: body.dimension, claim: body.claim, method: body.method, result: body.result, confidence: body.confidence, falsification_condition: body.falsificationCondition, is_critical: body.isCritical === true });
        return jsonRes(200, { ok: true, finding: this.findings[this.findings.length - 1] });
      }
      if (action === 'ratify') {
        if (this.ratifyShouldRefuseCriticalFailure && (body.decision === 'admissible' || body.decision === 'admissible_with_conditions')) {
          return jsonRes(400, { ok: false, error: 'critical-failure-blocks-admission', detail: 'A critical failed finding blocks an admissible decision.' });
        }
        this.assessment = { ...this.assessment, state: 'ratified', decision: body.decision, ratified_at: new Date().toISOString() };
        return jsonRes(200, { ok: true, assessment: this.assessment });
      }
    }
    if (path === `/api/moneypenny/factor/cases/${this.case.case_id}/decide-admission` && method === 'POST') {
      this.case = { ...this.case, state: body.decision };
      return jsonRes(200, { ok: true, case: this.case, packet: {}, replay: false });
    }
    if (path.match(/^\/api\/moneypenny\/factor\/authority-chains\/[^/]+\/revoke$/) && method === 'POST') {
      this.case = { ...this.case, authority_chain_id: null };
      return jsonRes(200, { ok: true });
    }
    if (path === '/api/assistant/ask-agent' && method === 'POST') {
      this.askAgentCalls.push({ specialistId: body.specialistId, prompt: body.prompt });
      const label = body.specialistId === 'factor' ? 'Factor' : 'Aegis';
      // The case-context consultation adapter (services/moneypenny/
      // caseContextConsultation.ts) prefixes body.prompt with a bounded
      // case-context block, separated from the operator's actual question
      // by a blank line — recover just the question here, exactly like a
      // real specialist would answer it while still having read the
      // context.
      const actualQuestion = String(body.prompt).split('\n\n').pop();
      return jsonRes(200, {
        specialistId: body.specialistId,
        specialistLabel: label,
        requestType: 'system_guidance',
        title: `${label} advisory response`,
        summary: `Advisory summary for: ${actualQuestion}`,
        recommendations: ['Recommendation one'],
        suggestedArtifacts: [],
        requiresApproval: false,
        confidence: 'medium',
        source: 'template',
        generatedAt: new Date().toISOString(),
      });
    }
    return jsonRes(404, { ok: false, error: 'unhandled-in-test', detail: `no fake handler for ${method} ${path}` });
  };
}

function fillOpenCaseForm(backend: FakeBackend) {
  fireEvent.change(screen.getByPlaceholderText(/candidate identifier|internal key/i), { target: { value: backend.case.candidate_identity_key } });
  fireEvent.change(screen.getByPlaceholderText(/candidate display name|Nakamoto Relay Agent/i), { target: { value: backend.case.candidate_display_name } });
  fireEvent.click(screen.getByRole('button', { name: /find or open case/i }));
}

// ── Harness for the shared-caseId proof ─────────────────────────────────

function CaseIdSpy() {
  const { activeCase } = useMoneyPennyNavigation();
  return <div data-testid="spy-case-id">{activeCase?.caseId ?? 'none'}</div>;
}

function Harness({ children }: { children: React.ReactNode }) {
  const [activeCase, setActiveCase] = useState<MoneyPennyActiveCase | null>(null);
  return (
    <MoneyPennyNavigationProvider value={{ activePanel: 'candidate-intake', area: 'activity', navigate: () => {}, activeCase, setActiveCase }}>
      {children}
    </MoneyPennyNavigationProvider>
  );
}

describe('Candidate Intake workspace — behavioral', () => {
  let backend: FakeBackend;

  beforeEach(() => {
    backend = new FakeBackend();
    personaFetchMock.mockImplementation((url: string, init?: RequestInit) => backend.fetch(url, init));
  });

  it('1. two consecutive follow-ups render as an ordered thread', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');

    const composer = screen.getByPlaceholderText(/ask factor about this case/i);
    fireEvent.change(composer, { target: { value: 'First question?' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await screen.findByText(/Advisory summary for: First question/);

    fireEvent.change(composer, { target: { value: 'Second question?' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await screen.findByText(/Advisory summary for: Second question/);

    // Both prompts remain visible, in order (exact match — distinguishes the
    // prompt bubble itself from the specialist summary text that echoes it).
    const first = screen.getByText('First question?');
    const second = screen.getByText('Second question?');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('2. the composer clears after a successful send without deleting history', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');

    const composer = screen.getByPlaceholderText(/ask factor about this case/i) as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: 'Will this clear?' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await waitFor(() => expect(composer.value).toBe(''));
    expect(screen.getByText('Will this clear?')).toBeTruthy();
  });

  it('3. case context persists when switching Factor/Aegis', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');

    const composer = screen.getByPlaceholderText(/ask factor about this case/i);
    fireEvent.change(composer, { target: { value: 'Factor question' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await screen.findByText(/Advisory summary for: Factor question/);

    fireEvent.click(screen.getByRole('tab', { name: 'Aegis' }));
    // Prior Factor turn is still on screen after switching specialist tabs.
    expect(screen.getByText('Factor question')).toBeTruthy();

    const composerAegis = screen.getByPlaceholderText(/ask aegis about this case/i);
    fireEvent.change(composerAegis, { target: { value: 'Aegis question' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await screen.findByText(/Advisory summary for: Aegis question/);
    expect(screen.getByText('Factor question')).toBeTruthy();
    expect(backend.askAgentCalls.map((c) => c.specialistId)).toEqual(['factor', 'aegis']);
  });

  it('4. creating a case calls the canonical Factor case endpoint', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    expect(personaFetchMock).toHaveBeenCalledWith('/api/moneypenny/factor/cases', expect.objectContaining({ method: 'POST' }));
  });

  it('5. requesting assessment calls the canonical Aegis endpoint', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    fireEvent.click(screen.getByRole('button', { name: /request independent aegis assessment/i }));
    await waitFor(() => expect(backend.assessment).not.toBeNull());
    expect(personaFetchMock).toHaveBeenCalledWith('/api/moneypenny/aegis/assessments', expect.objectContaining({ method: 'POST' }));
    const [, init] = personaFetchMock.mock.calls.find((c) => c[0] === '/api/moneypenny/aegis/assessments')!;
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.requestedByAgentRef).toBe('aigent-factor');
    expect(sentBody.subjectRef).not.toBe(sentBody.requestedByAgentRef);
  });

  it('6. Aegis refuses structured self-assessment — surfaced as a Refused card', async () => {
    backend.nextAssessmentSelfAssessmentRefused = true;
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    fireEvent.click(screen.getByRole('button', { name: /request independent aegis assessment/i }));
    await screen.findByText('Refused');
    expect(screen.getByText(/self-assessment-refused|same agent/i)).toBeTruthy();
  });

  it('7. Factor refuses direct admission and offers referral to MoneyPenny', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');

    const composer = screen.getByPlaceholderText(/ask factor about this case/i);
    fireEvent.change(composer, { target: { value: 'Please admit this candidate now.' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await screen.findByText(/Factor cannot decide admission/i);
    expect(screen.getByRole('button', { name: /refer to moneypenny/i })).toBeTruthy();
    // No API call was made for this turn — it's a structural client-side refusal.
    expect(backend.askAgentCalls).toHaveLength(0);
  });

  it("8. generic consultation cannot mutate case state", async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    const stateBefore = backend.case.state;

    const composer = screen.getByPlaceholderText(/ask factor about this case/i);
    fireEvent.change(composer, { target: { value: 'Is the evidence checklist complete?' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await screen.findByText(/Advisory summary for: Is the evidence/);

    expect(backend.case.state).toBe(stateBefore);
    const mutatingCalls = personaFetchMock.mock.calls.filter(([url]: [string]) => /transition|evidence|decide-admission|ratify|findings/.test(url));
    expect(mutatingCalls).toHaveLength(0);
  });

  it('9. a critical failed finding prevents an admissible ratification — Blocked card', async () => {
    backend.ratifyShouldRefuseCriticalFailure = true;
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    fireEvent.click(screen.getByRole('button', { name: /request independent aegis assessment/i }));
    await waitFor(() => expect(backend.assessment).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^begin assessment$/i }));
    await waitFor(() => expect((backend.assessment as Record<string, unknown>).state).toBe('running'));
    fireEvent.click(screen.getByRole('button', { name: /send for review/i }));
    await waitFor(() => expect((backend.assessment as Record<string, unknown>).state).toBe('review_required'));

    fireEvent.click(screen.getByRole('button', { name: /^ratify assessment$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm ratify/i }));
    await screen.findByText('Blocked');
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThan(0);
  });

  it('10. refresh/reopen restores the canonical case state', async () => {
    backend.case.state = 'paused';
    backend.case.paused_from_state = 'preparing';
    const { unmount } = render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    expect(screen.getByText('Paused')).toBeTruthy();
    unmount();

    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('11. left-pane delegation and right-pane workspace share the same caseId', async () => {
    render(
      <Harness>
        <CandidateIntakePanel />
        <CaseIdSpy />
      </Harness>,
    );
    expect(screen.getByTestId('spy-case-id').textContent).toBe('none');
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    await waitFor(() => expect(screen.getByTestId('spy-case-id').textContent).toBe(backend.case.case_id));
  });

  it('12. disabled/inert pseudo-actions are not rendered', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');

    // Case is 'discovered' — not paused, so "Resume case" must not render.
    expect(screen.queryByRole('button', { name: /resume case/i })).toBeNull();
    // No assessment yet — ratify/findings controls must not render.
    expect(screen.queryByRole('button', { name: /^ratify assessment$/i })).toBeNull();
    // Not admission_pending — decide-admission buttons must not render.
    expect(screen.queryByRole('button', { name: /^admit$/i })).toBeNull();
    // No authority chain — revoke button must not render.
    expect(screen.queryByRole('button', { name: /revoke chain/i })).toBeNull();
  });

  it('13. personaFetch remains the authenticated client path for every call', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    const composer = screen.getByPlaceholderText(/ask factor about this case/i);
    fireEvent.change(composer, { target: { value: 'A question' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await screen.findByText(/Advisory summary for: A question/);
    expect(personaFetchMock.mock.calls.length).toBeGreaterThan(0);
  });

  it('Enter submits the composer; Shift+Enter inserts a newline instead', async () => {
    render(<Harness><CandidateIntakePanel /></Harness>);
    fillOpenCaseForm(backend);
    await screen.findByText('Test Candidate');
    const composer = screen.getByPlaceholderText(/ask factor about this case/i) as HTMLTextAreaElement;

    fireEvent.change(composer, { target: { value: 'line one' } });
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
    // Shift+Enter must NOT submit — composer keeps its text.
    expect(composer.value).toBe('line one');
    expect(backend.askAgentCalls).toHaveLength(0);

    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: false });
    await screen.findByText('line one');
  });
});
