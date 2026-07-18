"use client";

/**
 * PersonaReferencesInventory — the wallet Identity panel's "end the treasure
 * hunt" inventory (three-level persona reference model, 2026-07-18).
 *
 * One place showing EVERY persona and agent persona the signed-in user owns,
 * each with:
 *   1. Private Persona UUID — masked by default, eye-reveal + copy. Owner
 *      recovery/support handle. Labelled "keep private".
 *   2. Polity Public Reference — the stable hashPersonaRef-derived T2 handle,
 *      safe across governed Polity services (this is what DVN receipts carry).
 *   3. External Service References — pairwise per-audience refs for third
 *      parties, issued/rotated/revoked here and stored for recovery.
 *
 * Agent entries distinguish created agent personas, citizen-bound delegates,
 * and the current aigentMe. Data comes from the owner-authenticated
 * /api/wallet/identity/references route via personaFetch (spine Bearer).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw, Star, User, X } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ExternalRef {
  id: string;
  personaId: string;
  audience: string;
  ref: string;
  generation: number;
  status: "active" | "revoked";
  createdAt: string;
}

interface InventoryPersona {
  personaId: string;
  displayName: string | null;
  fioHandle: string | null;
  kind: "human" | "created_agent";
  status: string | null;
  publicRef: string;
  externalRefs: ExternalRef[];
}

interface InventoryAgent {
  agentPersonaId: string | null;
  walletPersonaId: string | null;
  displayName: string | null;
  agentCardSlug: string | null;
  isAigentMe: boolean;
  bound: boolean;
  publicRef: string | null;
  walletPersonaPublicRef: string | null;
  externalRefs: ExternalRef[];
}

const PRIVATE_COPY_WARNING =
  "Private Persona UUID copied. Keep it private — use it for recovery, support, and platform configuration, not third-party services.";

function CopyButton({ value, title, warn }: { value: string; title: string; warn?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title={title}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), warn ? 2500 : 1200);
      }}
      className="p-0.5 shrink-0"
      aria-label={title}
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3 text-white/40 hover:text-white" />
      )}
    </button>
  );
}

/** Masked-by-default UUID row: ••••‑masked until the eye reveals it. */
function PrivateUuidRow({ uuid }: { uuid: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-white/40 shrink-0">Private UUID</span>
      <span className="font-mono text-white/70 truncate">
        {revealed ? uuid : `${uuid.slice(0, 4)}••••-••••-${uuid.slice(-4)}`}
      </span>
      <button
        title={revealed ? "Hide" : "Reveal private UUID (keep private — recovery/support identifier)"}
        onClick={() => setRevealed((r) => !r)}
        className="p-0.5 shrink-0"
      >
        {revealed ? (
          <EyeOff className="w-3 h-3 text-white/40 hover:text-white" />
        ) : (
          <Eye className="w-3 h-3 text-white/40 hover:text-white" />
        )}
      </button>
      <CopyButton value={uuid} title={PRIVATE_COPY_WARNING} warn />
    </div>
  );
}

function PublicRefRow({ label, refValue }: { label: string; refValue: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="font-mono text-cyan-300/70 truncate">{refValue}</span>
      <CopyButton
        value={refValue}
        title="Copy Polity Public Reference — safe across trusted Polity services; does not reveal your private UUID"
      />
    </div>
  );
}

