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

type AssetListEntry = {
  id: string;
  content_type?: string | null;
  asset_kind?: string | null;
  episode_number: number | null;
  gating_kind: string | null;
};
type AssetListResponse = {
  filters?: { prefix: string; source: string; limit: number };
  counts?: { masters: number; assets: number };
  masters?: AssetListEntry[];
  assets?: AssetListEntry[];
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
  const [browsePrefix, setBrowsePrefix] = useState('');
  const [browseResult, setBrowseResult] = useState<AssetListResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

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

  const browseAssets = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseResult(null);
    try {
      let authHeaders: Record<string, string> = {};
      try {
        const { getSupabaseBrowserClient } = await import('@/utils/supabaseBrowser');
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        if (data.session?.access_token) {
          authHeaders = { Authorization: `Bearer ${data.session.access_token}` };
        }
      } catch { /* fall through */ }
      const params = new URLSearchParams();
      if (browsePrefix.trim()) params.set('prefix', browsePrefix.trim());
      params.set('limit', '50');
      const res = await fetch(`/api/access/list-assets?${params.toString()}`, {
        credentials: 'include',
        headers: { Accept: 'application/json', ...authHeaders },
      });
      const json = (await res.json()) as AssetListResponse;
      if (!res.ok) {
        setBrowseResult({ error: json.error ?? `HTTP ${res.status}` });
      } else {
        setBrowseResult(json);
      }
    } catch (e: unknown) {
      setBrowseResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBrowseLoading(false);
    }
  }, [browsePrefix]);

  const pickAsset = (id: string) => {
    setKeyKind('assetId');
    setCidOrAsset(id);
  };

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
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>
        Access Spine — Inspect
        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 12, fontWeight: 'normal' }}>
          v2 · browse-panel + jwt-from-localStorage
        </span>
      </h1>
      <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        Server-side decision for the active persona against a content asset.
        Pair with <code>[SPINE]</code> log lines in Amplify CloudWatch / dev terminal.
      </p>
      <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
        <strong>assetId</strong> looks like <code>mk_ep01_print_common</code> (master row TEXT pk) or a UUID (codex_media_assets).
        <br />
        <strong>cid</strong> is the long Autonomys content hash, or a full Supabase storage URL stored in <code>auto_drive_cid</code> / <code>pdf_lite_url</code>.
        <br />
        Either dropdown works either way — the route falls back automatically if you pick the wrong one.
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

      <details style={{ marginTop: 24, fontSize: 12, color: '#d1d5db' }}>
        <summary style={{ cursor: 'pointer', color: '#a78bfa' }}>
          Browse assets (admin only) — find a real assetId to test
        </summary>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={browsePrefix}
              onChange={(e) => setBrowsePrefix(e.target.value)}
              placeholder="prefix filter (e.g. mk_ep01) — leave empty for first 50"
              style={{
                flex: 1,
                padding: '6px 10px',
                background: '#111',
                color: '#e5e7eb',
                border: '1px solid #333',
                fontFamily: 'inherit',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') browseAssets(); }}
            />
            <button
              onClick={browseAssets}
              disabled={browseLoading}
              style={{
                padding: '6px 16px',
                background: browseLoading ? '#333' : '#a78bfa',
                color: '#0b0b0e',
                border: 'none',
                cursor: browseLoading ? 'default' : 'pointer',
                fontWeight: 600,
              }}
            >
              {browseLoading ? '…' : 'List'}
            </button>
          </div>
          {browseResult?.error && (
            <div style={{ padding: 12, background: '#3f1d1d', color: '#fca5a5', fontSize: 13 }}>
              {browseResult.error}
            </div>
          )}
          {browseResult?.masters && browseResult.masters.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                master_content_qubes ({browseResult.masters.length})
              </div>
              {browseResult.masters.map((m) => (
                <div
                  key={m.id}
                  onClick={() => pickAsset(m.id)}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderBottom: '1px solid #1f2937',
                  }}
                  title="click to load into the input"
                >
                  <span style={{ color: '#34d399' }}>{m.id}</span>
                  <span style={{ color: '#9ca3af' }}>
                    {' · '}ep={m.episode_number}{' · '}{m.content_type}{' · gating='}
                    {m.gating_kind ?? '(default)'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {browseResult?.assets && browseResult.assets.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                codex_media_assets ({browseResult.assets.length})
              </div>
              {browseResult.assets.map((a) => (
                <div
                  key={a.id}
                  onClick={() => pickAsset(a.id)}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderBottom: '1px solid #1f2937',
                  }}
                  title="click to load into the input"
                >
                  <span style={{ color: '#60a5fa' }}>{a.id}</span>
                  <span style={{ color: '#9ca3af' }}>
                    {' · '}ep={a.episode_number}{' · '}{a.asset_kind}{' · gating='}
                    {a.gating_kind ?? '(default)'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <details style={{ marginTop: 24, fontSize: 12, color: '#9ca3af' }}>
        <summary style={{ cursor: 'pointer' }}>One-liner for DevTools console</summary>
        <p style={{ marginTop: 8, marginBottom: 4 }}>
          Reads the JWT from localStorage where supabase-js stores it (no dynamic import).
        </p>
        <pre style={{ padding: 12, background: '#111', marginTop: 8, overflow: 'auto' }}>
{`(async (cidOrAssetId, action='read') => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
  const raw = k ? JSON.parse(localStorage.getItem(k) || 'null') : null;
  const jwt = raw?.access_token ?? raw?.currentSession?.access_token ?? '';
  const r = await fetch(\`/api/access/inspect?cid=\${encodeURIComponent(cidOrAssetId)}&action=\${action}\`, {
    headers: { Authorization: \`Bearer \${jwt}\` },
  });
  return r.json();
})('mk_ep00_print_common')`}
        </pre>
        <p style={{ marginTop: 8, color: '#6b7280' }}>
          Pass either a cid or an assetId — the route falls back automatically.
        </p>
      </details>
    </div>
  );
}
