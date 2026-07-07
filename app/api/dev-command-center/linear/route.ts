/**
 * GET /api/dev-command-center/linear — read-only Linear issues for the Linear
 * layout (CFS-020 CDE). Backed by the Linear GraphQL API
 * (https://api.linear.app/graphql) with `Authorization: <LINEAR_API_KEY>` (the
 * Linear personal-API-key scheme — the raw key, not a Bearer prefix).
 *
 * There is NO existing Linear integration and NO key in the codebase. This
 * route reads `process.env.LINEAR_API_KEY`; when absent it returns
 * `{ configured: false, missingEnv: 'LINEAR_API_KEY' }` and the layout renders
 * an honest setup notice — it never invents data. Admin-gated (getActivePersona
 * + cartridgeFlags.isAdmin). The key never leaves the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const dynamic = 'force-dynamic';

const LINEAR_MISSING_ENV = 'LINEAR_API_KEY';
const LINEAR_GRAPHQL = 'https://api.linear.app/graphql';

// Read-only query: recent issues with the T1/T2-safe fields the layout renders.
const ISSUES_QUERY = `
  query DevCommandCenterIssues($first: Int!) {
    issues(first: $first, orderBy: updatedAt) {
      nodes {
        identifier
        title
        updatedAt
        state { name type }
        assignee { displayName }
      }
    }
  }
`;

interface LinearIssueNode {
  identifier: string;
  title: string;
  updatedAt: string;
  state: { name: string; type: string } | null;
  assignee: { displayName: string } | null;
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, configured: false, missingEnv: LINEAR_MISSING_ENV });
  }

  const stateFilter = request.nextUrl.searchParams.get('stateCategory'); // e.g. 'started' | 'unstarted' | 'completed'
  const first = Math.min(Math.max(Number(request.nextUrl.searchParams.get('first')) || 40, 1), 100);

  try {
    const res = await fetch(LINEAR_GRAPHQL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: ISSUES_QUERY, variables: { first } }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, configured: true, error: `Linear API ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      data?: { issues?: { nodes?: LinearIssueNode[] } };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) {
      return NextResponse.json(
        { ok: false, configured: true, error: json.errors.map((e) => e.message).join('; ') },
        { status: 502 },
      );
    }

    let nodes = json.data?.issues?.nodes ?? [];
    if (stateFilter) {
      nodes = nodes.filter((n) => n.state?.type === stateFilter);
    }

    const issues = nodes.map((n) => ({
      identifier: n.identifier,
      title: n.title,
      state: n.state?.name ?? 'unknown',
      stateCategory: n.state?.type ?? 'unknown',
      assignee: n.assignee?.displayName ?? null,
      updatedAt: n.updatedAt,
    }));

    return NextResponse.json({ ok: true, configured: true, issues });
  } catch (err) {
    return NextResponse.json(
      { ok: false, configured: true, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
