import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { assetsRouter } from './routes/assets.js';
import { paymentsRouter } from './routes/payments.js';
import { entitlementsRouter } from './routes/entitlements.js';
import { sseRouter } from './sse.js';
import { quotesRouter } from './routes/quotes.js';
import { supabaseRouter } from './routes/supabase.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '25mb' }));

app.use('/aa/v1/auth', authRouter);
app.use('/aa/v1/assets', assetsRouter);
app.use('/aa/v1/payments', paymentsRouter);
app.use('/aa/v1/entitlements', entitlementsRouter);
app.use('/aa/v1/updates', sseRouter);
app.use('/aa/v1/quotes', quotesRouter);
app.use('/aa/v1/supabase', supabaseRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(env.PORT, () => {
  console.log(`[AA API] listening on :${env.PORT}`);
});
