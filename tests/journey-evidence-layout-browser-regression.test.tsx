// @vitest-environment jsdom
/**
 * REAL-BROWSER layout regression for the header Evidence control (surgical
 * repair, 2026-09-06). Replaces the class-name-only jsdom "backdrop" test
 * that shipped with commit 3ba5ef913 — that test asserted the presence of
 * `bg-slate-950/70` and called it "opaque"/"collision-safe" purely from a
 * className string, which certified the exact broken, translucent-modal
 * experience the operator reported from live screenshots. Checking a class
 * name is not checking a layout.
 *
 * This test drives REAL Chromium (via `playwright-core`, already vendored in
 * this repo — see /opt/pw-browsers) against the REAL rendered DOM: the
 * component tree is rendered once with @testing-library/react + jsdom (the
 * same harness and mocks as
 * tests/journey-run-surface-evidence-popover-overlap.test.tsx), its
 * `container.innerHTML` is captured in both the Evidence-collapsed and
 * Evidence-expanded states, and each snapshot is loaded into a real browser
 * page styled with the PROJECT'S OWN compiled Tailwind CSS (via the
 * `tailwindcss` CLI, content-scanned against the actual captured markup —
 * never a hand-approximated stylesheet). Screenshots are saved to
 * test-artifacts/ for human review alongside this report.
 *
 * Proves, with a real layout engine:
 *   1. the Journey body remains normally visible;
 *   2. no viewport-wide translucent layer appears;
 *   3. receipt cards are contained inside their own drawer;
 *   4. the header evidence content cannot overlap the drawer;
 *   5. opening and closing evidence does not move or collapse the stage.
 */
import React from 'react';
import { render, fireEvent, cleanup, waitFor, act, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

(global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

function fakeJsonResponse(body: Record<string, unknown>, status = 200) {
  const raw = JSON.stringify(body);
  return { ok: status < 400, status, json: async () => body, text: async () => raw };
}

const FAKE_RECEIPT = {
  id: 'receipt-browser-regression-001',
  sessionId: null,
  intentId: null,
  activeCartridge: 'horizen',
  actionType: 'agent_card_discovered',
  summary: 'Aigent Nakamoto Agent Card discovered and persisted.',
  agentsInvoked: ['aigent-nakamoto'],
  toolsUsed: [],
  iqubesUsed: [],
  contextShared: [],
  artifactsCreated: [],
  approvalsGranted: [],
  policyEnvelopeId: null,
  receiptStatus: 'local',
  dvnReceiptId: null,
  createdAt: new Date('2026-09-06T12:00:00Z').toISOString(),
};

const personaFetchMock = vi.fn(async (url: string) => {
  const u = String(url);
  if (u.includes('/api/journey/') && u.includes('/state')) {
    return fakeJsonResponse({
      state: {
        journeyId: 'horizen-moneypenny',
        journeyVersion: '1',
        subjectRef: 'moneypenny',
        currentStageId: 'register',
        complete: false,
        stages: [
          {
            stageId: 'register',
            state: 'READY',
            evidencePresent: ['aigentQubeResolved'],
            evidenceMissing: ['tokenId', 'registryRereadOk'],
            receiptRefs: ['receipt-browser-regression-001'],
          },
        ],
      },
    });
  }
  if (u.includes('/api/assistant/receipts?ids=')) {
    return fakeJsonResponse({ receipts: [FAKE_RECEIPT], personaDisplayLabel: 'Test Operator' });
  }
  if (u.includes('/api/wallet/principal/status')) {
    return fakeJsonResponse({
      ok: true,
      ready: false,
      capability: 'LEGACY_EVIDENCE_ONLY',
      controlProven: false,
      detail: 'A legacy address on file cannot serve as a principal signer.',
      personaLabel: 'Test Operator',
    });
  }
  if (u.includes('/api/wallet/signing-requests')) return fakeJsonResponse({ ok: true, requests: [] });
  if (u.includes('/api/assistant/receipts')) return fakeJsonResponse({ ok: true, receipts: [], personaDisplayLabel: 'Test Operator' });
  if (u.includes('/api/persona/sponsored-agents')) return fakeJsonResponse({ ok: true, agents: [] });
  return fakeJsonResponse({ ok: true });
});
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (url: string, init?: unknown) => personaFetchMock(url, init),
  usePersonaSpine: () => ({ personaId: 'persona-operator-1' }),
}));

vi.stubGlobal(
  'fetch',
  vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes('/agent-card.json')) {
      return { ok: true, status: 200, json: async () => ({ metadata: { horizen: { tokenId: null, network: null } } }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }),
);

