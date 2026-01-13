"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

type ExperienceQube = {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: string;
  configuration: Record<string, any>;
};

const ARTICLE_LABELS: Record<string, string> = {
  "d51579d4-6dad-48d6-9c1a-5b0904fd46f4": "The Penny Is Dead, Long Live the Penny",
  "fa4eada5-1908-477f-9fe2-d983ce95b7e8": "The Great Rebundling: Why Studio M&A Signals a Unit Economics Crisis",
  "7fcaffe0-1208-4af0-b7a6-c38dfb1a6503": "QriptoMedia: From Media Files to Media Objects",
  "c6df8819-2420-465a-a42e-e14792f76f6d": "Facebook buys Manus: You are no longer the product. Your Action is.",
};

export const ComposerExperienceViewer = ({ experienceId }: { experienceId: string }) => {
  const router = useRouter();
  const [experience, setExperience] = useState<ExperienceQube | null>(null);
  const [packet, setPacket] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPacket, setShowPacket] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/composer/experiences/${experienceId}`);
        if (!res.ok) throw new Error("Failed to load experience");
        const data = await res.json();
        if (!active) return;
        setExperience(data.experience_qube);

        const packetRes = await fetch(`/api/composer/experiences/${experienceId}/packet`);
        if (packetRes.ok) {
          const packetData = await packetRes.json();
          if (active) setPacket(packetData.packet || null);
        }
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load experience");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [experienceId]);

  const config = experience?.configuration || {};
  const intent = config.intent_timebox || {};
  const content = config.content_selection || {};
  const wallet = config.wallet_rewards || {};
  const copilot = config.copilot_output || {};

  const featureLabel = content.feature_item_id
    ? ARTICLE_LABELS[content.feature_item_id] || content.feature_item_id
    : "—";
  const supportingLabels = Array.isArray(content.supporting_item_ids)
    ? content.supporting_item_ids.map((id: string) => ARTICLE_LABELS[id] || id)
    : [];

  const gates = useMemo(() => {
    const list = [];
    if (wallet.require_wallet_connect !== false) list.push("connect");
    if (Number(wallet.unlock_price || 0) > 0) list.push("pay");
    return list;
  }, [wallet]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading experience...
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <button
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
            onClick={() => router.push("/studio/composer")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Composer
          </button>
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
            {error || "Experience not found."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <button
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          onClick={() => router.push("/studio/composer")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Composer
        </button>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-2xl font-semibold text-white">{experience.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{experience.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-700 px-2 py-0.5">{experience.status}</span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5">{experience.template_id}</span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5">{experience.tenant_id}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Intent + Timebox</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <div>Goal: <span className="text-slate-100">{intent.goal || "—"}</span></div>
              <div>Time: <span className="text-slate-100">{intent.time_available || "—"} mins</span></div>
              <div>Depth: <span className="text-slate-100">{intent.depth || "—"}</span></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Content Selection</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <div>Feature: <span className="text-slate-100">{featureLabel}</span></div>
              <div>Issue: <span className="text-slate-100">{content.issue_slug || "—"}</span></div>
              <div>Preview: <span className="text-slate-100">{content.preview_enabled ? "Enabled" : "Full only"}</span></div>
              <div>Supporting:</div>
              <ul className="list-disc pl-5 text-slate-100">
                {supportingLabels.length ? supportingLabels.map((label) => (
                  <li key={label}>{label}</li>
                )) : <li>—</li>}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Wallet + Copilot</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <div>Unlock Price: <span className="text-slate-100">{wallet.unlock_price ?? "—"} Qc</span></div>
              <div>Reward: <span className="text-slate-100">{wallet.reward_amount ?? "—"} Qc</span></div>
              <div>Required Gates: <span className="text-slate-100">{gates.length ? gates.join(", ") : "—"}</span></div>
              <div>Copilot Outputs:</div>
              <ul className="list-disc pl-5 text-slate-100">
                {Array.isArray(copilot.outputs) && copilot.outputs.length
                  ? copilot.outputs.map((output: string) => <li key={output}>{output}</li>)
                  : <li>—</li>}
              </ul>
            </div>
          </section>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Reading Sprint Scaffold</h2>
            <button
              onClick={() => setShowPacket((prev) => !prev)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              {showPacket ? "Hide Packet" : "Show Packet"}
            </button>
          </div>
          <div className="mt-3 grid gap-3 text-sm text-slate-300">
            <div>Step 1: Curated shelf loads the feature + supporting items.</div>
            <div>Step 2: Reader opens in preview (if enabled) with wallet gate.</div>
            <div>Step 3: Copilot generates takeaways + glossary + next action.</div>
            <div>Step 4: User saves takeaways, reward receipt is issued.</div>
          </div>
          {showPacket && (
            <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-slate-200">
              {JSON.stringify(packet, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
