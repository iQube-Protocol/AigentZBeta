/**
 * moneypenny-orchestration-focused — explicit MoneyPenny selection, never
 * ambiguous `tab=home` alone (Factor Operate blocker, 2026-09-06).
 *
 * Root cause: METAME_CODEX's MoneyPenny group (MONEYPENNY_AREA_TABS,
 * data/codex-configs.ts) carries `activationId: 'moneypenny'`. A persona who
 * has not separately granted that activation gets `getEnabledTabs` excluding
 * the requested 'home' tab entirely, and CodexPanelDynamic's
 * `enabledTabs.find(...) || enabledTabs[0]` fallback silently lands on
 * whatever tab is first in that cartridge instead — metame-codex's own
 * public landing tab, not MoneyPenny. This is the exact misroute the
 * operator's screenshots showed.
 *
 * Fix: the descriptor declares `autoActivate: 'moneypenny'`, threaded through
 * buildEmbedSurfaceSrc -> CodexNavOptions -> `?autoActivate=` -> the embed
 * route (app/(embed)/triad/embed/codex/[codexSlug]/page.tsx, already reads
 * `autoActivate`/`activate` — confirmed, unmodified) -> CodexPanelDynamic's
 * existing `autoActivate` prop, which self-activates an unaddressed,
 * self-activatable (`gate: 'open'`) catalogue id on arrival.
 *
 * Source-scan style, matching this repo's convention for these files (no
 * render harness precedent for CodexPanelDynamic's own activation gating).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe("journeySurfaceRegistry — 'moneypenny-orchestration-focused' declares autoActivate", () => {
  const src = read('services/journey/journeySurfaceRegistry.ts');
  const entryAt = src.indexOf("'moneypenny-orchestration-focused': {");
  const entryEnd = src.indexOf("\n  },", entryAt);
  const entry = src.slice(entryAt, entryEnd);

  it("carries autoActivate: 'moneypenny' — the ACTIVATION_CATALOG id whose group 'tab: home' belongs to", () => {
    expect(entryAt).toBeGreaterThan(-1);
    expect(entry).toMatch(/autoActivate:\s*'moneypenny'/);
  });

  it("'moneypenny' is registered in ACTIVATION_CATALOG with an 'open' (self-activatable) gate — auto-activating it grants nothing the operator could not already grant with one click", () => {
    const catalogSrc = read('data/activation-catalog.ts');
    const moneypennyAt = catalogSrc.indexOf("id: 'moneypenny'");
    expect(moneypennyAt).toBeGreaterThan(-1);
    const moneypennyEnd = catalogSrc.indexOf('\n  },', moneypennyAt);
    expect(catalogSrc.slice(moneypennyAt, moneypennyEnd)).toMatch(/gate:\s*'open'/);
  });
});

describe('buildEmbedSurfaceSrc — threads autoActivate from the descriptor into the built URL', () => {
  const src = read('services/journey/journeySurfaceRegistry.ts');
  const fnAt = src.indexOf('export function buildEmbedSurfaceSrc(');
  const fnEnd = src.indexOf('\n}', fnAt);
  const fn = src.slice(fnAt, fnEnd);

  it('passes autoActivate: descriptor.autoActivate to buildUrl', () => {
    expect(fn).toMatch(/autoActivate:\s*descriptor\.autoActivate/);
  });
});

describe('CodexNavOptions / buildCodexUrl — autoActivate is a named, typed passthrough field', () => {
  const src = read('utils/codex-nav.ts');

  it('CodexNavOptions declares autoActivate?: string', () => {
    const interfaceAt = src.indexOf('export interface CodexNavOptions {');
    const interfaceEnd = src.indexOf('\n}', interfaceAt);
    expect(src.slice(interfaceAt, interfaceEnd)).toMatch(/autoActivate\?:\s*string;/);
  });

  it('emits ?autoActivate= only when a non-empty value is supplied', () => {
    const fnAt = src.indexOf('export function buildCodexUrl(');
    const fnEnd = src.indexOf('\nexport function', fnAt + 1);
    const fn = src.slice(fnAt, fnEnd === -1 ? undefined : fnEnd);
    expect(fn).toMatch(/if \(autoActivate && autoActivate\.trim\(\)\.length > 0\) params\.set\("autoActivate", autoActivate\.trim\(\)\);/);
  });
});

describe('the embed route already reads autoActivate/activate from the URL and forwards it to CodexPanelDynamic (pre-existing mechanism, unmodified)', () => {
  const src = read('app/(embed)/triad/embed/codex/[codexSlug]/page.tsx');

  it('reads readFirst(searchParams, ["autoActivate", "activate"])', () => {
    expect(src).toMatch(/readFirst\(searchParams,\s*\["autoActivate",\s*"activate"\]\)/);
  });

  it('forwards it to CodexPanelDynamic as the autoActivate prop', () => {
    expect(src).toMatch(/autoActivate=\{autoActivate\}/);
  });
});
