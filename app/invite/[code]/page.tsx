"use client";

/**
 * /invite/[code] — the accession invitation page (operator + Aletheon,
 * 2026-07-19), made PASSPORT-AWARE and SELF-COMPLETING by the invitation
 * sequencing ruling (operator, 2026-08-02).
 *
 * The single entry point of every collaboration: the email is just a
 * wrapper; THIS page is the human-readable face of the accession
 * constitutional object, and /api/public/irl/accession?code=… is its
 * machine-readable twin (the "For AI agents" endpoint below).
 *
 * ── WHAT THE 2026-08-02 RULING CORRECTED ───────────────────────────────────
 *
 * PRIOR DEFECT 1 — the page was blind to the visitor. It rendered exactly
 * two shapes, chosen only from the INVITATION's status: unclaimed → the
 * onboarding ladder; claimed → "Continue in the Lab". It never asked who was
 * looking. An existing Passport holder arriving at an unclaimed invitation
 * was shown the full create-account/create-persona/apply-for-Passport ladder
 * they had already completed — the ruling's "do not force an existing
 * Passport holder through account, persona, or Passport creation again".
 *
 * PRIOR DEFECT 2 — the claim happened somewhere else. To accept, the visitor
 * had to navigate into the Locker and paste their code into a form, even
 * though the page they were already standing on knew the code. Invitation
 * acceptance is an accession act and belongs BEFORE programme entry, on the
 * invitation itself.
 *
 * PRIOR DEFECT 3 — the destination was generic. Both "Continue in the Lab"
 * and the post-sign-in landing resolved to the IRL OS cartridge root, whose
 * first tab is a general Welcome screen. An invitation that already knows it
 * is scoped to EXP-P1 must deep-link to the Validation Programme. The
 * destination is now DERIVED server-side from the invitation's own scope
 * (`/api/public/irl/accession` → `destination`), never hardcoded here.
 *
 * ── THE THREE STATES (ruling §1) ───────────────────────────────────────────
 *
 *   A. Passport holder, not signed in  → "Sign in" and "Continue with your
 *      agent", equally prominent. Sign-in runs the platform's established
 *      hierarchy (Passport → passkey/wallet password → username/password)
 *      via the canonical PassportConnectPanel — never a second sign-in UI.
 *   B. Signed in, invitation unclaimed → the claim control itself, right
 *      here. Reuses /api/participation/claim (the SAME authority check the
 *      Locker's claim uses); never a second acceptance mechanism.
 *   C. No Passport → "Have your agent get you started" and "Begin yourself",
 *      equally prominent. Neither route is visually privileged.
 *
 * ── ROUTING (ruling: the next constitutional act) ──────────────────────────
 *
 * Which of those renders is decided by `resolveNextConstitutionalAct`
 * (services/journey/nextConstitutionalAct.ts) — the platform-wide resolver,
 * not an `if` chain private to this page. After a successful sign-in or a
 * successful claim, this page re-observes and advances to the next act
 * rather than routing anywhere generic. Only once the invitation is claimed
 * does the programme destination become the offer.
 *
 * ── FAIL FAITHFUL ──────────────────────────────────────────────────────────
 *
 * `/api/participation/my-access` failing does NOT render as "you are signed
 * out" — that would invite an already-onboarded reviewer to redo accession.
 * An unresolved fact stays `null`, the resolver returns its `observe` act,
 * and the page says so while keeping the agent handoff and the protocol doc
 * (both genuinely public) reachable.
 */

import React, { use, useCallback, useEffect, useState } from "react";
import { ArrowRight, Bot, Check, Copy, FileText, Loader2, ShieldCheck, AlertTriangle, UserCircle2 } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import { PassportConnectPanel } from "@/components/companion/PassportConnectPanel";
import {
  resolveNextConstitutionalAct,
  type NextConstitutionalAct,
} from "@/services/journey/nextConstitutionalAct";

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
  /** Server-derived from the invitation's own scope — never built here. */
  destination?: { url: string; label: string };
  allowedExperiments?: string[] | null;
  constitutionalBoundary: string;
  error?: string;
}

