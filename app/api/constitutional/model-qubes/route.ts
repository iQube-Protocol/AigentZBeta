/**
 * /api/constitutional/model-qubes — operator-declared ModelQube choices
 * (CFS-015 Strand Two, provider choice as sovereignty). Admin-gated.
 *
 * GET  — list operator-declared model choices, each with `keyEnvPresent` (does
 *        the named env var exist at runtime?) — NEVER the key value.
 * POST — declare a model choice by naming its provider, model id, and the ENV
 *        VAR NAME that holds its key (set separately in Amplify). Captures the
 *        choice so it is exportable for the future without a code change.
 *
 * T2 discipline (PARAMOUNT):
 *   - We store + return the env var NAME (key_env), never the secret value. The
 *     only thing derived from the value is a boolean presence flag.
 *   - `declared_by_commitment` is a one-way sha256 over the caller's personaId —
 *     the raw personaId NEVER enters the row or a response.
 *
 * Honest limit: a declared choice is CAPTURED and SURFACED (registry view +
 * future export/selection). It does NOT yet auto-join the synchronous live
 * routing (resolveModelQubeRoute is pure/sync) — async hydration of seed ∪ store
 * into routing is the named follow-on, and a choice only becomes routable once
 * its provider has a verified adapter AND its key_env is set in Amplify.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Env var name shape — uppercase, digits, underscores (never a value). */
const ENV_NAME = /^[A-Z][A-Z0-9_]{2,63}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,63}$/;

interface OperatorModelRow {
  id: string;
  provider: string;
  model: string;
  key_env: string;
  base_url_env: string | null;
  tier: string;
  declared_by_commitment: string;
  created_at: string;
}

/** Project a row T2-safely: env var NAMES + a presence flag, never the values. */
function project(row: OperatorModelRow) {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    keyEnv: row.key_env,
    keyEnvPresent: Boolean(process.env[row.key_env]),
    baseUrlEnv: row.base_url_env,
    baseUrlEnvPresent: row.base_url_env ? Boolean(process.env[row.base_url_env]) : null,
    tier: row.tier,
    declaredByCommitment: row.declared_by_commitment,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  }
  if (pr.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!pr.persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('operator_model_qubes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    models: (data as OperatorModelRow[]).map(project),
  });
}

export async function POST(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  }
  if (pr.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!pr.persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    id?: string;
    provider?: string;
    model?: string;
    keyEnv?: string;
    baseUrlEnv?: string;
    tier?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const id = String(body.id ?? '').trim();
  const provider = String(body.provider ?? '').trim();
  const model = String(body.model ?? '').trim();
  const keyEnv = String(body.keyEnv ?? '').trim();
  const baseUrlEnv = body.baseUrlEnv ? String(body.baseUrlEnv).trim() : null;
  const tier = String(body.tier ?? 'frontier').trim();

  if (!SLUG.test(id)) {
    return NextResponse.json({ ok: false, error: 'id must be a slug (a-z0-9-, 2–64 chars)' }, { status: 400 });
  }
  if (!SLUG.test(provider)) {
    return NextResponse.json({ ok: false, error: 'provider must be a slug' }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ ok: false, error: 'model is required' }, { status: 400 });
  }
  // Guard the paramount rule: a key VALUE must never be submitted here — only its
  // env var NAME. Reject anything that isn't an env-var-shaped identifier.
  if (!ENV_NAME.test(keyEnv)) {
    return NextResponse.json(
      { ok: false, error: 'keyEnv must be an ENV VAR NAME (e.g. OPENAI_API_KEY) — never a key value' },
      { status: 400 },
    );
  }
  if (baseUrlEnv && !ENV_NAME.test(baseUrlEnv)) {
    return NextResponse.json({ ok: false, error: 'baseUrlEnv must be an ENV VAR NAME' }, { status: 400 });
  }
  if (tier !== 'frontier' && tier !== 'open-weight' && tier !== 'self-hosted') {
    return NextResponse.json({ ok: false, error: 'tier must be frontier | open-weight | self-hosted' }, { status: 400 });
  }

  // One-way T2 commitment over the caller's personaId — the raw id never lands.
  const declaredByCommitment = createHash('sha256')
    .update('modelqube:operator:' + pr.persona.personaId)
    .digest('hex')
    .slice(0, 16);

  const { data, error } = await supabase
    .from('operator_model_qubes')
    .upsert(
      {
        id,
        provider,
        model,
        key_env: keyEnv,
        base_url_env: baseUrlEnv,
        tier,
        declared_by_commitment: declaredByCommitment,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const projected = project(data as OperatorModelRow);
  return NextResponse.json({
    ok: true,
    model: projected,
    note: projected.keyEnvPresent
      ? `Declared. ${keyEnv} is present at runtime — the choice is captured and exportable.`
      : `Declared. ${keyEnv} is NOT set at runtime yet — add it in Amplify and redeploy so this choice can be used.`,
  });
}
