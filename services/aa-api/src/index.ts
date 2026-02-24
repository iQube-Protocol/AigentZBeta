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
import { runtimeRouter } from './routes/runtime.js';

const app = express();
app.use(helmet());

// Robust CORS: reflect exact origin for Netlify/custom domains; support 
// comma-separated env.CORS_ORIGIN. Allows Authorization for SSE/auth.
const allowedList = new Set(
  String(env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  let allow = false;
  const wildcard = allowedList.has('*');
  if (origin) {
    try {
      const u = new URL(origin);
      const host = u.host; // e.g., 6916...--aigent-moneypenny.netlify.app
      if (wildcard || allowedList.has(origin)) allow = true;
      else if (/\.netlify\.(app|com)$/i.test(host)) allow = true;
    } catch {}
  }
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : (origin || '*'));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  next();
});

app.use(cors({
  origin: (origin, cb) => {
    if (allowedList.has('*')) return cb(null, true);
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      const host = u.host;
      if (allowedList.has(origin) || /\.netlify\.(app|com)$/i.test(host)) return cb(null, true);
    } catch {}
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
  credentials: true,
}));

// Handle preflight early
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
  }
  next();
});

app.use(morgan('dev'));
app.use(express.json({ limit: '25mb' }));

app.use('/aa/v1/auth', authRouter);
app.use('/aa/v1/assets', assetsRouter);
app.use('/aa/v1/payments', paymentsRouter);
app.use('/aa/v1/entitlements', entitlementsRouter);
app.use('/aa/v1/updates', sseRouter);
app.use('/aa/v1/quotes', quotesRouter);
app.use('/aa/v1/supabase', supabaseRouter);
app.use('/aa/v1/runtime', runtimeRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(env.PORT, () => {
  console.log(`[AA API] listening on :${env.PORT}`);
});
