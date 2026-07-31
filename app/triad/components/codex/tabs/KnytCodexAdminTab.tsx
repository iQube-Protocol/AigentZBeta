'use client';

/**
 * KnytCodexAdminTab — canonical reference for the metaKnyt content corpus.
 *
 * Purpose: any agent or operator landing here can immediately see what is
 * what and where, so we never re-fight the convention/mapping problem that
 * cost 3 days to chase. Two views:
 *
 *   Human view — readable tables for GN / 13 episodes / 13 characters,
 *                a convention reference card, and a completeness panel.
 *   Machine view — the full JSON payload from /api/admin/codex/canonical,
 *                  copyable, plus the endpoint URL for direct integration.
 *
 * Admin-gated. Reads from /api/admin/codex/canonical (which itself enforces
 * cartridgeFlags.isAdmin). Manual refresh button per operator preference.
 */

import { useCallback, useEffect, useState } from 'react';
import { CanonicalMintPanel } from '@/components/admin/CanonicalMintPanel';

interface Props {
  isAdmin?: boolean;
}

interface AssetRow {
  id: string;
  episode_number: number | null;
  status: string;
  auto_drive_cid: string | null;
  title: string | null;
}

interface MasterRow extends AssetRow {
  content_type: string;
}

interface MediaRow extends AssetRow {
  asset_kind: string;
}

interface EpisodeSlot {
  displayNumber: number;
  dbEpisodeNumber: number;
  still: MasterRow | null;
  motion: MasterRow | null;
  print: MasterRow | null;
}

interface CharacterSlot {
  displayNumber: number;
  dbEpisodeNumber: number;
  poster: MediaRow | null;
  sheet: MediaRow | null;
}

interface CanonicalResponse {
  series: string;
  conventions: Record<string, unknown>;
  canonical: {
    gn: MasterRow | null;
    episodes: EpisodeSlot[];
    characters: CharacterSlot[];
  };
  counts: {
    gn: number;
    episode_still: number;
    episode_motion: number;
    episode_print: number;
    character_poster: number;
    powers_sheet: number;
    expectedPerCategory: number;
  };
  mismatches: Array<{ table: string; row: unknown; reason: string }>;
  fetchedAt: string;
}

function shortenCid(cid: string | null | undefined): string {
  if (!cid) return '—';
  if (cid.startsWith('http')) return cid.length > 48 ? `${cid.slice(0, 24)}…${cid.slice(-12)}` : cid;
  return cid.length > 24 ? `${cid.slice(0, 10)}…${cid.slice(-8)}` : cid;
}

function CompletenessDot({ have, want }: { have: number; want: number }) {
  const pct = want === 0 ? 1 : have / want;
  const color = pct >= 1 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginRight: 6, verticalAlign: 'middle' }} />;
}

