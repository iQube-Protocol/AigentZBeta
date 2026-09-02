/**
 * Entry-audit discrepancy (2026-09-02): "an untouched /moneypenny route
 * still rendering HFTConsole needs an explicit compatibility mapping into
 * the canonical workspace. Determine whether it is user-facing and migrate
 * it accordingly; document any intentional exception."
 *
 * Finding: the standalone `/moneypenny` route (app/(shell)/moneypenny/page.tsx
 * -> MoneyPennyCartridge -> HFTConsole, the legacy flat ten-tab cartridge) IS
 * genuinely user-facing, but through exactly one real in-app link:
 * app/components/wallet/MoneyPennyWalletRuntime.tsx's "Open full Runtime +
 * Agreement lifecycle in MoneyPenny" button inside SmartWalletDrawer. Every
 * other hit for the literal string '/moneypenny' in app/ or components/ is
 * either that route's own page/layout files or prose in this session's own
 * doc comments and tests.
 *
 * The fix migrates that one entry point to the canonical `moneypenny-codex`
 * workspace's Runtime capsule via buildCodexUrl — the same cross-surface
 * mechanism used everywhere else in the platform (CLAUDE.md "Inter-Cartridge
 * Navigation — Identity Propagation"). It does NOT delete, redirect, or
 * gate the standalone route/page itself: that route stays reachable by
 * direct URL. That is the documented intentional exception — the route is
 * legacy but not removed, only de-linked from in-app navigation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readSource, stripComments } from './_lib/sourceAuthority';

const WALLET_RUNTIME_SRC = 'app/components/wallet/MoneyPennyWalletRuntime.tsx';

describe('MoneyPennyWalletRuntime no longer links to the standalone /moneypenny route', () => {
  const src = stripComments(readSource(WALLET_RUNTIME_SRC));

  it('does not hardcode href="/moneypenny"', () => {
    expect(src).not.toMatch(/href=["']\/moneypenny["']/);
  });

  it('links via buildCodexUrl to the moneypenny-codex Runtime tab instead', () => {
    expect(src).toMatch(/import \{ buildCodexUrl \} from "@\/utils\/codex-nav";/);
    expect(src).toMatch(/buildCodexUrl\('moneypenny', \{ tab: 'runtime', personaId: personaIdHint \|\| undefined \}\)/);
  });

  it('threads the wallet\'s already-resolved personaIdHint through, matching the drawer\'s convention', () => {
    expect(src).toMatch(/personaIdHint\?: string \| null/);
  });
});

describe('The standalone /moneypenny route is a documented intentional exception, not silently removed', () => {
  it('app/(shell)/moneypenny/page.tsx still exists and still renders the legacy cartridge (untouched by this migration)', () => {
    const pageSrc = readFileSync(path.join(process.cwd(), 'app/(shell)/moneypenny/page.tsx'), 'utf8');
    expect(pageSrc).toMatch(/MoneyPennyCartridge/);
  });

  it('MoneyPennyWalletRuntime.tsx\'s own header documents the migration + the deliberate-exception rationale', () => {
    const raw = readFileSync(path.join(process.cwd(), WALLET_RUNTIME_SRC), 'utf8');
    expect(raw).toMatch(/migrated 2026-09-02 off the standalone `\/moneypenny`/);
    expect(raw).toMatch(/the standalone route stays reachable by direct URL/);
  });
});

describe('No remaining in-app navigational link to the standalone /moneypenny route', () => {
  // Walk app/ and components/ for the literal route string used as a href/navigation
  // target (not as prose in a doc comment or a test file describing the route).
  const ROOTS = ['app', 'components'];
  const SKIP_DIRS = new Set(['node_modules', '.next']);
  const HIT_PATTERN = /href=["']\/moneypenny["']|window\.location\.(assign|href)\s*=\s*["']\/moneypenny["']|router\.push\(["']\/moneypenny["']\)/;

  function walk(dir: string, out: string[]) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full, out);
      } else if (/\.(tsx?|jsx?)$/.test(entry)) {
        out.push(full);
      }
    }
  }

  it('no file under app/ or components/ still hrefs the literal /moneypenny route', () => {
    const files: string[] = [];
    for (const root of ROOTS) {
      walk(path.join(process.cwd(), root), files);
    }
    // Exclude the route's own implementation files (page/layout under (shell)/moneypenny)
    // and this migration's own file, whose header prose legitimately names the route.
    const offenders = files.filter((f) => {
      if (f.includes(`${path.sep}(shell)${path.sep}moneypenny${path.sep}`)) return false;
      const raw = readFileSync(f, 'utf8');
      if (!HIT_PATTERN.test(raw)) return false;
      return true;
    });
    expect(offenders).toEqual([]);
  });
});