/** The caller's own participation state (`/api/participation/my-access`). */
interface SelfView {
  authenticated: boolean;
  passportIssued: boolean;
  grants: Array<{ accessDomain: string; role: string }>;
}

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [accession, setAccession] = useState<Accession | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentCopied, setAgentCopied] = useState(false);

  /** `null` = not yet resolved (or unresolvable). NEVER coerced to false. */
  const [selfView, setSelfView] = useState<SelfView | null>(null);
  const [selfViewFailed, setSelfViewFailed] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const loadAccession = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/irl/accession?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      setAccession(await res.json());
    } catch {
      setAccession({ ok: false } as Accession);
    }
  }, [code]);

  /** The caller's own state. Spine endpoint → personaFetch, never raw fetch. */
  const loadSelfView = useCallback(async () => {
    try {
      const res = await personaFetch("/api/participation/my-access", { cache: "no-store" });
      if (!res.ok) {
        setSelfViewFailed(true);
        return;
      }
      const body = await res.json();
      setSelfViewFailed(false);
      setSelfView({
        authenticated: !!body?.authenticated,
        passportIssued: !!body?.passportIssued,
        grants: Array.isArray(body?.grants) ? body.grants : [],
      });
    } catch {
      // UNKNOWN, not signed-out — see this file's FAIL FAITHFUL note.
      setSelfViewFailed(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadAccession(), loadSelfView()]);
      setLoading(false);
    })();
  }, [loadAccession, loadSelfView]);

  const agentUrl = `/api/public/irl/accession?code=${encodeURIComponent(code)}`;
  const beginUrl = accession?.resources?.passportApply ?? "#";
  // Server-derived from the invitation's scope; the cartridge root is the
  // honest fallback for an invitation that names no programme.
  const destination = accession?.destination ?? {
    url: accession?.resources?.dashboard ?? "#",
    label: "Continue in the Lab",
  };

  // The invitation is claimed if the SERVER said so, or if we just claimed it
  // in this session. `null` while unresolved — never guessed.
  const invitationClaimed: boolean | null = claimed ? true : accession ? accession.onboarded : null;

  const act: NextConstitutionalAct = resolveNextConstitutionalAct({
    authenticated: selfViewFailed ? null : selfView ? selfView.authenticated : null,
    invitationPresent: !!accession?.ok,
    invitationClaimed,
  });

  const claimInvitation = useCallback(async () => {
    setClaimError(null);
    setClaiming(true);
    try {
      const res = await personaFetch("/api/participation/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setClaimError(body?.error ?? "This invitation could not be accepted. It may have expired or been revoked.");
        return;
      }
      setClaimed(true);
      // Re-observe: the claim changed the caller's grants, and the next act
      // is now programme entry. Never route anywhere generic in between.
      await Promise.all([loadAccession(), loadSelfView()]);
    } catch {
      setClaimError("This invitation could not be accepted right now. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [code, loadAccession, loadSelfView]);

  // One-click agent handoff: a ready-to-paste prompt the user drops into their
  // agent (Claude, etc.). The agent reads the accession object and administers
  // onboarding; the human still performs passport, claim, and delegation.
  const agentHandoff = (() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const invitePage = typeof window !== "undefined" ? window.location.href : "";
    return [
      "Please help me join the Invariant Research Lab as a reviewer and administer my onboarding.",
      "Read my accession invitation below and walk me through it — you may prepare, explain, and fetch materials, but I will perform the human steps (applying for my Passport, claiming the invitation, and delegating authority to you).",
      "",
      `Invitation: ${invitePage}`,
      `Machine-readable accession object (fetch this first): ${origin}${agentUrl}`,
    ].join("\n");
  })();

  const copyAgentHandoff = () => {
    navigator.clipboard.writeText(agentHandoff);
    setAgentCopied(true);
    setTimeout(() => setAgentCopied(false), 2500);
  };

  /* ── Sub-renders ─────────────────────────────────────────────────────── */

  const agentCard = (title: string, body: string) => (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-violet-300" />
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{body}</p>
      <button
        onClick={copyAgentHandoff}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
      >
        {agentCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {agentCopied ? "Copied — paste it to your agent" : "Provide to your agent"}
      </button>
      <a href={agentUrl} className="mt-3 block text-[11px] text-violet-300/70 hover:text-violet-200">
        Or view the machine-readable accession object (JSON) →
      </a>
    </div>
  );

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
              {invitationClaimed ? "Welcome back." : "You are invited."}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {invitationClaimed ? (
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
                {invitationClaimed ? "Where you are" : "How it works"}
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

            {/* ── THE NEXT CONSTITUTIONAL ACT ─────────────────────────────
                One resolver decides which of these renders; the page never
                branches on "did they arrive from the email or the app". */}

            {/* observe — a required fact is unknown. Say so; never guess a
                step, and never present an unknown as "signed out". */}
            {act.id === "observe" ? (
              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {act.label}
                </div>
                <p className="mt-2 text-[13px] text-slate-400">{act.because}</p>
                {selfViewFailed ? (
                  <>
                    <p className="mt-2 text-[13px] text-amber-300">
                      We could not confirm your sign-in state just now. If you already have access, it is unaffected —
                      nothing here has changed it.
                    </p>
                    <button
                      onClick={() => {
                        setSelfViewFailed(false);
                        void loadSelfView();
                      }}
                      className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-900"
                    >
                      Check again
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* authenticate — STATE A (has Passport) or STATE C (does not).
                Both offer the agent route and the human route at EQUAL
                prominence; neither is styled as the privileged one. */}
            {act.id === "authenticate" ? (
              showSignIn ? (
                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40">
                  <PassportConnectPanel
                    world="application"
                    embedded
                    onConnected={() => {
                      setShowSignIn(false);
                      // Re-observe and advance to the next act — never to a
                      // generic landing page.
                      void loadSelfView();
                      void loadAccession();
                    }}
                  />
                  <button
                    onClick={() => setShowSignIn(false)}
                    className="w-full rounded-b-2xl border-t border-slate-800 px-4 py-2.5 text-[12px] text-slate-400 transition hover:text-slate-200"
                  >
                    Back
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-8 text-[13px] text-slate-400">{act.because}</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {selfView?.passportIssued === false ? (
                      <>
                        {agentCard(
                          "Have your agent get you started",
                          "Your AI agent reads this invitation and administers your onboarding, while you perform the human steps.",
                        )}
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                          <div className="flex items-center gap-2">
                            <UserCircle2 className="h-5 w-5 text-slate-300" />
                            <h2 className="text-sm font-semibold text-slate-100">Begin yourself</h2>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
                            Create your account and persona, then apply for your Polity Passport. You will return here
                            to accept the invitation.
                          </p>
                          <a
                            href={beginUrl}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
                          >
                            Begin yourself
                            <ArrowRight className="h-4 w-4" />
                          </a>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-emerald-400" />
                            <h2 className="text-sm font-semibold text-slate-100">Sign in</h2>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
                            Already have a Passport? Sign in with it — there is nothing to create again.
                          </p>
                          <button
                            onClick={() => setShowSignIn(true)}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
                          >
                            Sign in
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                        {agentCard(
                          "Continue with your agent",
                          "Hand this invitation to your AI agent — it administers the onboarding while you perform the human steps.",
                        )}
                      </>
                    )}
                  </div>
                  {selfView?.passportIssued !== false ? (
                    <a
                      href={beginUrl}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200"
                    >
                      No Passport yet? Begin yourself
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </>
              )
            ) : null}

            {/* claim-invitation — STATE B. The claim lives HERE, on the
                invitation, not behind a manual trip into the Locker. */}
            {act.id === "claim-invitation" ? (
              <div className="mt-8 rounded-2xl border border-violet-500/40 bg-violet-500/10 p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-violet-300" />
                  <h2 className="text-sm font-semibold text-slate-100">Accept your invitation</h2>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{act.because}</p>
                <p className="mt-2 text-[12px] text-slate-400">
                  You are accepting the role of <span className="text-violet-200">{accession.role}</span> in{" "}
                  <span className="text-slate-200">{accession.programme}</span>
                  {accession.allowedExperiments?.length
                    ? <>, scoped to <span className="text-slate-200">{accession.allowedExperiments.join(", ")}</span></>
                    : null}
                  .
                </p>
                {claimError ? (
                  <p className="mt-3 flex items-start gap-1.5 text-[13px] text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {claimError}
                  </p>
                ) : null}
                <button
                  onClick={() => void claimInvitation()}
                  disabled={claiming}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {claiming ? "Accepting…" : act.label}
                </button>
              </div>
            ) : null}

            {/* enter-programme — claimed. The destination is the invitation's
                OWN scoped programme, resolved server-side. */}
            {act.id === "enter-programme" ? (
              <>
                {claimed ? (
                  <div className="mt-8 flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <p className="text-[13px] text-emerald-200">
                      Access granted. Your reviewer access is active.
                    </p>
                  </div>
                ) : null}
                <a
                  href={destination.url}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  {destination.label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </>
            ) : null}

            {accession.resources?.protocolDoc && (
              <a
                href={accession.resources.protocolDoc}
                className="mt-6 flex items-center gap-1.5 border-t border-slate-800 pt-5 text-[12px] text-slate-400 hover:text-slate-200"
              >
                <FileText className="h-3.5 w-3.5" /> Experimental protocol (EXP-P1)
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
