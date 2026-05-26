"use client";

/**
 * PersonaAssetGraphView — shared T1 renderer for the persona asset
 * graph payload. Used by:
 *   - AdminAccessRequestsTab (lazy-loaded on row expand)
 *   - Persona360InspectorTab (top-level inspector)
 *
 * Stateless. Receives a fully-resolved graph from the parent and
 * renders six panels: identity, reputation, admin scopes, activations,
 * commercial, owned content + iQubes.
 *
 * Alpha PII posture: email, fio handle, wallet aliases all visible to
 * the platform admin viewing this surface. Backlog item to mask via
 * the consent layer is captured in
 * codexes/packs/agentiq/updates/2026-05-26_pii-exposure-consent-surface-backlog.md.
 */

import {
  AtSign,
  Award,
  CircleUser,
  Coins,
  Compass,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

export interface PersonaAssetGraphPayload {
  identifiers: {
    displayLabel: string | null;
    email: string | null;
    fioHandle: string | null;
    rootDidPresent: boolean;
    kybePresent: boolean;
    identifiability: string | null;
    walletAliases: Array<{
      chain: 'evm' | 'btc' | 'sol';
      status: string;
      expiresAt: string | null;
    }>;
  };
  reputation: { score: number; bucket: number };
  adminGrants: { isGlobalAdmin: boolean; cartridgeSlugs: string[] };
  activeActivations: string[];
  investorStatus: { isInvestor: boolean; tier: string | null };
  knytBalance: number | null;
  ownedAssets: {
    episodes: string[];
    cards: string[];
    iQubes: Array<{
      registryAssetId: string;
      name: string | null;
      assetClass: string;
      trustBand: string | null;
      source: string;
      acquiredAt: string;
    }>;
  };
  agentsProvisioned: string[];
}

interface Props {
  graph: PersonaAssetGraphPayload;
  /** Compact = single-column dense rows. Default = two-column cards. */
  layout?: 'compact' | 'cards';
}

export function PersonaAssetGraphView({ graph, layout = 'cards' }: Props) {
  const isCompact = layout === 'compact';
  const grid = isCompact
    ? 'grid grid-cols-1 gap-2'
    : 'grid grid-cols-1 md:grid-cols-2 gap-3';

  return (
    <div className={grid}>
      <Panel
        icon={<CircleUser className="w-4 h-4" />}
        title="Identity"
        tone="violet"
      >
        <Row label="Display label" value={graph.identifiers.displayLabel ?? '—'} />
        <Row label="Email" value={graph.identifiers.email ?? '—'} mono />
        <Row label="FIO handle" value={graph.identifiers.fioHandle ?? '—'} mono />
        <Row
          label="Identifiability"
          value={graph.identifiers.identifiability ?? '—'}
        />
        <Row
          label="Root DID"
          value={graph.identifiers.rootDidPresent ? 'present' : 'absent'}
          tone={graph.identifiers.rootDidPresent ? 'good' : 'muted'}
        />
        <Row
          label="kybe"
          value={graph.identifiers.kybePresent ? 'present' : 'absent'}
          tone={graph.identifiers.kybePresent ? 'good' : 'muted'}
        />
      </Panel>

      <Panel icon={<Wallet className="w-4 h-4" />} title="Wallet aliases" tone="cyan">
        {graph.identifiers.walletAliases.length === 0 ? (
          <p className="text-xs text-slate-500">No registered wallet aliases.</p>
        ) : (
          <ul className="space-y-1.5">
            {graph.identifiers.walletAliases.map((w, i) => (
              <li key={`${w.chain}-${i}`} className="text-xs text-slate-300">
                <span className="uppercase font-medium text-cyan-200">{w.chain}</span>
                <span className="mx-2 text-slate-500">·</span>
                <span>{w.status}</span>
                {w.expiresAt && (
                  <span className="ml-2 text-slate-500">
                    expires {new Date(w.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-slate-600 mt-2 italic">
          Commitments only — plaintext addresses stay in blakQube.
        </p>
      </Panel>

      <Panel icon={<Award className="w-4 h-4" />} title="Reputation" tone="amber">
        <Row label="Score" value={graph.reputation.score.toFixed(2)} />
        <Row label="Bucket" value={String(graph.reputation.bucket)} />
      </Panel>

      <Panel icon={<ShieldCheck className="w-4 h-4" />} title="Admin scopes" tone="emerald">
        {graph.adminGrants.isGlobalAdmin ? (
          <p className="text-sm text-emerald-300">Global admin (uber / platform).</p>
        ) : graph.adminGrants.cartridgeSlugs.length === 0 ? (
          <p className="text-xs text-slate-500">No admin grants.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {graph.adminGrants.cartridgeSlugs.map((slug) => (
              <Chip key={slug} label={slug} tone="emerald" />
            ))}
          </div>
        )}
      </Panel>

      <Panel icon={<Sparkles className="w-4 h-4" />} title="Active activations" tone="violet">
        {graph.activeActivations.length === 0 ? (
          <p className="text-xs text-slate-500">No active activations.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {graph.activeActivations.map((id) => (
              <Chip key={id} label={id} tone="violet" />
            ))}
          </div>
        )}
      </Panel>

      <Panel icon={<Coins className="w-4 h-4" />} title="Commercial" tone="amber">
        <Row
          label="Investor"
          value={
            graph.investorStatus.isInvestor
              ? graph.investorStatus.tier
                ? `Yes · ${graph.investorStatus.tier}`
                : 'Yes'
              : 'No'
          }
          tone={graph.investorStatus.isInvestor ? 'good' : 'muted'}
        />
        <Row
          label="$KNYT balance"
          value={graph.knytBalance !== null ? graph.knytBalance.toString() : '—'}
        />
        <Row
          label="Owned episodes"
          value={String(graph.ownedAssets.episodes.length)}
        />
        <Row label="Owned cards / SKUs" value={String(graph.ownedAssets.cards.length)} />
      </Panel>

      <Panel
        icon={<Database className="w-4 h-4" />}
        title="Owned content"
        tone="cyan"
        fullWidth={!isCompact}
      >
        {graph.ownedAssets.episodes.length + graph.ownedAssets.cards.length === 0 ? (
          <p className="text-xs text-slate-500">No owned content on file.</p>
        ) : (
          <>
            {graph.ownedAssets.episodes.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                  Episodes
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {graph.ownedAssets.episodes.slice(0, 24).map((ep) => (
                    <Chip key={ep} label={ep} tone="cyan" />
                  ))}
                  {graph.ownedAssets.episodes.length > 24 && (
                    <span className="text-[11px] text-slate-500 self-center">
                      + {graph.ownedAssets.episodes.length - 24} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {graph.ownedAssets.cards.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                  Cards / SKUs
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {graph.ownedAssets.cards.slice(0, 24).map((c) => (
                    <Chip key={c} label={c} tone="amber" />
                  ))}
                  {graph.ownedAssets.cards.length > 24 && (
                    <span className="text-[11px] text-slate-500 self-center">
                      + {graph.ownedAssets.cards.length - 24} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel
        icon={<Cpu className="w-4 h-4" />}
        title="Owned iQubes"
        tone="rose"
        fullWidth={!isCompact}
      >
        {graph.ownedAssets.iQubes.length === 0 ? (
          <p className="text-xs text-slate-500">
            No iQube holdings on file. Until the iQube fleshing-out workstream wires
            persona_iqube_holdings, this list will stay empty.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {graph.ownedAssets.iQubes.map((q) => (
              <li
                key={`${q.registryAssetId}-${q.acquiredAt}`}
                className="text-xs text-slate-300 flex items-center gap-2 flex-wrap"
              >
                <span className="text-rose-200 font-medium">{q.assetClass}</span>
                <span className="text-slate-200">{q.name ?? q.registryAssetId}</span>
                {q.trustBand && (
                  <span className="text-[10px] text-slate-500">· {q.trustBand}</span>
                )}
                <span className="text-[10px] text-slate-500">· via {q.source}</span>
                <span className="text-[10px] text-slate-500">
                  · {new Date(q.acquiredAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon={<Layers className="w-4 h-4" />} title="Agents provisioned" tone="violet">
        {graph.agentsProvisioned.length === 0 ? (
          <p className="text-xs text-slate-500">No agents provisioned.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {graph.agentsProvisioned.map((a) => (
              <Chip key={a} label={a} tone="violet" />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

type ToneKey = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose';

const TONE: Record<ToneKey, { border: string; icon: string; chip: string }> = {
  violet: { border: 'border-violet-500/30', icon: 'text-violet-300', chip: 'bg-violet-500/15 text-violet-200 border-violet-500/40' },
  cyan: { border: 'border-cyan-500/30', icon: 'text-cyan-300', chip: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40' },
  emerald: { border: 'border-emerald-500/30', icon: 'text-emerald-300', chip: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' },
  amber: { border: 'border-amber-500/30', icon: 'text-amber-300', chip: 'bg-amber-500/15 text-amber-200 border-amber-500/40' },
  rose: { border: 'border-rose-500/30', icon: 'text-rose-300', chip: 'bg-rose-500/15 text-rose-200 border-rose-500/40' },
};

function Panel({
  icon,
  title,
  tone,
  fullWidth,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: ToneKey;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      className={`rounded-md border ${t.border} bg-slate-900/40 px-3 py-2.5 ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wide ${t.icon} mb-1.5`}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'good' | 'muted';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span
        className={`text-xs ${mono ? 'font-mono' : ''} ${
          tone === 'good' ? 'text-emerald-300' : tone === 'muted' ? 'text-slate-500' : 'text-slate-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: ToneKey }) {
  const t = TONE[tone];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.chip}`}>{label}</span>
  );
}

export default PersonaAssetGraphView;
