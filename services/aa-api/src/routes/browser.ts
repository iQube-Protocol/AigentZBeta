import crypto from 'crypto';
import { Router } from 'express';
import { env } from '../env.js';
import { requireAuth } from './mw-auth.js';
import { browserSessionService } from '../browser/sessionService.js';
import { subscribeBrowserEvents } from '../browser/events.js';
import { browserbaseProviderAdapter } from '../browser/providers/browserbase.js';
import { browserPlaywrightExec } from '../browser/exec/playwright.js';
import { browserStagehandExec } from '../browser/exec/stagehand.js';
import type { BrowserSessionAggregate } from '../browser/types.js';

function getAuthScope(req: any) {
  const auth = req.auth || {};
  return {
    did: typeof auth.did === 'string' ? auth.did : undefined,
    userId: typeof auth.user_id === 'string' ? auth.user_id : undefined,
    tenantId:
      typeof auth.tenant_id === 'string'
        ? auth.tenant_id
        : env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000',
    personaId:
      typeof auth.persona_id === 'string'
        ? auth.persona_id
        : env.DEFAULT_PERSONA_ID || (typeof auth.did === 'string' ? auth.did : undefined),
  };
}

function serializeAggregate(aggregate: Awaited<ReturnType<typeof browserSessionService.createSession>>) {
  return {
    session: aggregate.session,
    mountPayload: aggregate.mountPayload,
    surfaceState: aggregate.surfaceState,
    badges: aggregate.badges,
  };
}

function handleRouteError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown browser error';
  const status = /Unknown browser session|Browser session not found/i.test(message) ? 404 : 400;
  res.status(status).json({ error: message });
}

function assertBrowserSessionAccess(aggregate: BrowserSessionAggregate, auth: ReturnType<typeof getAuthScope>): void {
  const matchesUser =
    (typeof auth.userId === 'string' && auth.userId === aggregate.session.userId) ||
    (typeof auth.did === 'string' && auth.did === aggregate.session.userId);
  const matchesPersona =
    typeof auth.personaId === 'string' &&
    typeof aggregate.session.personaId === 'string' &&
    auth.personaId === aggregate.session.personaId;
  const matchesTenant =
    typeof auth.tenantId === 'string' &&
    typeof aggregate.session.tenantId === 'string' &&
    auth.tenantId === aggregate.session.tenantId;

  if (aggregate.session.userId) {
    if (!matchesUser) {
      throw new Error('Browser session not found');
    }
    return;
  }

  if (aggregate.session.personaId) {
    if (!matchesPersona) {
      throw new Error('Browser session not found');
    }
    return;
  }

  if (aggregate.session.tenantId && !matchesTenant) {
    throw new Error('Browser session not found');
  }
}

function getScopedSession(req: any): BrowserSessionAggregate {
  const aggregate = browserSessionService.getSession(req.params.sessionId);
  if (!aggregate) {
    throw new Error('Browser session not found');
  }
  assertBrowserSessionAccess(aggregate, getAuthScope(req));
  return aggregate;
}

export const browserRouter = Router();

