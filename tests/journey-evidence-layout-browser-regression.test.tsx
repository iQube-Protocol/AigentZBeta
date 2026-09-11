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

// Which stage the currently-active mock response describes — the three
// constrained-height tests below each point this at their own stage before
// rendering, so the SAME mock function serves all of them without a second
// implementation per stage.
let activeStageForMock: 'register' | 'verify' | 'standing' = 'register';

const personaFetchMock = vi.fn(async (url: string) => {
  const u = String(url);
  if (u.includes('/api/journey/') && u.includes('/state')) {
    return fakeJsonResponse({
      state: {
        journeyId: 'horizen-moneypenny',
        journeyVersion: '1',
        subjectRef: 'moneypenny',
        currentStageId: activeStageForMock,
        complete: false,
        stages: [
          {
            stageId: activeStageForMock,
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
  if (u.includes('/api/wallet/tasks')) return fakeJsonResponse({ ok: true, standing: null, reputation: null });
  // AgreementRatifyPanel's /api/constitutional/agreement and
  // /api/journey/moneypenny-horizen/verify/status, ParticipationStandingTab's
  // /api/journey/agents/*/standing — all safely degrade on a bare {ok:true}.
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
import { AgreementRatifyPanel } from '@/components/journey/AgreementRatifyPanel';
import { ParticipationStandingTab } from '@/app/triad/components/codex/tabs/ParticipationStandingTab';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

afterEach(() => {
  cleanup();
  personaFetchMock.mockClear();
  activeStageForMock = 'register';
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

/*
 * ═══════════════════════════════════════════════════════════════════════
 * CONSTRAINED-HEIGHT BRIDGE-HOST REGRESSION (surgical repair follow-on,
 * 2026-09-06) — the geometry the tests above never reproduced (no definite
 * height, so `flex-1`/`min-h-0` never actually constrain anything), driven
 * against a fixed, deliberately SHORT host height instead.
 *
 * CORRECTION (2026-09-06, same day): the mechanism these tests exercise —
 * `surfacesToRender.length === 1` (commit b86b8a424, 2026-09-03) forcing
 * `flex min-h-0 flex-1 flex-col` regardless of which surface it is — was
 * confirmed against the real journey definition
 * (services/journey/horizenMoneyPennyJourney.ts) to apply ONLY to Stand:
 * Register's stage stacks 2 surfaces (`horizen-registry-agent-page` +
 * `register-agent-panel`) and Ratify's stacks 3
 * (`constitutional-agreement-ratify` + `pulse-transparency-toggle` +
 * `horizen-agent-page-verify`), so neither ever reaches the length-1
 * branch — this was checked directly (temporarily removing Register's
 * `naturalHeight` flag while keeping everything else produced an IDENTICAL
 * render, proving the branch never engages for that stage either way).
 * Their two cases below stay in this suite as legitimate regression
 * coverage (multi-surface stages must stay overlap-free too, and their
 * `naturalHeight: true` marks are forward-looking insurance against either
 * stage ever collapsing to one surface), but only the Stand case is
 * evidence that this specific fix repairs an active defect. If Register or
 * Ratify still visually overlap the drawer in the deployed app, that is a
 * DIFFERENT mechanism this fix does not address and needs its own
 * root-causing — see the follow-on resolution record for the full
 * correction.
 */
describe('Journey Evidence — constrained-height Bridge-host regression (Register, Ratify, Stand)', () => {
  let chromium: typeof import('playwright-core').chromium;
  let browser: import('playwright-core').Browser;
  let workDir: string;

  beforeAll(async () => {
    ({ chromium } = await import('playwright-core'));
    const executablePath = path.join('/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
    browser = await chromium.launch({
      executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
    });
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-evidence-layout-constrained-'));
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
  });

  /** Deliberately SHORT — shorter than any of the three stages' own natural
   *  content height — so a flex box permitted to shrink below its content
   *  (`min-h-0`) actually has to, reproducing the embedded Bridge host's own
   *  constrained viewport rather than an unconstrained page. */
  const HOST_HEIGHT_PX = 420;

  const STAGE_CASES: Array<{
    name: string;
    stageId: string;
    component: string;
    Component: React.ComponentType<any>;
    resolveSurfaceProps: () => Record<string, unknown>;
    waitForText: RegExp;
  }> = [
    {
      name: 'Register',
      stageId: 'register',
      component: 'RegisterAgentPanel',
      Component: RegisterAgentPanel,
      resolveSurfaceProps: () => ({ agentSlug: 'nakamoto' }),
      waitForText: /This wallet is quarantined and cannot become your principal/i,
    },
    {
      name: 'Ratify',
      stageId: 'verify',
      component: 'AgreementRatifyPanel',
      Component: AgreementRatifyPanel,
      resolveSurfaceProps: () => ({ agentSlug: 'nakamoto', agentDisplayName: 'Aigent Nakamoto' }),
      waitForText: /Verify & Sign Agreement/i,
    },
    {
      name: 'Stand',
      stageId: 'standing',
      component: 'ParticipationStandingTab',
      Component: ParticipationStandingTab,
      resolveSurfaceProps: () => ({ only: 'standing', agentRuntimeId: 'aigent-nakamoto' }),
      // Not /Contribution history/i — that text also appears (lowercased,
      // inside a sentence) in this component's own intro paragraph, making
      // getByText ambiguous. This empty-state string is unique.
      waitForText: /No receipts yet — contributions appear here as they are receipted\./i,
    },
  ];

  it.each(STAGE_CASES)(
    '$name: the complete stage-surface rectangle never intersects the receipt-drawer rectangle under a constrained-height host',
    async ({ stageId, component, Component: StageComponent, resolveSurfaceProps, waitForText }) => {
      activeStageForMock = stageId as 'register' | 'verify' | 'standing';
      const stage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === stageId)!;
      const singleStage = { ...HORIZEN_MONEYPENNY_JOURNEY, stages: [stage] };

      const { container } = render(
        <div style={{ width: '900px', height: `${HOST_HEIGHT_PX}px`, overflow: 'hidden' }}>
          <JourneyRunSurface
            journey={singleStage}
            stateUrl="/api/journey/moneypenny-horizen/state"
            personaId="persona-operator-1"
            headerLabel="Horizen"
            components={{ [component]: StageComponent }}
            resolveSurfaceProps={resolveSurfaceProps}
          />
        </div>,
      );
      await waitFor(() => expect(screen.getByText(waitForText)).toBeInTheDocument());

      // Open Evidence — the exact reported condition (drawer visible
      // alongside the stage's own content).
      const evidenceButton = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
      fireEvent.click(evidenceButton);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const html = wrapAsPage(container.innerHTML, compileTailwindFor(container.innerHTML, workDir));
      const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
      await page.setContent(html, { waitUntil: 'load' });
      // Constrain the actual rendered wrapper to the SAME short height the
      // React harness declared — wrapAsPage's own <body> has no height
      // rule, so this reproduces the constrained ancestor precisely.
      await page.evaluate((h) => {
        const outer = document.body.firstElementChild as HTMLElement | null;
        if (outer) {
          outer.style.height = `${h}px`;
          outer.style.overflow = 'hidden';
        }
      }, HOST_HEIGHT_PX);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `constrained-${stageId}.png`),
      });

      const result = await page.evaluate(() => {
        const surfaces = document.querySelector('[data-testid="journey-stage-surfaces"]');
        // Leaf element only — an ancestor wrapper's textContent also
        // "includes" this string (see the earlier describe block's own
        // comment on this exact pitfall).
        const drawerHeading = Array.from(document.querySelectorAll('*')).find(
          (n) => n.children.length === 0 && (n.textContent || '').trim().startsWith('Historical / supplementary receipts'),
        );
        if (!surfaces || !drawerHeading) {
          return { found: false, intersects: false, surfacesRect: null, drawerRect: null };
        }
        const s = surfaces.getBoundingClientRect();
        const d = drawerHeading.getBoundingClientRect();
        const intersects = s.left < d.right && s.right > d.left && s.top < d.bottom && s.bottom > d.top;
        return {
          found: true,
          intersects,
          surfacesRect: { top: s.top, bottom: s.bottom },
          drawerRect: { top: d.top, bottom: d.bottom },
        };
      });

      expect(result.found, 'both the stage-surfaces wrapper and the drawer heading must be present').toBe(true);
      expect(
        result.intersects,
        `stage-surfaces rect ${JSON.stringify(result.surfacesRect)} intersects drawer rect ${JSON.stringify(result.drawerRect)}`,
      ).toBe(false);

      await page.close();
    },
    30_000,
  );
});
