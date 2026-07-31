/**
 * ArchitectPanel — PRD-MPY-001 Phase 3, Architect mode.
 *
 * Design-intent -> grounded proposal -> persisted artifact. Calls
 * /api/moneypenny/architect (spine-authenticated) via personaFetch (CLAUDE.md
 * PARAMOUNT — never raw fetch for a spine endpoint).
 *
 * PROPOSAL ONLY: this panel has no settlement, authorize, or fund-movement
 * affordance anywhere in it — Runtime mode (Phase 4) is a separate surface.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Compass, ShieldCheck } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ArchitectResult {
  ok: boolean;
  error?: string;
  artifactId?: string;
  title?: string;
  body?: string;
  citedInvariantIds?: string[];
}

export function ArchitectPanel() {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ArchitectResult | null>(null);

  const draft = async () => {
    if (!intent.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await personaFetch("/api/moneypenny/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const data = (await res.json()) as ArchitectResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Draft failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-400" />
          MoneyPenny Architect
        </CardTitle>
        <CardDescription className="text-white/60">
          Design a constitutional financial structure — pricing model, fee split, settlement-terms design, or
          agreement template. Grounded in the finance invariant library. Produces a proposal only — no agreement is
          formed, authorized, or settled here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        <Textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g. design a fee-split model for micro-transaction settlement between two parties"
          disabled={busy}
          rows={3}
          className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/40 focus:border-emerald-500/30 focus:bg-white/10"
        />
        <Button
          onClick={() => void draft()}
          disabled={!intent.trim() || busy}
          className="w-fit bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Compass className="h-4 w-4 mr-2" />}
          Draft structure
        </Button>

        {result && !result.ok && (
          <p className="text-sm text-rose-400">{result.error ?? "Draft failed"}</p>
        )}

        {result?.ok && (
          <div className="flex-1 overflow-y-auto space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/90">{result.title}</h3>
              {result.artifactId && (
                <span className="text-[10px] font-mono text-white/40">{result.artifactId}</span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap text-white/80">{result.body}</p>
            {result.citedInvariantIds && result.citedInvariantIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] text-white/40">cited invariants:</span>
                {result.citedInvariantIds.map((id) => (
                  <span key={id} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
