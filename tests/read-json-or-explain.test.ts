/**
 * `utils/readJsonOrExplain` — a response failure must name itself.
 *
 * The operator, 2026-08-03, on `Failed to execute 'json' on 'Response':
 * Unexpected end of JSON input`: *"I'm pretty sure we've already encountered
 * this today several times too."* They had — the same class produced
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` on the Register
 * button earlier.
 *
 * A blind `res.json()` collapses route-missing, gateway-timeout, empty-body,
 * auth-redirect and crashed-handler into one PARSER message that names the
 * wrong problem. These canaries pin each distinct cause to a distinct,
 * actionable message — and pin that the reader is SHARED, because a fix only
 * one caller can reach is not a fix.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

function res(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe('a well-formed JSON body is returned', () => {
  it('parses an object', async () => {
    await expect(readJsonOrExplain(res('{"ok":true}'), 'x')).resolves.toEqual({ ok: true });
  });
});

describe('each distinct failure names itself, never the parser', () => {
  it('an EMPTY body says the handler returned nothing — the reported defect', async () => {
    // This is the exact case behind "Unexpected end of JSON input".
    await expect(readJsonOrExplain(res('', 500), 'bulk-review')).rejects.toThrow(/EMPTY body \(HTTP 500\)/);
    await expect(readJsonOrExplain(res('', 500), 'bulk-review')).rejects.toThrow(/crashed or was terminated/);
  });

  it('an empty 204 is reported as no-content, not as a crash', async () => {
    // 204 is a legitimate answer; conflating it with a dead handler would be
    // its own dishonesty. (A 204 Response cannot carry a body at all, so it is
    // constructed with null rather than an empty string.)
    const noContent = () => new Response(null, { status: 204 });
    await expect(readJsonOrExplain(noContent(), 'x')).rejects.toThrow(/no content \(HTTP 204\)/);
    await expect(readJsonOrExplain(noContent(), 'x')).rejects.not.toThrow(/crashed/);
  });

  it('a gateway status is read BEFORE the empty body — order caught a real regression', async () => {
    /*
     * A 504 almost always arrives with an empty body. When the empty-body
     * branch was checked first it swallowed every gateway timeout and reported
     * "the handler crashed" — the exact misattribution this function exists to
     * prevent, reintroduced by the change that added the empty-body case.
     */
    await expect(readJsonOrExplain(res('', 504), 'x')).rejects.toThrow(/did not answer in time/);
    await expect(readJsonOrExplain(res('', 502), 'x')).rejects.not.toThrow(/EMPTY body/);
  });

  it('an HTML page says the route is probably missing', async () => {
    await expect(readJsonOrExplain(res('<!DOCTYPE html><html>', 404), 'register/prepare')).rejects.toThrow(
      /HTML page instead of JSON/,
    );
  });

  it('a gateway timeout says nothing about the work itself', async () => {
    // The distinction that matters on a ceremony: "the check was slow" is not
    // "the act failed".
    await expect(readJsonOrExplain(res('', 504), 'register/status')).rejects.toThrow(/did not answer in time/);
    await expect(readJsonOrExplain(res('', 504), 'register/status')).rejects.toThrow(
      /says nothing about the work itself/,
    );
  });

  it('malformed JSON is distinguished from absent JSON', async () => {
    await expect(readJsonOrExplain(res('{"a":', 200), 'x')).rejects.toThrow(/malformed JSON/);
  });

  it('an unrecognised body is QUOTED, so the next unknown shape costs one line', async () => {
    await expect(readJsonOrExplain(res('upstream connect error', 503), 'x')).rejects.toThrow(
      /unexpected response \(HTTP 503\): upstream connect error/,
    );
  });

  it('a long unrecognised body is bounded rather than dumped whole', async () => {
    await expect(readJsonOrExplain(res('z'.repeat(5000), 500), 'x')).rejects.toThrow(/…/);
  });
});

describe('there is ONE implementation, and callers reach it', () => {
  /*
   * The reader existed for weeks inside RegisterAgentPanel, hardened over real
   * incidents, while every other surface kept calling raw .json() and kept
   * reproducing the defect it had already solved (inv.engineering.036/037).
   */
  const repo = path.join(__dirname, '..');

  it('RegisterAgentPanel imports the shared reader rather than defining its own', () => {
    const src = fs.readFileSync(path.join(repo, 'components/journey/RegisterAgentPanel.tsx'), 'utf8');
    expect(src).toContain("from '@/utils/readJsonOrExplain'");
    expect(src, 'a second private copy is the defect returning').not.toMatch(
      /(async )?function readJsonOrExplain\s*\(/,
    );
  });

  it('no other file defines a rival readJsonOrExplain', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        // `.claude/worktrees` holds background agents' own checkouts of this
        // same repo — scanning them reports the file under audit as its own
        // rival. Only THIS working tree is the subject.
        if (['node_modules', '.next', '.git', '.claude'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && full !== path.join(repo, 'utils/readJsonOrExplain.ts')) {
          if (/function readJsonOrExplain\s*\(/.test(fs.readFileSync(full, 'utf8'))) hits.push(full);
        }
      }
    };
    walk(repo);
    expect(hits, `rival definitions: ${hits.join(', ')}`).toEqual([]);
  });
});
