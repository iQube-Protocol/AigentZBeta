"use client";

import { useMemo } from "react";

type ExperienceLike = {
  configuration?: Record<string, any>;
  metadata?: Record<string, any>;
};

interface ExperienceContextSidebarProps {
  experience?: ExperienceLike;
  packet?: Record<string, any> | null;
  theme?: "light" | "dark";
}

export function ExperienceContextSidebar({
  experience,
  packet,
  theme = "dark",
}: ExperienceContextSidebarProps) {
  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200";
  const textClass = isDark ? "text-white" : "text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  const config = experience?.configuration || {};
  const metadata = experience?.metadata || {};
  const intentConfig = config.intent_timebox || {};
  const walletConfig = config.wallet_rewards || {};
  const copilotConfig = config.copilot_output || {};
  const contentConfig = config.content_selection || {};

  // Resolve values from packet.intent.constraints first (live packet), then fall back to config
  const packetIntent = packet?.intent?.constraints || {};
  const issueSlug = packetIntent.issue_slug || contentConfig.issue_slug || "issue-1";
  const goal = packetIntent.goal || intentConfig.goal || "reading sprint";
  const timeAvailable = packetIntent.time_available || intentConfig.time_available || "15";
  const depth = packetIntent.depth || intentConfig.depth || "overview";

  const unlockPrice = Number(walletConfig.unlock_price || 0);
  const rewardAmount = Number(walletConfig.reward_amount || 0);
  const requiresConnect = walletConfig.require_wallet_connect !== false;

  const gates = useMemo(() => {
    const list: string[] = [];
    if (requiresConnect) list.push("connect");
    if (unlockPrice > 0) list.push("pay");
    return list;
  }, [requiresConnect, unlockPrice]);

  const dprLatest = metadata.dprLatest || null;
  const dprReceipts = Array.isArray(metadata.dprReceipts) ? metadata.dprReceipts : [];
  const dprDvnEvents = Array.isArray(metadata.dprDvnEvents) ? metadata.dprDvnEvents : [];
  const latestDprReceipt = dprReceipts[dprReceipts.length - 1] || null;
  const latestDvnEvent = dprDvnEvents[dprDvnEvents.length - 1] || null;

  // Derive skill/media context from packet for image/video experiences
  const packetType = packet?.packet_type;
  const skillId = packet?.skill?.skill_id;
  const providerId = packet?.image_generation?.provider_id || packet?.context?.working_set?.provider_id;
  const mediaContext =
    packetType === "skill_video"
      ? skillId === "venice_video_gen"
        ? "Venice Video Generation"
        : skillId === "sora_video_gen_community"
          ? "Sora (Community)"
          : "OpenAI Sora"
      : packetType === "skill_image"
        ? providerId === "venice"
          ? "Venice Image Generation"
          : "OpenAI Image Generation"
        : null;

  return (
    <aside className={`rounded-2xl border ${panelClass} p-5 space-y-4`}>
      {/* Experience Context */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Experience Context</div>
        <div className={`mt-2 text-sm ${textClass}`}>Issue {issueSlug}</div>
        <div className={`mt-2 text-xs ${mutedClass}`}>Goal: {goal}</div>
        <div className={`text-xs ${mutedClass}`}>Time: {timeAvailable} mins</div>
        <div className={`text-xs ${mutedClass}`}>Depth: {depth}</div>
        {mediaContext && (
          <div className={`mt-1.5 text-xs ${mutedClass}`}>Skill: {mediaContext}</div>
        )}
      </div>

      {/* Wallet Gates */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Wallet Gates</div>
        <div className={`mt-1 text-sm ${textClass}`}>
          {gates.length ? gates.join(" + ") : "None"}
        </div>
        <div className={`mt-2 text-xs ${mutedClass}`}>
          Unlock: {unlockPrice > 0 ? `${unlockPrice} Qc` : "Free"} / Reward:{" "}
          {rewardAmount > 0 ? `${rewardAmount} Qc` : "None"}
        </div>
      </div>

      {/* Copilot Outputs */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Copilot Outputs</div>
        <ul className={`mt-2 space-y-2 text-sm ${textClass}`}>
          {Array.isArray(copilotConfig.outputs) && copilotConfig.outputs.length > 0 ? (
            copilotConfig.outputs.map((output: string) => <li key={output}>{output}</li>)
          ) : (
            <li className={mutedClass}>No outputs configured</li>
          )}
        </ul>
      </div>

      {/* Sprint Checklist */}
      <div
        className={`rounded-xl border ${
          isDark ? "border-slate-700 bg-slate-900/60" : "border-slate-200"
        } p-4`}
      >
        <div className={`text-xs ${mutedClass}`}>Sprint checklist</div>
        <ul className={`mt-2 space-y-2 text-sm ${textClass}`}>
          <li>1. Open the feature article</li>
          <li>2. Read with preview + unlock</li>
          <li>3. Capture copilot takeaways</li>
          <li>4. Save the takeaways card</li>
        </ul>
      </div>

      {/* DPR Summary */}
      <div
        className={`rounded-xl border ${
          isDark
            ? "border-indigo-500/30 bg-indigo-500/10"
            : "border-indigo-200 bg-indigo-50"
        } p-4`}
      >
        <div className={`text-xs uppercase tracking-wide ${mutedClass}`}>DPR Summary</div>
        {dprLatest ? (
          <div className={`mt-2 space-y-1 text-xs ${textClass}`}>
            <div>Score: {dprLatest.score ?? "n/a"}/100</div>
            <div>Violations: {dprLatest.violations ?? "n/a"}</div>
            <div>Checks: {dprLatest.checks?.totalChecks ?? "n/a"}</div>
            <div className={mutedClass}>{dprLatest.summary || "Latest parity run recorded."}</div>
          </div>
        ) : (
          <div className={`mt-2 text-xs ${mutedClass}`}>No DPR run recorded yet.</div>
        )}
        <div className={`mt-3 text-[11px] ${mutedClass}`}>
          DVN Event: {latestDvnEvent?.id || "pending"}
        </div>
        <div className={`text-[11px] ${mutedClass}`}>
          Receipt: {latestDprReceipt?.receiptId || "pending"}
        </div>
      </div>
    </aside>
  );
}