vi.mock('@/services/wallet/walletSurfaceRequest', () => ({
  requestWalletSurface: vi.fn(),
  subscribeWalletSurfaceCompletion: vi.fn(() => () => {}),
  subscribeWalletSurfaceAck: vi.fn(() => () => {}),
}));
vi.mock('@/components/journey/JourneyCopilotHost', () => ({ JourneyCopilotHost: () => null }));
vi.mock('@/components/persona/ActivePersonaControl', () => ({
  ActivePersonaControl: () => <div data-testid="active-persona-control" />,
}));

import { JourneyRunSurface } from '@/components/journey/JourneyRunSurface';
import { RegisterAgentPanel } from '@/components/journey/RegisterAgentPanel';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

afterEach(() => {
  cleanup();
  personaFetchMock.mockClear();
});

const registerStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'register')!;
const singleStageJourney = { ...HORIZEN_MONEYPENNY_JOURNEY, stages: [registerStage] };

function renderRegisterStage() {
  return render(
    <div style={{ width: '900px' }}>
      <JourneyRunSurface
        journey={singleStageJourney}
        stateUrl="/api/journey/moneypenny-horizen/state"
        personaId="persona-operator-1"
        headerLabel="Horizen"
        components={{ RegisterAgentPanel }}
        resolveSurfaceProps={() => ({ agentSlug: 'nakamoto' })}
      />
    </div>,
  );
}

/** Real, project-native Tailwind CSS compiled for exactly the classes present
 *  in `html` — never a hand-approximated stylesheet, so the geometry a real
 *  browser computes from it matches what actually ships. */
