/**
 * echo tool — smoke test for the gateway → adapter → receipt loop.
 *
 * Returns the input verbatim. Useful for verifying the whole chain
 * (env allowlist, policy compile, T0 stripping, receipt write) without
 * any external API dependency.
 */

import { registerTool } from '../registry';

registerTool({
  name: 'echo',
  description: 'Returns the input verbatim. Smoke test only.',
  needsServerContext: false,
  handler: async (input) => ({
    ok: true,
    data: input,
    summary: 'echo returned the input verbatim',
  }),
});
