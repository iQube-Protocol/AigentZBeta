"use client";

/**
 * EXP-001 — Living KnowledgeQube evaluation runner (evaluation-protocol.md),
 * front-end orchestration of the ~25-step protocol against
 * /api/experiments/exp001: per-artifact + combined answer passes, per-question
 * judges, per-document coherence, then the rubric scoring computed client-side
 * (explainability from expected-vs-cited markers; probe hallucination
 * mechanical). Machine-assisted scores — the protocol assigns final rubric
 * authority to a human scorer; download the JSON and review before ratifying.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Play, Square } from "lucide-react";
import { experimentGet, experimentStep, recordRunLifecycle, lifecycleNote } from "./experimentStepFetch";
import { RequestPublishControl } from "./RequestPublishControl";

type Provider = "anthropic" | "openai" | "venice";

interface QuestionMeta {
  q: number;
  text: string;
  expect: string[];
  probe?: boolean;
}

interface AnswerRow {
  q: number;
  answer: string;
  citations: string[];
}

interface QuestionScore {
  q: number;
  probe: boolean;
  consistency: number | null;
  hallucinations: number;
  perDoc: Record<string, { answer: string; notDerivable: boolean; correct: boolean; hallucination: boolean; explainability: number | null }>;
}

const isNotDerivable = (a: string) => /not\s+derivable/i.test(a);

export default function Exp001EvaluationRunner({ canRequestPublish = false }: { canRequestPublish?: boolean } = {}) {
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionMeta[]>([]);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, { id: string; label: string }[]>>({});
  const [provider, setProvider] = useState<Provider>("venice");
  const [model, setModel] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<QuestionScore[]>([]);
  const [coherence, setCoherence] = useState<Record<string, { coherence: number; notes?: string }>>({});
  const [answersByArtifact, setAnswersByArtifact] = useState<Record<string, AnswerRow[]>>({});
  const [publishState, setPublishState] = useState<string | null>(null);
  const [requestPublish, setRequestPublish] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await experimentGet("/api/experiments/exp001");
        setArtifacts(data.artifacts as string[]);
        setQuestions(data.questions as QuestionMeta[]);
        setProviders((data.providers as Record<string, boolean>) ?? {});
        setModels((data.models as Record<string, { id: string; label: string }[]>) ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load config");
      }
    })();
  }, []);

  const step = useCallback(
    (body: Record<string, unknown>) => experimentStep("/api/experiments/exp001", body),
    [],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setScores([]);
    setCoherence({});
    abortRef.current = false;
    try {
      // 1+2. Answer passes (4 artifacts + combined).
      const docs = [...artifacts, "combined"];
      const answers: Record<string, AnswerRow[]> = {};
      for (const docId of docs) {
        if (abortRef.current) throw new Error("aborted by operator");
        setProgress(`answer pass: ${docId}…`);
        const data = await step({ action: "answers", provider, artifactId: docId, ...(model ? { model } : {}) });
        answers[docId] = data.answers as AnswerRow[];
      }
      setAnswersByArtifact(answers);

      // 3+4a. Per-question judges.
      const qScores: QuestionScore[] = [];
      for (const question of questions) {
        if (abortRef.current) throw new Error("aborted by operator");
        setProgress(`judge Q${question.q}…`);
        const answersByDoc = Object.fromEntries(
          docs.map((docId) => {
            const row = answers[docId].find((a) => a.q === question.q)!;
            return [docId, { answer: row.answer, citations: row.citations }];
          }),
        );
        const { verdict } = (await step({ action: "judge", provider, q: question.q, answersByDoc, ...(model ? { model } : {}) })) as Record<string, any>;

        const perDoc: QuestionScore["perDoc"] = {};
        let hallucinations = 0;
        for (const docId of docs) {
          const row = answers[docId].find((a) => a.q === question.q)!;
          const v = verdict.perDoc?.[docId] ?? {};
          const notDerivable = isNotDerivable(row.answer);
          const hallucination = question.probe ? !notDerivable : Boolean(v.hallucination);
          if (hallucination) hallucinations += 1;
          const correct = question.probe ? notDerivable : Boolean(v.correct);
          let explainability: number | null = null;
          if (!question.probe && !notDerivable) {
            if (!correct) explainability = 0;
            else {
              const citedExpected = row.citations.some((c) =>
                question.expect.includes(c.replace(/[[\]]/g, "")),
              );
              explainability = citedExpected ? 2 : 1;
            }
          }
          perDoc[docId] = { answer: row.answer, notDerivable, correct, hallucination, explainability };
        }
        qScores.push({
          q: question.q,
          probe: Boolean(question.probe),
          consistency: question.probe ? null : Number(verdict.consistency ?? 0),
          hallucinations,
          perDoc,
        });
        setScores([...qScores]);
      }

      // 4b. Coherence per document set.
      const coh: Record<string, { coherence: number; notes?: string }> = {};
      for (const docId of docs) {
        if (abortRef.current) throw new Error("aborted by operator");
        setProgress(`coherence: ${docId}…`);
        const { verdict } = (await step({
          action: "coherence",
          provider,
          answers: answers[docId].map((a) => ({ q: a.q, answer: a.answer })),
          ...(model ? { model } : {}),
        })) as Record<string, any>;
        coh[docId] = verdict;
        setCoherence({ ...coh });
      }
      setProgress("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "run failed");
      setProgress("");
    } finally {
      setRunning(false);
    }
  }, [artifacts, questions, provider, model, step]);

  // Aggregates (mirror the terminal harness).
  const derivable = scores.filter((s) => !s.probe);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const consistencyAvg = avg(derivable.map((s) => s.consistency ?? 0));
  const explainAvg = avg(
    derivable.flatMap((s) =>
      Object.values(s.perDoc).map((d) => d.explainability).filter((v): v is number => v !== null),
    ),
  );
  const hallucinationTotal = scores.reduce((a, s) => a + s.hallucinations, 0);
  const coherenceVals = Object.values(coherence).map((c) => Number(c.coherence ?? 0));
  const coherenceAvg = avg(coherenceVals);
  const probePairs = scores.filter((s) => s.probe).flatMap((s) => Object.values(s.perDoc));
  const restraint = probePairs.length
    ? probePairs.filter((d) => d.notDerivable).length / probePairs.length
    : null;

  const complete = !running && scores.length === questions.length && Object.keys(coherence).length > 0;


  const publish = async () => {
    setPublishState("publishing");
    try {
      const data = await experimentStep("/api/experiments/results", {
          experiment: "EXP-001",
          provider,
          model: model || "(provider default)",
          requestPublish: canRequestPublish && requestPublish,
          aggregates: { consistencyAvg, explainAvg, hallucinationTotal, coherenceAvg, restraint },
          results: {
            experiment: "EXP-001",
            provider,
            model: model || "(provider default)",
            note: "Machine-assisted scoring; human scorer holds final rubric authority.",
            aggregates: { consistencyAvg, explainAvg, hallucinationTotal, coherenceAvg, restraint },
            questionScores: scores,
            coherence,
            answersByArtifact,
          },
      });
      const publishedMsg = `published — sha256 ${String(data.contentHash).slice(0, 16)}… (receipt ${data.receiptStatus ?? "created"})`;
      setPublishState(publishedMsg);
      // Instruments ↔ institution (CFS-019): the run's canonical publication
      // advances the research object one legal step. Fire-and-forget.
      const lc = await recordRunLifecycle(
        "EXP-001",
        "results-published",
        `EXP-001 run published: provider=${provider}`,
      );
      setPublishState(`${publishedMsg} · ${lifecycleNote(lc)}`);
    } catch (err) {
      setPublishState(`publish failed: ${err instanceof Error ? err.message : "error"}`);
    }
  };

  const download = () => {
    const blob = new Blob(
      [JSON.stringify({
        experiment: "EXP-001",
        provider,
        model: model || "(provider default)",
        ranAt: new Date().toISOString(),
        note: "Machine-assisted scoring; human scorer holds final rubric authority — review before ratifying.",
        aggregates: { consistencyAvg, explainAvg, hallucinationTotal, coherenceAvg, restraint },
        questionScores: scores,
        coherence,
        answersByArtifact,
      }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exp001-evaluation-${new Date().toISOString().slice(0, 10)}-${provider}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const target = (met: boolean) => (met ? "✅" : "❌");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        EXP-001 — the Living KnowledgeQube bundle evaluation: an independent judge answers the
        15-question bank from each artifact alone (article, report, story, infographic), then all
        combined, including the three adversarial probes. ~25 model calls; scores are
        machine-assisted — the protocol assigns final rubric authority to a human scorer. Prefer a
        non-Anthropic judge (the artifacts were Anthropic-authored).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Judge provider
          <select
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={provider}
            onChange={(e) => { setProvider(e.target.value as Provider); setModel(""); }}
            disabled={running}
          >
            {(["venice", "openai", "anthropic"] as Provider[]).map((p) => (
              <option key={p} value={p} disabled={providers[p] === false}>
                {p}{providers[p] === false ? " (no key)" : ""}{p === "anthropic" ? " (⚠ not independent)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Model
          <select
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
          >
            <option value="">Provider default</option>
            {(models[provider] ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        {!running ? (
          <button
            onClick={run}
            disabled={questions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Run evaluation (~{artifacts.length + 1 + questions.length + artifacts.length + 1} calls)
          </button>
        ) : (
          <button
            onClick={() => { abortRef.current = true; }}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
          >
            <Square className="h-3.5 w-3.5" /> Abort
          </button>
        )}
        {complete && (
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" /> Download results JSON
          </button>
        )}
        {complete && (
          <button
            onClick={publish}
            disabled={publishState === "publishing"}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            title="Human adjudication of machine flags still applies — the published record notes it"
          >
            {canRequestPublish ? (requestPublish ? "Submit for publication" : "Save result") : "Publish canonically"}
          </button>
        )}
      </div>
      {complete && canRequestPublish && (
        <RequestPublishControl requestPublish={requestPublish} onChange={setRequestPublish} disabled={publishState === "publishing"} />
      )}

      {running && (
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> {progress}
        </div>
      )}
      {publishState && (
        <div className="text-xs text-indigo-300">{publishState} — see the Results tab for the auditable record.</div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>
      )}

      {complete && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Metric</th>
                <th className="text-right px-3 py-2">Result</th>
                <th className="text-right px-3 py-2">Target</th>
                <th className="text-right px-3 py-2">Met</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr><td className="px-3 py-2">Consistency (avg, Q1–12)</td><td className="px-3 py-2 text-right">{consistencyAvg?.toFixed(2)}</td><td className="px-3 py-2 text-right">≥ 1.8</td><td className="px-3 py-2 text-right">{target((consistencyAvg ?? 0) >= 1.8)}</td></tr>
              <tr><td className="px-3 py-2">Explainability (avg)</td><td className="px-3 py-2 text-right">{explainAvg?.toFixed(2)}</td><td className="px-3 py-2 text-right">≥ 1.6</td><td className="px-3 py-2 text-right">{target((explainAvg ?? 0) >= 1.6)}</td></tr>
              <tr><td className="px-3 py-2">Hallucination (total, machine-flagged)</td><td className="px-3 py-2 text-right">{hallucinationTotal}</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2 text-right">{target(hallucinationTotal === 0)}</td></tr>
              <tr><td className="px-3 py-2">Coherence (avg)</td><td className="px-3 py-2 text-right">{coherenceAvg?.toFixed(2)}</td><td className="px-3 py-2 text-right">2.0</td><td className="px-3 py-2 text-right">{target(coherenceAvg === 2)}</td></tr>
              <tr><td className="px-3 py-2">Constitutional restraint (probes)</td><td className="px-3 py-2 text-right">{restraint === null ? "—" : `${Math.round(restraint * 100)}%`}</td><td className="px-3 py-2 text-right">100%</td><td className="px-3 py-2 text-right">{target(restraint === 1)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {scores.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300 mb-1">Per-question ({scores.length}/{questions.length} judged)</div>
          {scores.map((s) => (
            <div key={s.q}>
              Q{s.q}{s.probe ? " (probe)" : ""}: {s.probe ? (s.hallucinations === 0 ? "clean" : `HALLUCINATED ×${s.hallucinations}`) : `consistency=${s.consistency} hallucinations=${s.hallucinations}`}
              {s.hallucinations > 0 && !s.probe && (
                <span className="text-amber-400"> — flagged in: {Object.entries(s.perDoc).filter(([, d]) => d.hallucination).map(([id]) => id).join(", ")} (human adjudication required before ratifying)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
