import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function nlRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.addHook('preHandler', (req: any, reply, done) => (app as any).verifyDid(req, reply).then(() => done()).catch(done));

  app.post('/plan', async (req: any) => {
    // TODO: produce a safe execution plan from natural language instruction with required approvals
    return { planId: 'plan_demo', steps: [], approvals: [] };
  });

  app.post('/execute', async (req: any) => {
    // TODO: execute a pre-approved plan with consent tokens and policy checks
    return { ok: true, executionId: 'exec_demo' };
  });
}
