import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const API = join(REPO, 'app/api/qubetalk');

/** Every QubeTalk route that returns channel or message CONTENT to a caller. */
const READ_ROUTES = [
  'channels/route.ts',
  'channels/[id]/route.ts',
  'channels/[id]/messages/route.ts',
  'channels/[id]/stream/route.ts',
];

describe('QubeTalk read paths authenticate the caller (2026-07-28 leak)', () => {
  for (const rel of READ_ROUTES) {
    it(`${rel} gates through requireChannelAccess`, () => {
      const src = readFileSync(join(API, rel), 'utf-8');
      expect(src, `${rel} must import the gate`).toMatch(/requireChannelAccess/);
      // The gate must be AWAITED and its refusal RETURNED — importing it and
      // ignoring the result is the shape that reads as fixed and is not.
      expect(src).toMatch(/await requireChannelAccess\(/);
      expect(src).toMatch(/if \(!gate\.ok\) return gate\.response;/);
    });

    it(`${rel} never uses a caller-supplied tenant_id as the query scope`, () => {
      const src = readFileSync(join(API, rel), 'utf-8');
      // `const tenant_id = searchParams.get('tenant_id')` was THE defect: a
      // filter the caller chooses is not an authorization. The scope must come
      // off the resolved gate.
      expect(
        src,
        `${rel} must not read tenant scope from the query string`,
      ).not.toMatch(/const\s+tenant_id\s*=\s*searchParams\.get\(/);
      expect(src).toMatch(/gate\.access\.tenantId/);
    });
  }

  it('the gate fails closed on an anonymous caller', () => {
    const src = readFileSync(join(API, '_lib/requireChannelAccess.ts'), 'utf-8');
    // No persona ⇒ 401 and no rows. An anonymous embed gets nothing, whatever
    // the surface would like to render.
    expect(src).toMatch(/getActivePersona/);
    expect(src).toMatch(/status: 401/);
    const gate = src.slice(src.indexOf('if (!persona?.personaId)'));
    expect(gate.slice(0, 200)).toMatch(/ok: false/);
  });

  it('a non-admin cannot request another tenant — 403, never a silent downgrade', () => {
    const src = readFileSync(join(API, '_lib/requireChannelAccess.ts'), 'utf-8');
    expect(src).toMatch(/status: 403/);
    // A silent downgrade would hide a misconfigured surface; the error surfaces it.
    expect(src).toMatch(/requestedTenantId !== allowedTenant && !isAdmin/);
  });
});

describe('QubeTalk database layer is deny-by-default', () => {
  const migrations = readdirSync(join(REPO, 'supabase/migrations')).filter((f) => f.endsWith('.sql'));
  const repair = migrations.find((f) => f.includes('qubetalk_revoke_anon'));

  it('ships the repair migration', () => {
    expect(repair, 'the anon-revoke migration must exist').toBeTruthy();
  });

  it('revokes select from anon on all three tables', () => {
    const sql = readFileSync(join(REPO, 'supabase/migrations', repair!), 'utf-8');
    for (const t of ['qubetalk_channels', 'qubetalk_delegations', 'qubetalk_messages']) {
      expect(sql, `${t} must be revoked from anon`).toMatch(
        new RegExp(`revoke select on ${t}\\s+from anon`, 'i'),
      );
    }
  });

  it('drops the inert current_setting policies rather than preserving them', () => {
    const sql = readFileSync(join(REPO, 'supabase/migrations', repair!), 'utf-8');
    // They gated on a GUC nothing sets, under a service-role connection that
    // bypasses RLS — CB-1. Kept in place they would preserve a false assurance.
    expect(sql).toMatch(/drop policy if exists "Users can view channels they participate in"/i);
    expect(sql).toMatch(/drop policy if exists "Users can view messages in their tenant channels"/i);
    expect(sql).not.toMatch(/create policy[\s\S]*current_setting\('app\.current_tenant_id'\)/i);
  });

  it('leaves RLS enabled AND forced, with no permissive policy', () => {
    const sql = readFileSync(join(REPO, 'supabase/migrations', repair!), 'utf-8');
    for (const t of ['qubetalk_channels', 'qubetalk_delegations', 'qubetalk_messages']) {
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+force row level security`, 'i'));
    }
  });

  it('no LATER migration re-grants QubeTalk to anon', () => {
    // The original grant is in 20260113090500. Any migration after the repair
    // that hands these tables back to anon re-opens the leak.
    const after = migrations.filter((f) => f > repair!);
    for (const f of after) {
      const sql = readFileSync(join(REPO, 'supabase/migrations', f), 'utf-8');
      expect(
        sql,
        `${f} must not grant QubeTalk tables to anon`,
      ).not.toMatch(/grant[^;]*on\s+qubetalk_\w+[^;]*to[^;]*anon/i);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Remediation part 2 (2026-07-29)
//
// The first pass fixed the four CHANNEL routes. The rest of the QubeTalk
// surface carried the same pattern and was unaudited: message writes,
// delegations, workflow invocation, the AA-API machine lane and the Marketa
// lane. Each section below pins one of those.
// ═══════════════════════════════════════════════════════════════════════════

/** Routes gated in the second pass, with the tenant source each one adjudicates. */
const SECOND_PASS_ROUTES = [
  'messages/route.ts',
  'delegations/route.ts',
  'delegations/[id]/route.ts',
  'invoke/route.ts',
];

describe('the rest of the QubeTalk surface authenticates too', () => {
  for (const rel of SECOND_PASS_ROUTES) {
    it(`${rel} awaits the gate AND returns its refusal`, () => {
      const src = readFileSync(join(API, rel), 'utf-8');
      expect(src, `${rel} must import the gate`).toMatch(/requireChannelAccess/);
      expect(src, `${rel} must await it`).toMatch(/await requireChannelAccess\(/);
      // The shape that has bitten this codebase twice: the gate is imported,
      // awaited, and its verdict thrown away. Assert the refusal is RETURNED.
      expect(
        src,
        `${rel} awaits the gate but does not return its refusal`,
      ).toMatch(/if \(!gate\.ok\) return gate\.response;/);
    });
  }

  it('delegations GET does not scope on a caller-supplied tenant_id', () => {
    // Delegation rows carry task prompts and iQube refs. This route had the
    // identical defect to the channel list — `?tenant_id=` WAS the scope.
    const src = readFileSync(join(API, 'delegations/route.ts'), 'utf-8');
    expect(src).not.toMatch(/const\s+tenant_id\s*=\s*searchParams\.get\(/);
    expect(src).toMatch(/gate\.access\.tenantId/);
  });

  it('messages POST writes under the RESOLVED tenant, not the body tenant', () => {
    // An anonymous POST could previously forge agent speech into any channel.
    // Reading the channel back under `body.tenant_id` would keep the caller's
    // claim load-bearing even with the gate in place.
    const src = readFileSync(join(API, 'messages/route.ts'), 'utf-8');
    expect(src).toMatch(/getChannel\(body\.channel_id,\s*tenantId\)/);
    expect(src).not.toMatch(/getChannel\(body\.channel_id,\s*body\.tenant_id\)/);
  });

  it('invoke DISCARDS the persona the caller claims in the envelope', () => {
    // `assertEnvelope` only checks that tenantId/personaId are PRESENT. A
    // caller-asserted personaId is worth nothing; the run must be attributed to
    // the spine-resolved caller or the receipt trail is forgeable.
    const src = readFileSync(join(API, 'invoke/route.ts'), 'utf-8');
    expect(src).toMatch(/personaId:\s*gate\.access\.personaId/);
    expect(src).toMatch(/tenantId:\s*gate\.access\.tenantId/);
  });
});

describe('AA-API external-agent lane has no hardcoded credential', () => {
  const AA = join(REPO, 'app/api/aa/qubetalk');

  it('the literal demo key appears nowhere in the AA QubeTalk routes', () => {
    // `'demo-external-key'` was accepted as a valid API key in PRODUCTION by
    // both AA routes. Anyone reading the repo held a credential that listed
    // channels and read full message history for any tenant they named.
    for (const rel of ['route.ts', 'channels/route.ts', '_lib/authenticateExternalAgent.ts']) {
      const src = readFileSync(join(AA, rel), 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, `${rel} still accepts a hardcoded key`).not.toMatch(/demo-external-key/);
    }
  });

  it('both AA routes share ONE authenticator rather than a copy each', () => {
    // The function was copy-pasted into both files. Two copies of one auth
    // decision is how a backdoor survives being fixed in one place.
    for (const rel of ['route.ts', 'channels/route.ts']) {
      const src = readFileSync(join(AA, rel), 'utf-8');
      expect(src, `${rel} must import the shared authenticator`).toMatch(
        /import \{ authenticateExternalAgent \} from '@\/app\/api\/aa\/qubetalk\/_lib\/authenticateExternalAgent'/,
      );
      expect(src, `${rel} still declares its own copy`).not.toMatch(
        /function authenticateExternalAgent\s*\(/,
      );
    }
  });
});

// Behavioural, not source-level: the previous block proves the literal is gone,
// this one proves the replacement actually refuses.
describe('authenticateExternalAgent refuses by default', () => {
  const load = async () =>
    (await import('@/app/api/aa/qubetalk/_lib/authenticateExternalAgent'))
      .authenticateExternalAgent;

  const req = (headers: Record<string, string>) =>
    ({ headers: new Headers(headers) }) as unknown as Parameters<
      Awaited<ReturnType<typeof load>>
    >[0];

  const withEnv = async (
    env: Record<string, string | undefined>,
    fn: (auth: Awaited<ReturnType<typeof load>>) => void,
  ) => {
    const saved = { AA_API_KEY: process.env.AA_API_KEY, EXTERNAL_AGENT_API_KEY: process.env.EXTERNAL_AGENT_API_KEY };
    Object.assign(process.env, env);
    if (env.AA_API_KEY === undefined) delete process.env.AA_API_KEY;
    if (env.EXTERNAL_AGENT_API_KEY === undefined) delete process.env.EXTERNAL_AGENT_API_KEY;
    try {
      fn(await load());
    } finally {
      process.env.AA_API_KEY = saved.AA_API_KEY;
      process.env.EXTERNAL_AGENT_API_KEY = saved.EXTERNAL_AGENT_API_KEY;
      if (saved.AA_API_KEY === undefined) delete process.env.AA_API_KEY;
      if (saved.EXTERNAL_AGENT_API_KEY === undefined) delete process.env.EXTERNAL_AGENT_API_KEY;
    }
  };

  it('rejects the retired demo key even when a real key IS configured', async () => {
    await withEnv({ AA_API_KEY: 'a-real-key', EXTERNAL_AGENT_API_KEY: undefined }, (auth) => {
      const r = auth(req({ 'x-api-key': 'demo-external-key', 'x-agent-id': 'someone' }));
      expect(r.success).toBe(false);
    });
  });

  it('fails CLOSED when no key is configured — nobody, not everybody', async () => {
    await withEnv({ AA_API_KEY: undefined, EXTERNAL_AGENT_API_KEY: undefined }, (auth) => {
      const r = auth(req({ 'x-api-key': 'anything', 'x-agent-id': 'someone' }));
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/not configured/i);
    });
  });

  it('accepts a correctly configured key, via header or Bearer', async () => {
    // The refusals above would all pass on a function that refuses everything;
    // this is what makes them meaningful rather than vacuous.
    await withEnv({ AA_API_KEY: 'a-real-key', EXTERNAL_AGENT_API_KEY: undefined }, (auth) => {
      expect(auth(req({ 'x-api-key': 'a-real-key', 'x-agent-id': 'agent-1' })).success).toBe(true);
      expect(auth(req({ authorization: 'Bearer a-real-key', 'x-agent-id': 'agent-1' })).success).toBe(true);
      // An empty configured value must never become a wildcard.
      expect(auth(req({ 'x-api-key': '', 'x-agent-id': 'agent-1' })).success).toBe(false);
    });
  });
});

describe('Marketa QubeTalk lane no longer trusts the x-persona-id header', () => {
  const MK = join(REPO, 'app/api/marketa/qubetalk');
  const ROUTES = ['route.ts', 'channels/route.ts', 'transfers/route.ts'];

  it('no route reads x-persona-id as its authentication', () => {
    // `const personaId = request.headers.get('x-persona-id')` WAS the auth on
    // every one of these, against a module-level service-role client.
    for (const rel of ROUTES) {
      const src = readFileSync(join(MK, rel), 'utf-8');
      expect(src, `${rel} still authenticates on a caller-written header`).not.toMatch(
        /headers\.get\(['"]x-persona-id['"]\)/,
      );
    }
  });

  it('every route awaits the gate and returns its refusal', () => {
    for (const rel of ROUTES) {
      const src = readFileSync(join(MK, rel), 'utf-8');
      expect(src, `${rel}`).toMatch(/await requireMarketaQubeTalkAccess\(/);
      expect(src, `${rel} discards the gate verdict`).toMatch(
        /if \(!gate\.ok\) return gate\.response;/,
      );
      // Both handlers in each file must be gated, not just the first.
      const handlers = (src.match(/export async function (GET|POST)/g) || []).length;
      const gates = (src.match(/await requireMarketaQubeTalkAccess\(/g) || []).length;
      expect(gates, `${rel}: ${handlers} handlers but only ${gates} gated`).toBe(handlers);
    }
  });

  it('the Marketa gate resolves the caller through the spine', () => {
    const src = readFileSync(join(MK, '_lib.ts'), 'utf-8');
    expect(src).toMatch(/getActivePersona/);
    expect(src).toMatch(/status: 401/);
    // A tenant the caller is not in is a refusal, never a silent re-scope.
    expect(src).toMatch(/persona\.tenant_id !== requestedTenantId/);
  });
});

describe('the QubeTalk SSE stream is not reachable without a credential', () => {
  it('no client opens the stream with EventSource', () => {
    // EventSource cannot send Authorization, so it can never satisfy the gate.
    // The two ways to "make it work" are both leaks: exempt the route (the
    // stream emits full channel history on connect), or put the bearer token in
    // the query string (credentials into access logs and Referer). The console
    // reads the stream over fetch instead.
    const src = readFileSync(join(REPO, 'components/qubetalk/QubeTalkConsole.tsx'), 'utf-8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'QubeTalkConsole constructs an EventSource').not.toMatch(/new EventSource\(/);
    expect(code, 'the stream must be read through personaFetch').toMatch(
      /personaFetch\(\s*\n?\s*`\/api\/qubetalk\/channels\/\$\{selectedChannelId\}\/stream/,
    );
  });

  it('no client puts an access token in a QubeTalk URL', () => {
    const src = readFileSync(join(REPO, 'components/qubetalk/QubeTalkConsole.tsx'), 'utf-8');
    expect(src).not.toMatch(/[?&](access_token|token|jwt|bearer)=/i);
  });
});

describe('the database repair reaches the SECURITY DEFINER bypass', () => {
  const migrations = readdirSync(join(REPO, 'supabase/migrations')).filter((f) => f.endsWith('.sql'));
  const part2 = migrations.find((f) => f.includes('qubetalk_security_definer_backdoor'));
  const sql = () => readFileSync(join(REPO, 'supabase/migrations', part2!), 'utf-8');

  it('ships the follow-on migration', () => {
    expect(part2, 'part 2 of the repair must exist').toBeTruthy();
  });

  it('revokes the anon-executable statistics functions', () => {
    // These are `security definer`, so they run as their OWNER and bypass BOTH
    // the table grants and the deny-by-default RLS that part 1 established.
    // Part 1's table lockdown does not constrain them at all.
    for (const fn of [
      'get_channel_statistics',
      'get_channel_message_count',
      'get_channel_delegation_count',
    ]) {
      expect(sql(), `${fn} must be revoked from anon`).toMatch(
        new RegExp(`revoke execute on function ${fn}\\(text\\)\\s+from anon`, 'i'),
      );
    }
  });

  it('revokes the participant-mutating functions from authenticated', () => {
    // `add_channel_participant` on an arbitrary channel is a self-service grant
    // of read access to someone else's channel.
    expect(sql()).toMatch(/revoke execute on function add_channel_participant\(text, text\)\s+from authenticated/i);
    expect(sql()).toMatch(/revoke execute on function remove_channel_participant\(text, text\)\s+from authenticated/i);
  });

  it('closes the anonymous read of share_analytics (persona_id + IP)', () => {
    // T0 identifier correlated with PII, readable by anon over PostgREST with
    // no RLS on the table at all.
    expect(sql()).toMatch(/revoke select on share_analytics\s+from anon/i);
    expect(sql()).toMatch(/alter table share_analytics enable row level security/i);
  });

  it('no LATER migration re-grants the QubeTalk functions to anon', () => {
    for (const f of migrations.filter((x) => x > part2!)) {
      const later = readFileSync(join(REPO, 'supabase/migrations', f), 'utf-8');
      expect(later, `${f} re-grants a QubeTalk function to anon`).not.toMatch(
        /grant execute on function get_channel_\w+[^;]*to[^;]*anon/i,
      );
    }
  });
});
