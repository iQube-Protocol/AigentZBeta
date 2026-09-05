/**
 * CandidateIntakePanel — MoneyPenny "Operate" capability, Factor/Aegis
 * consultation (operator directive 2026-09-05: "Begin the MoneyPenny
 * specialist UI for Factor and Aegis").
 *
 * Factor and Aegis are already fully registered specialists
 * (services/agents/specialistRouter.ts) with governed invoke surfaces
 * (app/api/agents/factor/invoke/route.ts, .../aegis/invoke/route.ts) — this
 * panel is the FIRST operator-facing UI for either. It is deliberately thin:
 * it calls the SAME /api/assistant/ask-agent path every other specialist
 * consultation in this codebase uses (never a second "ask Factor"
 * implementation), and renders the response with the SAME
 * SpecialistResponseCard every other specialist consultation renders with
 * (components/metame/cards/SpecialistResponseCard.tsx) — no new card shape.
 *
 * Factor and Aegis are both advisory-only here, same as their backend
 * contract: this panel never mutates a candidate case or an assessment; it
 * only surfaces a consultation. Real case/assessment management (the
 * app/api/moneypenny/factor/cases and .../aegis/assessments REST surfaces)
 * has no UI yet — out of scope for this first slice.
 *
 * Spine-authenticated via personaFetch (CLAUDE.md PARAMOUNT) — ask-agent
 * resolves the caller via getActivePersona, same as every other panel here.
 */

"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { SpecialistResponseCard, type SpecialistResponseData } from "@/components/metame/cards/SpecialistResponseCard";

type CandidateSpecialist = "factor" | "aegis";

const SPECIALIST_META: Record<CandidateSpecialist, { label: string; blurb: string }> = {
  factor: {
    label: "Factor",
    blurb: "Candidate-intake case status, evidence checklist, authority-chain facilitation. Cannot decide admission.",
  },
  aegis: {
    label: "Aegis",
    blurb: "Independent, evidence-bound assessment. Recommends; never decides admission. Never assesses itself.",
  },
};

export function CandidateIntakePanel() {
  const [specialist, setSpecialist] = useState<CandidateSpecialist>("factor");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SpecialistResponseData | null>(null);

  const ask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/ask-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          specialistId: specialist,
          prompt: prompt.trim() || undefined,
          cartridge: "moneypenny",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) {
        setError(json?.detail || json?.error || `Consultation failed (HTTP ${res.status})`);
        setResponse(null);
        return;
      }
      setResponse(json as SpecialistResponseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [specialist, prompt]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Candidate Intake — Factor &amp; Aegis</CardTitle>
          <CardDescription className="text-slate-400">
            Consult Factor on a candidate&rsquo;s intake status or Aegis on an independent assessment. Advisory only —
            neither can decide admission; that authority stays with MoneyPenny alone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2" role="tablist" aria-label="Specialist">
            {(Object.keys(SPECIALIST_META) as CandidateSpecialist[]).map((id) => {
              const meta = SPECIALIST_META[id];
              const active = specialist === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSpecialist(id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-violet-500/70 bg-violet-500/10 text-violet-100"
                      : "border-slate-800 text-slate-300 hover:border-violet-500/40"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">{SPECIALIST_META[specialist].blurb}</p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              specialist === "factor"
                ? "e.g. Is candidate X's evidence checklist complete?"
                : "e.g. What would block admissibility for candidate X?"
            }
            rows={3}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
          />

          <div>
            <button
              type="button"
              onClick={ask}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Consult {SPECIALIST_META[specialist].label}
            </button>
          </div>
        </CardContent>
      </Card>

      {(loading || error || response) && (
        <SpecialistResponseCard data={response} loading={loading} error={error} theme="dark" />
      )}
    </div>
  );
}