browserRouter.post('/sessions', requireAuth, async (req, res) => {
  try {
    const requestedUrl =
      typeof req.body?.targetUrl === 'string'
        ? req.body.targetUrl
        : typeof req.body?.url === 'string'
          ? req.body.url
          : null;
    const aggregate = await browserSessionService.createSession({
      auth: getAuthScope(req),
      intent: typeof req.body?.intent === 'string' ? req.body.intent : null,
      mountMode: typeof req.body?.mountMode === 'string' ? req.body.mountMode : undefined,
      targetUrl: requestedUrl,
    });
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.get('/sessions/:sessionId', requireAuth, async (req, res) => {
  try {
    const aggregate = getScopedSession(req);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/close', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.closeSession(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/suspend', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.suspendSession(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/resume', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.resumeSession(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/mount', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.mountSession(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/unmount', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.unmountSession(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.get('/sessions/:sessionId/surface-state', requireAuth, async (req, res) => {
  try {
    const aggregate = getScopedSession(req);
    res.json({ surfaceState: aggregate.surfaceState });
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.get('/sessions/:sessionId/events', requireAuth, async (req, res) => {
  let aggregate: BrowserSessionAggregate;
  try {
    aggregate = getScopedSession(req);
  } catch (error) {
    return handleRouteError(res, error);
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(`event: browser.surface.state\n`);
  res.write(`data: ${JSON.stringify(aggregate.surfaceState)}\n\n`);
  res.write(`event: browser.badges.update\n`);
  res.write(`data: ${JSON.stringify(aggregate.badges)}\n\n`);
  res.write(`event: browser.takeover.state\n`);
  res.write(`data: ${JSON.stringify({ sessionId: aggregate.session.sessionId, active: aggregate.surfaceState.takeoverActive })}\n\n`);

  const unsubscribe = subscribeBrowserEvents(req.params.sessionId, {
    id: crypto.randomUUID(),
    res,
  });

  req.on('close', () => {
    unsubscribe();
  });
});

browserRouter.post('/sessions/:sessionId/navigate', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const url = typeof req.body?.url === 'string' ? req.body.url : null;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    const aggregate = await browserSessionService.navigate(req.params.sessionId, url, 'navigate');
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/back', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.navigate(req.params.sessionId, '', 'back');
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/forward', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.navigate(req.params.sessionId, '', 'forward');
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/refresh', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.navigate(req.params.sessionId, '', 'refresh');
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/agent/run', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const result = await browserSessionService.runAgentTask(req.params.sessionId, {
      instruction: typeof req.body?.instruction === 'string' ? req.body.instruction : null,
      payload: req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {},
    });
    res.json({
      ...result,
      stagehand: browserStagehandExec.getStatus(),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/agent/pause', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.pauseAgentExecution(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/agent/resume', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.resumeAgentExecution(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/takeover/start', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.startTakeover(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/takeover/end', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const aggregate = await browserSessionService.endTakeover(req.params.sessionId);
    res.json(serializeAggregate(aggregate));
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.post('/sessions/:sessionId/extract', requireAuth, async (req, res) => {
  try {
    getScopedSession(req);
    const result = await browserSessionService.extractFromSession(req.params.sessionId, {
      prompt: typeof req.body?.prompt === 'string' ? req.body.prompt : null,
      schema:
        req.body?.schema && typeof req.body.schema === 'object' && !Array.isArray(req.body.schema)
          ? req.body.schema
          : null,
    });
    res.json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.get('/sessions/:sessionId/history', requireAuth, async (req, res) => {
  let aggregate: BrowserSessionAggregate;
  try {
    aggregate = getScopedSession(req);
  } catch (error) {
    return handleRouteError(res, error);
  }
  res.json({ history: aggregate.history });
});

browserRouter.get('/sessions/:sessionId/artifacts', requireAuth, async (req, res) => {
  let aggregate: BrowserSessionAggregate;
  try {
    aggregate = getScopedSession(req);
  } catch (error) {
    return handleRouteError(res, error);
  }
  res.json({ artifacts: aggregate.artifacts });
});

browserRouter.get('/sessions/:sessionId/receipts', requireAuth, async (req, res) => {
  let aggregate: BrowserSessionAggregate;
  try {
    aggregate = getScopedSession(req);
  } catch (error) {
    return handleRouteError(res, error);
  }
  res.json({ receipts: aggregate.receipts });
});

browserRouter.post('/sessions/:sessionId/save', requireAuth, async (req, res) => {
  let aggregate: BrowserSessionAggregate;
  try {
    aggregate = getScopedSession(req);
  } catch (error) {
    return handleRouteError(res, error);
  }
  try {
    const auth = getAuthScope(req);
    const result = await browserSessionService.saveSessionOutput(aggregate.session.sessionId, {
      destinationType: typeof req.body?.destinationType === 'string' ? req.body.destinationType : undefined,
      destinationId: typeof req.body?.destinationId === 'string' ? req.body.destinationId : null,
      artifactId: typeof req.body?.artifactId === 'string' ? req.body.artifactId : null,
      metadata:
        req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
          ? req.body.metadata
          : {},
      savedBy: auth.userId || auth.did || null,
    });
    res.json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

browserRouter.get('/status', requireAuth, (_req, res) => {
  res.json({
    provider: browserbaseProviderAdapter.getStatus(),
    playwright: browserPlaywrightExec.getStatus(),
    stagehand: browserStagehandExec.getStatus(),
  });
});
