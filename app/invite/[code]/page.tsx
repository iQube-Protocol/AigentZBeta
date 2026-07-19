"use client";

/**
 * /invite/[code] — the accession invitation page (operator + Aletheon,
 * 2026-07-19). The single entry point of every collaboration: the email is
 * just a wrapper; THIS page is the human-readable face of the accession
 * constitutional object, and /api/public/irl/accession?code=… is its
 * machine-readable twin (the "For AI agents" endpoint below).
 *
 * Observer-aware (phase-2 stub, live v1 behaviour): the page reads the
 * invitation's live status and adapts — an unclaimed invitation shows the
 * onboarding ladder + Begin; a claimed one becomes the participant's IRL
 * welcome, pointing deeper into the research process instead of
 * re-surfacing onboarding materials. Phase 2 folds fuller progress
 * observation (agreement lifecycle, delegation state, submissions) into
 * the same surface via the observer pattern.
 */

import React, { use, useEffect, useState } from "react";
import { ArrowRight, Bot, FileText, Loader2, ShieldCheck } from "lucide-react";

interface Accession {
  ok: boolean;
  kind: string;
  role: string;
  accessDomain?: string;
  programme: string;
  status: string;
  onboarded: boolean;
  workflow: string[];
  resources: Record<string, string>;
  constitutionalBoundary: string;
  error?: string;
}

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [accession, setAccession] = useState<Accession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/irl/accession?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        setAccession(await res.json());
      } catch {
        setAccession({ ok: false } as Accession);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const beginUrl = accession?.resources?.locker ?? "#";
  const agentUrl = `/api/public/irl/accession?code=${encodeURIComponent(code)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invitation…
          </div>
        ) : !accession?.ok ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
            <h1 className="text-xl font-semibold">Invitation not found</h1>
            <p className="mt-2 text-sm text-slate-400">
              This invitation may have been revoked or the link is incomplete. Contact the person who invited you.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400">Invariant Research Lab</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">
              {accession.onboarded ? "Welcome back." : "You are invited."}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {accession.onboarded ? (
                <>Your accession as <span className="text-violet-300">{accession.role}</span> in{" "}
                <span className="text-slate-100">{accession.programme}</span> is complete. The lab is aware of your
                progress — continue below.</>
              ) : (
                <>You have been invited to participate as{" "}
                <span className="text-violet-300">{accession.role}</span> in{" "}
                <span className="text-slate-100">{accession.programme}</span>, together with your AI research agent.
                We are not asking you to agree with our conclusions — we are inviting you to inspect our methods,
                execute the experiments independently, and tell us where we are wrong.</>
              )}
            </p>

            {/* The ladder — adapts to accession state (observer stub) */}
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold text-slate-200">
                {accession.onboarded ? "Where you are" : "How it works"}
              </h2>
              <ol className="mt-3 space-y-2">
                {accession.workflow.map((step, i) => {
                  const humanAct = step.startsWith("HUMAN ACT");
                  return (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-300">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-700 text-[9px] text-slate-400">
                        {i + 1}
                      </span>
                      <span>
                        {humanAct ? (
                          <>
                            <span className="mr-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-300">you</span>
                            {step.replace(/^HUMAN ACT: /, "")}
                          </>
                        ) : step}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 flex items-start gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {accession.constitutionalBoundary}
              </p>
            </div>

            {/* One button */}
            <a
              href={beginUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              {accession.onboarded ? "Continue in the Lab" : "Begin Review"}
              <ArrowRight className="h-4 w-4" />
            </a>

            {/* For AI agents — the machine-readable twin */}
            <div className="mt-10 border-t border-slate-800 pt-5 space-y-2">
              <a
                href={agentUrl}
                className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-200"
              >
                <Bot className="h-3.5 w-3.5" />
                For AI agents: machine-readable accession object (JSON)
              </a>
              <p className="text-[11px] leading-snug text-slate-500">
                Give this page&apos;s URL to your agent. A capable agent will discover the accession object above and
                administer your onboarding — your acceptance, claim, and delegation remain yours.
              </p>
              {accession.resources?.protocolDoc && (
                <a
                  href={accession.resources.protocolDoc}
                  className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-200"
                >
                  <FileText className="h-3.5 w-3.5" /> Experimental protocol (EXP-P1)
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