export function KnytCodexAdminTab({ isAdmin }: Props) {
  const [data, setData] = useState<CanonicalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'human' | 'machine'>('human');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Forward the Supabase access token explicitly — browser fetch() doesn't
      // auto-attach it in iframe contexts, and /api/admin/codex/canonical's
      // getActivePersona() requires it. Same pattern as the /registry page.
      const { getSupabaseBrowserClient } = await import('@/utils/supabaseBrowser');
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch('/api/admin/codex/canonical', { cache: 'no-store', headers });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as CanonicalResponse;
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function copyJson() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 24, color: '#9ca3af' }}>
        Admin access required.
      </div>
    );
  }

  return (
    <div style={{ padding: 16, color: '#e5e7eb', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Codex Admin — Canonical Reference</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#9ca3af' }}>
            Single source of truth for what is what and where in the metaKnyt content corpus.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', border: '1px solid #374151', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setView('human')}
              style={{
                padding: '6px 12px',
                background: view === 'human' ? '#374151' : 'transparent',
                color: view === 'human' ? '#fff' : '#9ca3af',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Human
            </button>
            <button
              onClick={() => setView('machine')}
              style={{
                padding: '6px 12px',
                background: view === 'machine' ? '#374151' : 'transparent',
                color: view === 'machine' ? '#fff' : '#9ca3af',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Machine
            </button>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 6,
              fontSize: 12,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#7f1d1d', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          Error: {error}
        </div>
      )}

      {!data && loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Loading canonical record…</div>
      )}

      {data && view === 'human' && <HumanView data={data} />}
      {data && view === 'machine' && <MachineView data={data} copyJson={copyJson} copyState={copyState} />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Human view
// ──────────────────────────────────────────────────────────────────────────

function HumanView({ data }: { data: CanonicalResponse }) {
  const want = data.counts.expectedPerCategory;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/*
        Canonical Mint Panel — Phase 7B admin trigger for on-chain
        ERC-721 master mints on Base mainnet. Mounted here at the top of
        the KNYT Codex admin surface because it's the most visible
        canonical-content admin view today. Will migrate into the iQube
        Registry surface when that workstream ships (see backlog doc:
        codexes/packs/agentiq/updates/2026-05-29_canonical-mint-panel-registry-integration.md).
      */}
      <CanonicalMintPanel series="metaKnyts" />
      {/* ── Convention reference card ── */}
      <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Convention Reference</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <strong style={{ color: '#fbbf24' }}>Episodes</strong>
            <div style={{ color: '#9ca3af', marginTop: 4 }}>
              Table: <code style={{ color: '#e5e7eb' }}>master_content_qubes</code>
              <br />Indexing: <strong>0-based</strong>
              <br />Range: <code>0..12</code> (the 13 episodes); <code>-1</code> for GN
              <br />Formula: <code>display # = episode_number</code>
              <br />Content types: <code>gn_still</code>, <code>episode_still</code>, <code>episode_motion</code>, <code>episode_print</code>
            </div>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <strong style={{ color: '#fbbf24' }}>Characters</strong>
            <div style={{ color: '#9ca3af', marginTop: 4 }}>
              Table: <code style={{ color: '#e5e7eb' }}>codex_media_assets</code>
              <br />Indexing: <strong>1-based</strong>
              <br />Range: <code>1..13</code> (the 13 characters)
              <br />Formula: <code>display # = episode_number − 1</code>
              <br />Asset kinds: <code>character_poster</code>, <code>powers_sheet</code>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: 10, background: '#0b1220', borderRadius: 6, fontSize: 11, color: '#9ca3af' }}>
          <strong style={{ color: '#fbbf24' }}>ID-naming note:</strong> <code>master_content_qubes.id</code> uses
          AutoDrive 1-indexed convention (<code>mk_ep00</code> = GN, <code>mk_epNN</code> = display #(NN−1)).
          The ID is opaque — never used for math; always read <code>episode_number</code> + <code>content_type</code> from the row.
        </div>
      </section>

      {/* ── Completeness panel ── */}
      <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Upload Completeness</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, fontSize: 12 }}>
          <CompletenessCell label="GN" have={data.counts.gn} want={1} />
          <CompletenessCell label="episode_still" have={data.counts.episode_still} want={want} />
          <CompletenessCell label="episode_motion" have={data.counts.episode_motion} want={want} />
          <CompletenessCell label="episode_print" have={data.counts.episode_print} want={want} />
          <CompletenessCell label="character_poster" have={data.counts.character_poster} want={want} />
          <CompletenessCell label="powers_sheet" have={data.counts.powers_sheet} want={want} />
        </div>
      </section>

      {/* ── Mismatch detector ── */}
      {data.mismatches.length > 0 && (
        <section style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
            Mismatch Detector — {data.mismatches.length} row(s) violate the canonical convention
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
            {data.mismatches.map((m, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <code>{m.table}</code>: {m.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── GN ── */}
      <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>GN (Graphic Novel)</h3>
        {data.canonical.gn ? (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ color: '#9ca3af', textAlign: 'left' }}>
              <tr><th style={th}>ID</th><th style={th}>content_type</th><th style={th}>DB ep</th><th style={th}>status</th><th style={th}>auto_drive_cid / URL</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}><code>{data.canonical.gn.id}</code></td>
                <td style={td}><code>{data.canonical.gn.content_type}</code></td>
                <td style={td}>{data.canonical.gn.episode_number}</td>
                <td style={td}>{data.canonical.gn.status}</td>
                <td style={td} title={data.canonical.gn.auto_drive_cid ?? ''}><code>{shortenCid(data.canonical.gn.auto_drive_cid)}</code></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 12 }}>No GN row found.</div>
        )}
      </section>

      {/* ── Episodes ── */}
      <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Episodes — 13 slots (display #0..#12 = DB ep 0..12)</h3>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ color: '#9ca3af', textAlign: 'left' }}>
            <tr>
              <th style={th}>Display #</th>
              <th style={th}>DB ep</th>
              <th style={th}>Still (ID + CID)</th>
              <th style={th}>Motion (ID + CID)</th>
              <th style={th}>Print (ID + CID)</th>
            </tr>
          </thead>
          <tbody>
            {data.canonical.episodes.map((slot) => (
              <tr key={slot.displayNumber} style={{ borderTop: '1px solid #1f2937' }}>
                <td style={td}>#{slot.displayNumber}</td>
                <td style={td}>{slot.dbEpisodeNumber}</td>
                <td style={td}>{slot.still ? <><code>{slot.still.id}</code><br /><span style={cidStyle} title={slot.still.auto_drive_cid ?? ''}>{shortenCid(slot.still.auto_drive_cid)}</span></> : <span style={missing}>—</span>}</td>
                <td style={td}>{slot.motion ? <><code>{slot.motion.id}</code><br /><span style={cidStyle} title={slot.motion.auto_drive_cid ?? ''}>{shortenCid(slot.motion.auto_drive_cid)}</span></> : <span style={missing}>—</span>}</td>
                <td style={td}>{slot.print ? <><code>{slot.print.id}</code><br /><span style={cidStyle} title={slot.print.auto_drive_cid ?? ''}>{shortenCid(slot.print.auto_drive_cid)}</span></> : <span style={missing}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Characters ── */}
      <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Characters — 13 slots (display #0..#12 = DB ep 1..13)</h3>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ color: '#9ca3af', textAlign: 'left' }}>
            <tr>
              <th style={th}>Display #</th>
              <th style={th}>DB ep</th>
              <th style={th}>Poster (title / ID / CID)</th>
              <th style={th}>Powers Sheet (title / ID / CID)</th>
            </tr>
          </thead>
          <tbody>
            {data.canonical.characters.map((slot) => (
              <tr key={slot.displayNumber} style={{ borderTop: '1px solid #1f2937' }}>
                <td style={td}>#{slot.displayNumber}</td>
                <td style={td}>{slot.dbEpisodeNumber}</td>
                <td style={td}>{slot.poster ? <><strong>{slot.poster.title ?? '—'}</strong><br /><code>{slot.poster.id}</code><br /><span style={cidStyle} title={slot.poster.auto_drive_cid ?? ''}>{shortenCid(slot.poster.auto_drive_cid)}</span></> : <span style={missing}>—</span>}</td>
                <td style={td}>{slot.sheet ? <><strong>{slot.sheet.title ?? '—'}</strong><br /><code>{slot.sheet.id}</code><br /><span style={cidStyle} title={slot.sheet.auto_drive_cid ?? ''}>{shortenCid(slot.sheet.auto_drive_cid)}</span></> : <span style={missing}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
        Fetched {new Date(data.fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}

function CompletenessCell({ label, have, want }: { label: string; have: number; want: number }) {
  return (
    <div>
      <div style={{ color: '#9ca3af', fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        <CompletenessDot have={have} want={want} />
        {have} / {want}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Machine view
// ──────────────────────────────────────────────────────────────────────────

function MachineView({ data, copyJson, copyState }: { data: CanonicalResponse; copyJson: () => void; copyState: 'idle' | 'copied' | 'failed' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 12, fontSize: 12 }}>
        <div style={{ color: '#9ca3af', marginBottom: 6 }}>Endpoint (admin-only, JSON):</div>
        <code style={{ color: '#e5e7eb' }}>GET /api/admin/codex/canonical?series=metaKnyts</code>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={copyJson}
          style={{
            padding: '6px 12px',
            background: copyState === 'copied' ? '#065f46' : '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy JSON'}
        </button>
      </div>
      <pre style={{ background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8, padding: 16, fontSize: 11, color: '#e5e7eb', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: '8px 8px', verticalAlign: 'top' };
const cidStyle: React.CSSProperties = { color: '#9ca3af', fontSize: 11 };
const missing: React.CSSProperties = { color: '#f87171' };

export default KnytCodexAdminTab;
