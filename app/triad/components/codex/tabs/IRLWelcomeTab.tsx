"use client";

/**
 * IRLWelcomeTab — the Invariant Research Lab home / welcome screen
 * (operator direction, 2026-07-19). The first thing a participant sees in
 * IRL OS: an observer-aware welcome that adapts to where they are.
 *
 * Not yet onboarded → the invitational welcome + the onboarding ladder +
 *   a Begin action into the Participation (apply/claim) flow.
 * Already onboarded (holds an active research-lab grant) → "welcome back",
 *   pointing deeper into the research process (Laboratory / Experiments)
 *   instead of re-surfacing onboarding.
 *
 * Awareness source: /api/participation/my-access (the caller's own grants).
 * The deeper observer (next-best-action from agreement/delegation/submission
 * state) is stubbed here for phase 2 — this v1 already distinguishes
 * onboarded from not, which is the behaviour the operator asked for so the
 * home stops repeating onboarding materials.
 *
 * Mirrors the /invite/<code> accession page's language so the emailed
 * invitation and the in-app home read as one experience.
 */

import React, { useEffect, useState } from "react";
import { ArrowRight, Bot, BookOpen, FlaskConical, Loader2, ShieldCheck, UserRound, Users } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Grant {
  accessDomain: string;
  role: string;
  grantedAt: string;
}

/**
 * Tab slugs differ by cartridge: the public IRL OS prefixes tabs `irl-os-`,
 * the internal metaMe IRL prefixes them `irl-`. Detect from the embed path
 * so the home cards navigate correctly in both. Unknown slugs are ignored by
 * CodexPanelDynamic, so a wrong guess degrades to a no-op rather than an error.
 */
function tabPrefix(): "irl-os" | "irl" {
  try {
    return window.location.pathname.includes("irl-os") ? "irl-os" : "irl";
  } catch {
    return "irl-os";
  }
}

/** Same-cartridge tab switch — CodexPanelDynamic listens for codex:navigate-tab. */
function goToTab(slug: string) {
  try {
    window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: slug } }));
  } catch {
    /* non-fatal */
  }
}

export function IRLWelcomeTab() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // personaFetch, NEVER raw fetch — my-access resolves the caller through
        // the spine and needs the Bearer token; raw fetch always reads as
        // unauthenticated, which made this page blind to a fully-onboarded
        // persona (operator report 2026-07-19; CLAUDE.md spine-fetch rule).
        const res = await personaFetch("/api/participation/my-access", { cache: "no-store" });
        const data = await res.json();
        setAuthed(Boolean(data?.authenticated));
        setGrants(data?.grants ?? []);
      } catch {
        setGrants([]);
      }
    })();
  }, []);

  const researchGrant = (grants ?? []).find((g) => g.accessDomain === "research-lab");
  const onboarded = Boolean(researchGrant);
  const loading = grants === null;

  const p = tabPrefix();
  const PARTICIPATION_TAB = `${p}-participation-overview`;
  const APPLY_TAB = `${p}-passport-apply`;
  const DELEGATION_TAB = `${p}-passport-delegation`;
  const LAB_TAB = `${p}-experiment-lab`;
  const REPORTS_TAB = `${p}-reports`;
  const HUMAN_TAB = authed ? APPLY_TAB : PARTICIPATION_TAB;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400">Invariant Research Lab</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-100">
        {loading ? "Welcome" : onboarded ? "Welcome back." : "Welcome to the Lab."}
      </h1>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading your participation state…
        </p>
      ) : onboarded ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            You are an active <span className="text-violet-300">{researchGrant?.role.replace(/-/g, " ")}</span> in the
            Research Lab. Pick up where the work is — review current experiments, run them, and submit results.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <HomeCard icon={FlaskConical} title="Experiments" body="Run the Foundational Series and acceptance tests." onClick={() => goToTab(LAB_TAB)} />
            <HomeCard icon={BookOpen} title="Publications" body="Read the published, receipted findings reports." onClick={() => goToTab(REPORTS_TAB)} />
            <HomeCard icon={Users} title="Participation" body="Your standing, agreements, and locker." onClick={() => goToTab(PARTICIPATION_TAB)} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            We treat reasoning as a substrate: validated reasoning is captured as structural invariants so both human and
            machine cognition can reuse it. We&apos;re not asking you to agree with our conclusions — we invite you to
            inspect our methods, execute the experiments independently, and tell us where we&apos;re wrong.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-sm font-semibold text-slate-200">How to join</h2>
            <ol className="mt-3 space-y-2">
              {[
                "Read the research programme and reviewer materials",
                "Apply for a Polity Passport (weak proof of humanity is enough to start)",
                "Accept the constitutional agreement",
                "Delegate your AI agent (bounded authority)",
                "Fetch the protocol and invariant corpus",
                "Execute experiments and submit receipted results",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-300">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-700 text-[9px] text-slate-400">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-start gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your agent may prepare and administer; accepting terms, claiming, and delegating remain yours.
            </p>
          </div>

          {/* Two prominent, equal setup routes — either path takes you all the
              way through accession. Human (green) = do it yourself; Agent
              (magenta) = delegate an agent to administer it for you. */}
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Choose how to set up — either route works</p>
          {/* Liquid-glass setup routes (operator 2026-07-19): translucent accent
              tint + backdrop blur per the house glass style — human = emerald,
              agent = violet (the page accent), never solid fills. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => goToTab(HUMAN_TAB)}
              className="group flex flex-col items-start gap-1 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-4 text-left shadow-lg shadow-black/30 transition hover:bg-emerald-500/25"
              style={{ backdropFilter: "blur(16px) saturate(140%)" }}
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <UserRound className="h-4 w-4 text-emerald-300" /> Set up myself
                <ArrowRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
              </span>
              <span className="text-[11px] leading-snug text-slate-300">
                Walk the accession yourself — apply for your Passport, accept the agreement, and run experiments directly.
              </span>
            </button>
            <button
              onClick={() => goToTab(DELEGATION_TAB)}
              className="group flex flex-col items-start gap-1 rounded-2xl border border-violet-500/40 bg-violet-500/15 px-5 py-4 text-left shadow-lg shadow-black/30 transition hover:bg-violet-500/25"
              style={{ backdropFilter: "blur(16px) saturate(140%)" }}
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-100">
                <Bot className="h-4 w-4 text-violet-300" /> Set up with my agent
                <ArrowRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
              </span>
              <span className="text-[11px] leading-snug text-slate-300">
                Delegate an AI agent to administer the setup on your behalf — you still hold the keys (accept terms, claim, delegate).
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function HomeCard({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-violet-500/40 hover:bg-slate-900/70"
    >
      <Icon className="h-4 w-4 text-violet-300" />
      <div className="mt-2 text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{body}</div>
    </button>
  );
}

export default IRLWelcomeTab;