function ExternalRefsBlock({
  personaId,
  refs,
  pairwiseEnabled,
  onChanged,
}: {
  personaId: string;
  refs: ExternalRef[];
  pairwiseEnabled: boolean;
  onChanged: () => void;
}) {
  const [audience, setAudience] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setPending(true);
      setError(null);
      try {
        const res = await personaFetch("/api/wallet/identity/references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) setError(json.error || "Request failed");
        else {
          setAudience("");
          onChanged();
        }
      } catch {
        setError("Request failed");
      } finally {
        setPending(false);
      }
    },
    [onChanged],
  );

  const active = refs.filter((r) => r.status === "active");
  return (
    <div className="mt-1 space-y-1">
      {active.map((r) => (
        <div key={r.id} className="flex items-center gap-1.5 min-w-0">
          <span className="text-white/40 shrink-0 truncate max-w-[90px]" title={`External reference for ${r.audience}`}>
            {r.audience}
          </span>
          <span className="font-mono text-amber-300/70 truncate">{r.ref}</span>
          <CopyButton
            value={r.ref}
            title={`Copy External Service Reference for ${r.audience} — unique to this service; sharing it does not expose your UUID or let services correlate you`}
          />
          <button
            title="Regenerate (revokes the current reference)"
            onClick={() => act({ personaId: r.personaId, audience: r.audience, regenerate: true })}
            className="p-0.5 shrink-0"
            disabled={pending}
          >
            <RefreshCw className="w-3 h-3 text-white/40 hover:text-white" />
          </button>
          <button
            title="Revoke this reference"
            onClick={() => act({ revokeRefId: r.id })}
            className="p-0.5 shrink-0"
            disabled={pending}
          >
            <X className="w-3 h-3 text-white/40 hover:text-red-400" />
          </button>
        </div>
      ))}
      {pairwiseEnabled ? (
        <div className="flex items-center gap-1.5">
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Service name / domain"
            className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] rounded bg-black/40 ring-1 ring-white/10 text-white/80 placeholder:text-white/30"
          />
          <button
            onClick={() => audience.trim() && act({ personaId, audience })}
            disabled={pending || !audience.trim()}
            className="px-1.5 py-0.5 rounded text-[10px] text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 shrink-0"
            title="Issue a per-service reference for third-party use"
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Issue ref"}
          </button>
        </div>
      ) : (
        active.length === 0 && (
          <p className="text-[10px] text-white/30 italic">
            External refs disabled — operator: set PERSONA_PAIRWISE_REF_SECRET.
          </p>
        )
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

export default function PersonaReferencesInventory() {
  const [personas, setPersonas] = useState<InventoryPersona[]>([]);
  const [agents, setAgents] = useState<InventoryAgent[]>([]);
  const [pairwiseEnabled, setPairwiseEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await personaFetch("/api/wallet/identity/references", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLoadError(json.error || "Failed to load identity inventory");
        return;
      }
      setPersonas(json.personas ?? []);
      setAgents(json.agents ?? []);
      setPairwiseEnabled(Boolean(json.pairwiseEnabled));
      setLoadError(null);
    } catch {
      setLoadError("Failed to load identity inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading identity inventory…
      </div>
    );
  }
  if (loadError) {
    return <p className="text-xs text-white/40 italic">{loadError}</p>;
  }

  const humans = personas.filter((p) => p.kind === "human");
  const createdAgents = personas.filter((p) => p.kind === "created_agent");

  const toggleRefs = (id: string) => setExpandedRefs((prev) => ({ ...prev, [id]: !prev[id] }));

  const personaCard = (p: InventoryPersona, badge: React.ReactNode) => (
    <div key={p.personaId} className="rounded-lg bg-slate-900/40 border border-slate-800 px-2 py-1.5 text-[11px]">
      <div className="flex items-center gap-1.5 mb-1 min-w-0">
        {p.kind === "human" ? (
          <User className="w-3 h-3 text-cyan-400 shrink-0" />
        ) : (
          <Bot className="w-3 h-3 text-amber-400 shrink-0" />
        )}
        <span className="text-white/90 truncate">{p.displayName || p.fioHandle || "Persona"}</span>
        {badge}
        {p.status === "inactive" && <span className="text-white/30 text-[9px]">archived</span>}
        {p.fioHandle && <span className="text-white/40 truncate ml-auto">{p.fioHandle}</span>}
      </div>
      <div className="space-y-0.5 pl-4">
        <PrivateUuidRow uuid={p.personaId} />
        <PublicRefRow label="Public ref" refValue={p.publicRef} />
        <button onClick={() => toggleRefs(p.personaId)} className="text-[10px] text-white/40 hover:text-white/70">
          External refs ({p.externalRefs.filter((r) => r.status === "active").length}) {expandedRefs[p.personaId] ? "▾" : "▸"}
        </button>
        {expandedRefs[p.personaId] && (
          <ExternalRefsBlock
            personaId={p.personaId}
            refs={p.externalRefs}
            pairwiseEnabled={pairwiseEnabled}
            onChanged={load}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-white/40 leading-snug">
        Every persona and agent persona you own, with its identifiers. The <span className="text-white/60">Private UUID</span> is
        your recovery/support handle — keep it private. The <span className="text-cyan-300/70">Public ref</span> is safe across
        Polity services. <span className="text-amber-300/70">External refs</span> are unique per third-party service.
      </p>

      {humans.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Human Personas ({humans.length})</div>
          <div className="space-y-1">{humans.map((p) => personaCard(p, null))}</div>
        </div>
      )}

      {(createdAgents.length > 0 || agents.length > 0) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Agent Personas ({createdAgents.length + agents.length})
          </div>
          <div className="space-y-1">
            {agents.map((a) => {
              const id = a.agentPersonaId ?? a.walletPersonaId;
              if (!id) return null;
              return (
                <div key={id} className="rounded-lg bg-slate-900/40 border border-slate-800 px-2 py-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 mb-1 min-w-0">
                    <Bot className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-white/90 truncate">{a.displayName || "Agent"}</span>
                    <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 text-[9px] text-violet-300">
                      Bound delegate
                    </span>
                    {a.isAigentMe && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 text-[9px] text-amber-300">
                        <Star className="w-2.5 h-2.5" /> aigentMe
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 pl-4">
                    {a.agentPersonaId && <PrivateUuidRow uuid={a.agentPersonaId} />}
                    {a.walletPersonaId && a.walletPersonaId !== a.agentPersonaId && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-white/40 shrink-0">Wallet persona</span>
                        <span className="font-mono text-white/70 truncate">{a.walletPersonaId}</span>
                        <CopyButton value={a.walletPersonaId} title={PRIVATE_COPY_WARNING} warn />
                      </div>
                    )}
                    {a.publicRef && <PublicRefRow label="Public ref" refValue={a.publicRef} />}
                    <button onClick={() => toggleRefs(id)} className="text-[10px] text-white/40 hover:text-white/70">
                      External refs ({a.externalRefs.filter((r) => r.status === "active").length}) {expandedRefs[id] ? "▾" : "▸"}
                    </button>
                    {expandedRefs[id] && (
                      <ExternalRefsBlock
                        personaId={id}
                        refs={a.externalRefs}
                        pairwiseEnabled={pairwiseEnabled}
                        onChanged={load}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {createdAgents.map((p) =>
              personaCard(
                p,
                <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800/60 px-1.5 text-[9px] text-slate-300">
                  Created agent
                </span>,
              ),
            )}
          </div>
        </div>
      )}

      {humans.length === 0 && createdAgents.length === 0 && agents.length === 0 && (
        <p className="text-xs text-white/30 italic">No personas yet.</p>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-white/30">
        <KeyRound className="w-3 h-3" />
        Private UUIDs never appear in receipts, broadcasts, or on-chain records — only the derived references do.
      </div>
    </div>
  );
}
