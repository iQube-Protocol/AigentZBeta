import { Router } from 'express';
import { requireAuth } from './routes/mw-auth.js';

type Client = { did: string; res: any };
const clients = new Set<Client>();

export function pushEvent(toDid: string, event: string, data: any) {
  for (const c of clients) {
    if (c.did === toDid) {
      c.res.write(`event: ${event}\n`);
      c.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
}

export const sseRouter = Router();
sseRouter.get('/', requireAuth, (req, res) => {
  const did = (req as any).auth.did as string;
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();
  res.write(`event: hello\n`);
  res.write(`data: {"ok":true}\n\n`);

  const client = { did, res };
  clients.add(client);

  req.on('close', () => {
    clients.delete(client);
  });
});
