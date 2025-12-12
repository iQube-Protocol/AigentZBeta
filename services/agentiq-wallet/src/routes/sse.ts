import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function sseRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get('/', { websocket: false }, async (req: any, reply: any) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    const did = req.headers['x-did'] || 'anon';
    const interval = setInterval(() => {
      reply.raw.write(`event: ping\n`);
      reply.raw.write(`data: {"ts":${Date.now()},"did":"${did}"}\n\n`);
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });
}
