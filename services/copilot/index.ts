/**
 * Copilot Services - Barrel Export
 */

export {
  drawerCompiler,
  compileDrawerPrompt,
  type CompileRequest,
  type CompileResult,
  type DrawerChange,
} from './drawerCompiler';

export {
  sessionManager,
  createCopilotSession,
  getCopilotSession,
  processCopilotPrompt,
  getMergedDrawerSet,
  type CopilotSession,
  type CopilotMessage,
  type CreateSessionOptions,
  type ProcessPromptOptions,
  type ProcessPromptResult,
} from './sessionManager';
