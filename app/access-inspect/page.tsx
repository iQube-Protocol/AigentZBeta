"use client";

/**
 * /access-inspect — operator/dev debug page for the access spine.
 *
 * Why this exists:
 *   /api/access/inspect requires Authorization: Bearer <supabase-jwt>
 *   to authenticate the caller. A plain browser navigation (URL bar)
 *   does NOT carry that header. This page solves the ergonomics by:
 *     1. Reading the Supabase session token client-side
 *     2. Sending it as Authorization on the fetch
 *     3. Rendering the JSON response inline
 *
 * No styling beyond what's strictly needed — this is an operator tool,
 * not a polished surface.
 *
 * Pair with `[SPINE] route=...` server logs (Amplify CloudWatch /
 * dev terminal) when you need the per-request decision trail.
 */

import { useCallback, useState } from 'react';

type InspectResult = {
  input: { cid: string | null; assetId: string | null; action: string };
  persona: {
    identifiability: string;
    cartridgeFlags: { isAdmin: boolean; isPartner: boolean };
    cohortMemberships: string[];
    source: string;
  };
  descriptor: {
    assetId: string;
    contentClass: string;
    state: string;
    gating: { kind: string; credential?: string; priceUsd?: number; reason?: string };
    receiptEligible: boolean;
    iqube: unknown;
  } | null;
  decision: {
    allow: boolean;
    reason: string;
    deliveryMode: string;
    receipt: { mode: string; aliasCommitment: string; cohortId: string };
  } | null;
  enforceFlag?: boolean;
  note?: string;
  error?: string;
};

const ACTIONS = [
  'read', 'watch', 'listen', 'invoke', 'connect', 'remix',
  'mint', 'transfer', 'payment-settle', 'policy-escalation', 'disclosure',
] as const;

export default function AccessInspectPage() {
  const [cidOrAsset, setCidOrAsset] = useState('');
  const [keyKind, setKeyKind] = useState<'cid' | 'assetId'>('cid');
  const [action, setAction] = useState<typeof ACTIONS[number]>('read');
  const [result, setResult] = useState<InspectResult | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspect = useCallback(async () => {
    if (!cidOrAsset.trim()) {
      setError('enter a CID or assetId');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus(null);
    try {
      let authHeaders: Record<string, string> = {};
      try {
        const { getSupabaseBrowserClient } = await import('@/utils/supabaseBrowser');
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        if (data.session?.access_token) {
          authHeaders = { Authorization: `Bearer ${data.session.access_token}` };
        }
      } catch { /* fall through; expect 401 */ }

      const params = new URLSearchParams();
      params.set(keyKind, cidOrAsset.trim());
      params.set('action', action);

      const res = await fetch(`/api/access/inspect?${params.toString()}`, {
        credentials: 'include',
        headers: { Accept: 'application/json', ...authHeaders },
      });
      setStatus(res.status);
      const json = (await res.json()) as InspectResult;
      setResult(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [cidOrAsset, keyKind, action]);

  return (
    <div style={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      maxWidth: 1100,
      margin: '32px auto',
      padding: 24,
      color: '#e5e7eb',
      background: '#0b0b0e',
      minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Access Spine — Inspect</h1>
      <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        Server-side decision for the active persona against a content asset.
        Pair with <code>[SPINE]</code> log lines in Amplify CloudWatch / dev terminal.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={keyKind}
          onChange={(e) => setKeyKind(e.target.value as 'cid' | 'assetId')}
          style={{ padding: '6px 8px', background: '#111', color: '#e5e7eb', border: '1px solid #333' }}
        >
          <option value="cid">cid</option>
          <option value="assetId">assetId</option>
        </select>
        <input
          value={cidOrAsset}
          onChange={(e) => setCidOrAsset(e.target.value)}
          placeholder={keyKind === 'cid' ? 'auto_drive_cid or pdf_lite_url' : 'mk_epNN_<type>_<tier>'}
          style={{
            flex: 1,
            minWidth: 320,
            padding: '6px 10px',
            background: '#111',
            color: '#e5e7eb',
            border: '1px solid #333',
            fontFamily: 'inherit',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') inspect(); }}
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as typeof ACTIONS[number])}
          style={{ padding: '6px 8px', background: '#111', color: '#e5e7eb', border: '1px solid #333' }}
        >
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button
          onClick={inspect}
          disabled={loading}
          style={{
            padding: '6px 16px',
            background: loading ? '#333' : '#10b981',
            color: '#0b0b0e',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? '…' : 'Inspect'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#3f1d1d', color: '#fca5a5', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {status !== null && (
        <div style={{ marginBottom: 8, fontSize: 12, color: status === 200 ? '#34d399' : '#fbbf24' }}>
          HTTP {status}
        </div>
      )}

      {result && (
        <>
          {result.decision && (
            <div style={{
              padding: 16,
              background: result.decision.allow ? '#06291f' : '#3f1d1d',
              border: `1px solid ${result.decision.allow ? '#10b981' : '#ef4444'}`,
              marginBottom: 16,
              fontSize: 14,
            }}>
              <strong style={{ color: result.decision.allow ? '#34d399' : '#fca5a5' }}>
                {result.decision.allow ? 'ALLOW' : 'DENY'}
              </strong>
              {' · '}
              <span>{result.decision.reason}</span>
              {' · delivery: '}
              <span>{result.decision.deliveryMode}</span>
              {' · receipt: '}
              <span>{result.decision.receipt.mode}</span>
              {result.enforceFlag !== undefined && (
                <span style={{ float: 'right', color: '#9ca3af' }}>
                  enforce={String(result.enforceFlag)}
                </span>
              )}
            </div>
          )}
          <pre style={{
            padding: 16,
            background: '#111',
            border: '1px solid #222',
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </>
      )}

      <details style={{ marginTop: 24, fontSize: 12, color: '#9ca3af' }}>
        <summary style={{ cursor: 'pointer' }}>One-liner for DevTools console</summary>
        <pre style={{ padding: 12, background: '#111', marginTop: 8, overflow: 'auto' }}>
{`(async (cid, action='read') => {
  const { getSupabaseBrowserClient } = await import('/utils/supabaseBrowser');
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const r = await fetch(\`/api/access/inspect?cid=\${encodeURIComponent(cid)}&action=\${action}\`, {
    headers: { Authorization: \`Bearer \${data.session?.access_token ?? ''}\` },
  });
  return r.json();
})('YOUR-CID-HERE')`}
        </pre>
      </details>
    </div>
  );
}