function compileTailwindFor(html: string, workDir: string): string {
  const htmlPath = path.join(workDir, 'content.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const outPath = path.join(workDir, 'compiled.css');
  const repoRoot = path.join(__dirname, '..');
  execFileSync(
    'npx',
    ['tailwindcss', '-i', 'app/globals.css', '-o', outPath, '--content', htmlPath],
    { cwd: repoRoot, stdio: 'pipe' },
  );
  return fs.readFileSync(outPath, 'utf8');
}

function wrapAsPage(bodyHtml: string, css: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    html, body { margin: 0; background: #0f172a; }
    body { width: 900px; }
    ${css}
  </style></head><body>${bodyHtml}</body></html>`;
}

const ARTIFACT_DIR = path.join(__dirname, '..', 'test-artifacts', 'journey-evidence-layout');

describe('Journey Evidence control — real-browser layout regression', () => {
  let chromium: typeof import('playwright-core').chromium;
  let browser: import('playwright-core').Browser;
  let workDir: string;

  beforeAll(async () => {
    ({ chromium } = await import('playwright-core'));
    const executablePath = path.join('/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
    browser = await chromium.launch({
      executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
    });
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-evidence-layout-'));
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('collapsed: the stage body renders normally, with no fixed full-viewport layer', async () => {
    const { container } = renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    const html = wrapAsPage(container.innerHTML, compileTailwindFor(container.innerHTML, workDir));
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'evidence-collapsed.png'), fullPage: true });

    const fixedFullViewportCount = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return Array.from(document.querySelectorAll('*')).filter((el) => {
        const cs = getComputedStyle(el as Element);
        if (cs.position !== 'fixed') return false;
        const r = (el as Element).getBoundingClientRect();
        return r.width >= vw - 2 && r.height >= vh - 2 && r.top <= 2 && r.left <= 2;
      }).length;
    });
    expect(fixedFullViewportCount).toBe(0);

    const quarantineVisible = await page.evaluate(() => {
      // The LEAF element (no child elements — a real text node holder),
      // never an ancestor wrapper whose textContent merely INCLUDES it —
      // querySelectorAll('*') is document order (ancestors before their own
      // descendants), so `.find()` alone would return the outermost
      // wrapper, not the actual text-bearing node.
      const el = Array.from(document.querySelectorAll('*')).find(
        (n) => n.children.length === 0 && (n.textContent || '').includes('This wallet is quarantined and cannot become your principal'),
      );
      if (!el) return false;
      const r = (el as Element).getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    expect(quarantineVisible).toBe(true);

    await page.close();
  }, 30_000);

  it('expanded: still no fixed full-viewport layer, and the header control never overlaps the drawer', async () => {
    const { container } = renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );
    const evidenceButton = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(evidenceButton);
    await waitFor(() =>
      expect(screen.getByText(/Aigent Nakamoto Agent Card discovered and persisted\./i)).toBeInTheDocument(),
    );

    const html = wrapAsPage(container.innerHTML, compileTailwindFor(container.innerHTML, workDir));
    const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'evidence-expanded.png'), fullPage: true });

    const fixedFullViewportCount = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return Array.from(document.querySelectorAll('*')).filter((el) => {
        const cs = getComputedStyle(el as Element);
        if (cs.position !== 'fixed') return false;
        const r = (el as Element).getBoundingClientRect();
        return r.width >= vw - 2 && r.height >= vh - 2 && r.top <= 2 && r.left <= 2;
      }).length;
    });
    expect(fixedFullViewportCount).toBe(0);

    // The header control and StageReceiptsDrawer's own body must never
    // geometrically overlap — real getBoundingClientRect() intersection,
    // not a className assertion.
    const overlap = await page.evaluate(() => {
      const headerButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
        /^Evidence \d+\/\d+/.test(b.textContent || ''),
      );
      // Leaf element only (see the collapsed-state test's own comment) —
      // an ancestor wrapper's textContent also "includes" this string.
      const drawerHeading = Array.from(document.querySelectorAll('*')).find(
        (n) => n.children.length === 0 && (n.textContent || '').trim().startsWith('Historical / supplementary receipts'),
      );
      if (headerButtons.length === 0 || !drawerHeading) return { found: false, intersects: false };
      const a = headerButtons[0].getBoundingClientRect();
      const b = drawerHeading.getBoundingClientRect();
      const intersects = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return { found: true, intersects };
    });
    expect(overlap.found).toBe(true);
    expect(overlap.intersects).toBe(false);

    // Receipt cards render CONTAINED inside the drawer, not floating loose —
    // walk up from the card's own leaf text node to the nearest ancestor
    // carrying StageReceiptsDrawer's own root wrapper classes.
    const containment = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('*')).find(
        (n) => n.children.length === 0 && (n.textContent || '').includes('Aigent Nakamoto Agent Card discovered and persisted.'),
      );
      if (!card) return { found: false, contained: false };
      let drawer: Element | null = card as Element;
      for (let i = 0; i < 12 && drawer; i += 1) {
        const cls = drawer.className && typeof drawer.className === 'string' ? drawer.className : '';
        if (cls.includes('rounded-md') && cls.includes('border-slate-800') && cls.includes('bg-slate-950')) break;
        drawer = drawer.parentElement;
      }
      if (!drawer) return { found: false, contained: false };
      const d = drawer.getBoundingClientRect();
      const c = (card as Element).getBoundingClientRect();
      const contained = c.left >= d.left - 1 && c.right <= d.right + 1 && c.top >= d.top - 1 && c.bottom <= d.bottom + 1;
      return { found: true, contained };
    });
    expect(containment.found).toBe(true);
    expect(containment.contained).toBe(true);

    await page.close();
  }, 30_000);

  it('opening and closing Evidence does not move or resize the stage body content', async () => {
    const { container: closedContainer } = renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );
    const closedHtml = wrapAsPage(closedContainer.innerHTML, compileTailwindFor(closedContainer.innerHTML, workDir));

    const { container: openContainer } = renderRegisterStage();
    await waitFor(() =>
      expect(screen.getAllByText(/This wallet is quarantined and cannot become your principal/i)[0]).toBeInTheDocument(),
    );
    const openEvidenceButton = screen.getAllByRole('button', { name: /^Evidence \d+\/\d+/ }).pop()!;
    fireEvent.click(openEvidenceButton);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const openHtml = wrapAsPage(openContainer.innerHTML, compileTailwindFor(openContainer.innerHTML, workDir));

    const measure = async (html: string) => {
      const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
      await page.setContent(html, { waitUntil: 'load' });
      const rect = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(
          (n) => n.children.length === 0 && (n.textContent || '').includes('This wallet is quarantined and cannot become your principal'),
        );
        if (!el) return null;
        const r = (el as Element).getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      });
      await page.close();
      return rect;
    };

    const closedRect = await measure(closedHtml);
    const openRect = await measure(openHtml);

    expect(closedRect).not.toBeNull();
    expect(openRect).not.toBeNull();
    // The stage's OWN surface content (rendered ABOVE StageReceiptsDrawer in
    // document order) must occupy the exact same position and size whether
    // Evidence is collapsed or expanded — expanding a LATER, in-flow section
    // must never move or resize what came before it.
    expect(openRect).toEqual(closedRect);
  }, 30_000);
});
