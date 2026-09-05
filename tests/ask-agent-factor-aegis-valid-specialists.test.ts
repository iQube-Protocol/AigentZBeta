/**
 * app/api/agents/factor/invoke/route.ts and .../aegis/invoke/route.ts
 * delegate to app/api/assistant/ask-agent/route.ts, which gates every
 * request through VALID_SPECIALISTS/resolveSpecialistId. Both routes were
 * shipped (2026-09-05) pinning specialistId to 'factor'/'aegis' — but
 * VALID_SPECIALISTS did not yet include either value, so every real call
 * through those routes would have been rejected with `invalid-specialist`
 * despite services/agents/specialistRouter.ts already supporting both as
 * real SpecialistIds. Pins the fix mirroring the existing aletheon canary
 * (tests/homecoming-phase-ii-wpa-aletheon.test.ts).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const askAgentSrc = fs.readFileSync(
  path.join(__dirname, '..', 'app/api/assistant/ask-agent/route.ts'),
  'utf8',
);

describe('ask-agent route: VALID_SPECIALISTS includes factor and aegis', () => {
  it("includes 'factor' so the Factor invoke route no longer 400s on it", () => {
    const idx = askAgentSrc.indexOf('const VALID_SPECIALISTS');
    const line = askAgentSrc.slice(idx, askAgentSrc.indexOf(';', idx));
    expect(line).toContain("'factor'");
  });

  it("includes 'aegis' so the Aegis invoke route no longer 400s on it", () => {
    const idx = askAgentSrc.indexOf('const VALID_SPECIALISTS');
    const line = askAgentSrc.slice(idx, askAgentSrc.indexOf(';', idx));
    expect(line).toContain("'aegis'");
  });
});
