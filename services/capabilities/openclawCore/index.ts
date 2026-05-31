/**
 * openclawCore — barrel file.
 *
 * Importing this module triggers tool registration via the side-effect
 * imports below. The adapter does `import '@/services/capabilities/openclawCore'`
 * at module load to populate the registry, then uses `getTool()` to
 * dispatch.
 *
 * Adding a new tool:
 *   1. Create `./tools/<name>.ts` that calls `registerTool({ ... })`.
 *   2. Add a side-effect import here.
 *   3. The adapter picks it up automatically — no changes needed.
 */

// Side-effect imports — each file registers itself with the registry.
import './tools/echo';
import './tools/webSearch';
import './tools/ownedContentScan';

export { getTool, listTools, listToolDescriptions, registerTool } from './registry';
export type {
  OpenClawTool,
  OpenClawToolHandler,
  OpenClawToolResult,
  OpenClawToolServerContext,
} from './types';
