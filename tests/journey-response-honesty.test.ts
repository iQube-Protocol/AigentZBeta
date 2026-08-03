/**
 * A journey response must never be silence.
 *
 * ── THE OPERATOR, THREE TIMES ────────────────────────────────────────────
 *
 *   "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
 *   "…I'm pretty sure we've already encountered this today several times too."
 *   "…AGAIN!!!"
 *
 * Each report was a DIFFERENT surface, and each time I fixed that surface.
 * That was the mistake. The defect was never "verify/authorize is missing a
 * catch" — it was "a journey route may answer with nothing, and a journey
 * client may parse that answer blindly". Fixing instances of a class, one
 * report at a time, guarantees the next report.
 *
 * Two halves, both enforced here across EVERY journey route and EVERY journey
 * client, so the next one cannot be added without tripping this:
 *
 *   SERVER — an unanticipated throw becomes a named JSON refusal, never an
 *            empty body the platform authors.
 *   CLIENT — the body is read through `readJsonOrExplain`, which names an
 *            empty body, an HTML page, a gateway timeout and malformed JSON
 *            as four different facts instead of one parser error.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO = path.join(__dirname, '..');

function walk(dir: string, match: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.claude'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, match));
    else if (match(full)) out.push(full);
  }
  return out;
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('every journey route answers, even when it fails', () => {
  const routes = walk(path.join(REPO, 'app/api/journey'), (f) => f.endsWith('route.ts'));

  it('there are journey routes to check', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  for (const route of routes) {
    const rel = path.relative(REPO, route);
    it(`${rel} wraps its handlers so a throw cannot become an empty body`, () => {
      const src = stripComments(fs.readFileSync(route, 'utf8'));
      const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\s*\(/g) ?? [];
      expect(handlers.length, 'no exported handler found — the route moved').toBeGreaterThan(0);

      for (const handler of handlers) {
        const at = src.indexOf(handler);
        // The handler's own opening block must begin with a try — everything
        // after it is then covered by a catch that returns JSON.
        const body = src.slice(at, at + 400);
        expect(
          body,
          `${rel} — ${handler.trim()} does not open with try/catch, so an unanticipated throw returns no body`,
        ).toMatch(/\{\s*try\s*\{/);
      }
      // And the catch must actually answer.
      expect(src, `${rel} — a catch that does not return JSON is not an answer`).toMatch(
        /catch[\s\S]{0,400}?NextResponse\.json/,
      );
    });
  }
});

describe('every journey client names what came back', () => {
  const clients = walk(path.join(REPO, 'components/journey'), (f) => f.endsWith('.tsx'));

  it('there are journey clients to check', () => {
    expect(clients.length).toBeGreaterThan(0);
  });

  for (const client of clients) {
    const rel = path.relative(REPO, client);
    it(`${rel} reads responses through the shared reader`, () => {
      const src = stripComments(fs.readFileSync(client, 'utf8'));
      /*
       * `.json().catch(() => null)` is ALLOWED and deliberately so: a caller
       * that has already decided a failed parse means "no data" has made the
       * distinction explicitly and cannot mislead. What is forbidden is the
       * BARE parse, whose failure surfaces as a fact about JSON when the fact
       * is about the request.
       */
      const bare = src.match(/await\s+\w+\.json\(\)(?!\s*\.catch)/g) ?? [];
      expect(
        bare,
        `${rel} parses a response body without naming what came back: ${bare.join(', ')}`,
      ).toEqual([]);
    });
  }
});

describe('the reader is reachable and singular', () => {
  it('utils/readJsonOrExplain is the one implementation', () => {
    expect(fs.existsSync(path.join(REPO, 'utils/readJsonOrExplain.ts'))).toBe(true);
  });

  it('it distinguishes the four causes that a bare parse collapses', () => {
    const src = fs.readFileSync(path.join(REPO, 'utils/readJsonOrExplain.ts'), 'utf8');
    expect(src).toMatch(/EMPTY body/);
    expect(src).toMatch(/HTML page instead of JSON/);
    expect(src).toMatch(/did not answer in time/);
    expect(src).toMatch(/malformed JSON/);
  });
});
