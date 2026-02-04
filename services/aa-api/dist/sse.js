import { Router } from 'express';
import { requireAuth } from './routes/mw-auth.js';
const clients = new Set();
export function pushEvent(toDid, event, data) {
    for (const c of clients) {
        if (c.did === toDid) {
            c.res.write(`event: ${event}\n`);
            c.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
}
export function pushToTenant(tenantId, event, data) {
    for (const c of clients) {
        if (c.tenant_id === tenantId) {
            c.res.write(`event: ${event}\n`);
            c.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
}
export const sseRouter = Router();
sseRouter.get('/', requireAuth, (req, res) => {
    const did = req.auth.did;
    const tenant_id = req.auth.tenant_id;
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();
    res.write(`event: hello\n`);
    res.write(`data: {"ok":true}\n\n`);
    const client = { did, tenant_id, res };
    clients.add(client);
    req.on('close', () => {
        clients.delete(client);
    });
});
