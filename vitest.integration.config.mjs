/**
 * Integration test runner — SPEC-agnostic, operator-ratified 2026-07-25.
 *
 * Runs ONLY `*.integration.test.ts`: the tests that cross a real process or
 * network boundary. They are excluded from the default `npm test` so a clean
 * checkout can be verified without external services.
 *
 * PREREQUISITES — declared here rather than discovered by failure:
 *   TEST_BASE_URL        a reachable app (defaults to the deployed dev host)
 *   SUPABASE_URL         + SUPABASE_SERVICE_ROLE_KEY for the CRM suite, which
 *                        reads a real project the test does not provision
 *
 * A missing environment should read as a setup problem, not as ~90 product
 * failures — which is exactly what the previous single-suite arrangement did.
 */
import baseConfig from './vitest.config.mjs';

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['tests/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**'],
  },
};
