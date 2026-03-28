"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { LiquidUIPlaceholderTemplate } from "@/app/triad/components/codex/liquidTemplates/LiquidUIPlaceholderTemplate";
import { ExperienceBlockHeader } from "@/components/composer/ExperienceBlockChrome";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";
import SkillImagePlayer from "@/components/composer/SkillImagePlayer";
import { BookOpen, ChevronDown, ChevronUp, Headphones, Loader2, PencilLine, Square } from "lucide-react";

type ArticleDraftSection = {
  heading: string;
  body: string;
};

type ArticleDraftGlossaryEntry = {
  term: string;
  definition: string;
};

function buildTTSText(article: {
  title?: string; deck?: string; opening?: string;
  sections?: Array<{ heading?: string; body?: string }>;
  takeaways?: string[];
}): string {
  const parts: string[] = [];
  if (article.title) parts.push(article.title + ".");
  if (article.deck) parts.push(article.deck);
  if (article.opening) parts.push(article.opening);
  article.sections?.forEach(s => {
    if (s.heading) parts.push(s.heading + ".");
    if (s.body) parts.push(s.body);
  });
  if (article.takeaways?.length) {
    parts.push("Key takeaways.");
    parts.push(...article.takeaways.map(t => t + "."));
  }
  return parts.join(" ");
}

function CompositionBundleBrief({
  packet,
  experienceId,
}: {
  packet: Record<string, any>;
  experienceId: string;
}) {
  const router = useRouter();
  const [articleExpanded, setArticleExpanded] = useState(false);
  const [ttsState, setTtsState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, []);
  const composition =
    packet?.composition && typeof packet.composition === "object" ? packet.composition : null;
  const sequencingState =
    composition && composition.sequencing_state && typeof composition.sequencing_state === "object"
      ? composition.sequencing_state
      : null;
  const bundleBlocks =
    sequencingState && Array.isArray((sequencingState as any).blocks)
      ? ((sequencingState as any).blocks as Array<Record<string, any>>)
      : [];

  const articleDraft =
    packet?.article_draft && typeof packet.article_draft === "object" ? packet.article_draft : null;
  const articleGenerated =
    articleDraft?.generated && typeof articleDraft.generated === "object" ? articleDraft.generated : null;
  const articleSections: ArticleDraftSection[] = Array.isArray(articleGenerated?.sections)
    ? articleGenerated.sections.filter(
        (section: unknown): section is ArticleDraftSection =>
          Boolean(
            section &&
              typeof section === "object" &&
              !Array.isArray(section) &&
              typeof (section as ArticleDraftSection).heading === "string" &&
              typeof (section as ArticleDraftSection).body === "string",
          ),
      )
    : [];
  const articleTakeaways: string[] = Array.isArray(articleGenerated?.takeaways)
    ? articleGenerated.takeaways.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const articleGlossary: ArticleDraftGlossaryEntry[] = Array.isArray(articleGenerated?.glossary)
    ? articleGenerated.glossary.filter(
        (item: unknown): item is ArticleDraftGlossaryEntry =>
          Boolean(
            item &&
              typeof item === "object" &&
              !Array.isArray(item) &&
              typeof (item as ArticleDraftGlossaryEntry).term === "string" &&
              typeof (item as ArticleDraftGlossaryEntry).definition === "string",
          ),
      )
    : [];
  const sequencing: string[] = Array.isArray(composition?.sequencing)
    ? composition.sequencing.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const nextActions: string[] = Array.isArray(composition?.nextActions)
    ? composition.nextActions.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const blockKinds: string[] = Array.isArray(composition?.blockKinds)
    ? composition.blockKinds.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const visibleArticleSections = articleExpanded ? articleSections : articleSections.slice(0, 2);
  const canExpandArticle =
    articleSections.length > visibleArticleSections.length ||
    articleTakeaways.length > 0 ||
    articleGlossary.length > 0 ||
    Boolean(articleGenerated?.nextAction);
  if (!composition && !articleDraft) return null;

  const handleEditDraft = () => {
    const params = new URLSearchParams({
      experienceId,
      panel: "customizer",
      bundleBlock: "article_draft",
    });
    router.push(`/studio/composer?${params.toString()}`);
  };

  const handleListen = async () => {
    if (ttsState !== "idle") {
      audioRef.current?.pause();
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      setTtsState("idle");
      return;
    }
    if (!articleDraft) return;
    setTtsState("loading");
    try {
      const text = buildTTSText(
        articleGenerated ?? {
          title: typeof articleDraft.title === "string" ? articleDraft.title : "",
        },
      );
      const res = await fetch("/api/skills/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (blobUrlRef.current === url) { URL.revokeObjectURL(url); blobUrlRef.current = null; }
        setTtsState("idle");
      };
      setTtsState("playing");
      audio.play().catch(() => {
        if (blobUrlRef.current === url) { URL.revokeObjectURL(url); blobUrlRef.current = null; }
        audioRef.current = null;
        setTtsState("error");
        setTimeout(() => setTtsState((s) => (s === "error" ? "idle" : s)), 3000);
      });
    } catch {
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      setTtsState("error");
      setTimeout(() => setTtsState((s) => (s === "error" ? "idle" : s)), 3000);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-200">
      {composition ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">Make Bundle</div>
            <div className="mt-1 text-base font-semibold text-white">
              {typeof composition.label === "string" ? composition.label : "Composed experience"}
            </div>
            {typeof composition.bundleTemplateLabel === "string" && composition.bundleTemplateLabel ? (
              <div className="mt-1 text-xs text-slate-400">{composition.bundleTemplateLabel}</div>
            ) : null}
            {typeof composition.summary === "string" && composition.summary ? (
              <div className="mt-1 text-sm text-slate-300">{composition.summary}</div>
            ) : null}
          </div>
          {typeof composition.media_mode === "string" ? (
            <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200">
              {composition.media_mode}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">Article Companion</div>
            <div className="mt-1 text-base font-semibold text-white">
              {typeof articleDraft?.title === "string" && articleDraft.title ? articleDraft.title : "Editorial draft"}
            </div>
          </div>
        </div>
      )}

      {composition && blockKinds.length > 0 ? (
        <div className="mt-3 text-xs text-slate-400">Blocks: {blockKinds.join(" · ")}</div>
      ) : null}
      {composition && bundleBlocks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {bundleBlocks.map((block) => (
            <span
              key={String(block.kind)}
              className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300"
            >
              {String(block.label || block.kind)} · {String(block.status || "not_started").replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : null}

      {composition && sequencingState ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bundle Progress</div>
            {typeof sequencingState.progressLabel === "string" ? (
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300">
                {sequencingState.progressLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
            <div>
              <div className="text-slate-500">Completed</div>
              <div className="mt-1 text-slate-200">
                {Array.isArray(sequencingState.completedBlocks) && sequencingState.completedBlocks.length > 0
                  ? sequencingState.completedBlocks.join(" · ")
                  : "None yet"}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Active now</div>
              <div className="mt-1 text-white">
                {typeof sequencingState.activeBlock === "string" ? sequencingState.activeBlock : "Bundle complete"}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Next</div>
              <div className="mt-1 text-slate-200">
                {typeof sequencingState.nextBlock === "string" ? sequencingState.nextBlock : "Ready to deploy/use"}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {articleDraft ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <ExperienceBlockHeader
            kind="copy"
            title="Article Draft"
            mobileTitle="Copy"
            rightActions={
              <>
                {articleDraft ? (
                  <button
                    type="button"
                    onClick={() => void handleListen()}
                    disabled={ttsState === "loading"}
                    title={ttsState === "playing" ? "Stop reading" : ttsState === "error" ? "TTS failed — click to dismiss" : "Listen with Marketa"}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${
                      ttsState === "playing"
                        ? "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                        : ttsState === "error"
                        ? "border border-red-500/40 bg-red-500/10 text-red-400"
                        : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
                    }`}
                  >
                    {ttsState === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : ttsState === "playing" ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <Headphones className="h-3.5 w-3.5" />
                    )}
                    <span>{ttsState === "playing" ? "Stop" : ttsState === "loading" ? "…" : ttsState === "error" ? "Error" : "Listen"}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setArticleExpanded((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 px-2.5 py-1 text-[11px] text-cyan-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{articleExpanded ? "Collapse" : "Read Draft"}</span>
                  {articleExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleEditDraft}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  <span>Edit Draft</span>
                </button>
              </>
            }
            className="flex items-center justify-between pb-3"
          />
          <div className="mt-1 font-medium text-white">
            {typeof articleDraft.title === "string" && articleDraft.title ? articleDraft.title : "Editorial draft"}
          </div>
          {typeof articleGenerated?.deck === "string" && articleGenerated.deck ? (
            <div className="mt-3 text-sm text-slate-300">{articleGenerated.deck}</div>
          ) : null}
          {typeof articleGenerated?.opening === "string" && articleGenerated.opening ? (
            <div className="mt-2 text-xs text-slate-400">{articleGenerated.opening}</div>
          ) : null}
          {articleSections.length > 0 ? (
            <div className="mt-3 space-y-2">
              {visibleArticleSections.map((section) => (
                <div key={section.heading} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {section.heading}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">{section.body}</div>
                </div>
              ))}
            </div>
          ) : null}
          {!articleExpanded && articleSections.length > visibleArticleSections.length ? (
            <div className="mt-3 text-xs text-slate-500">
              {articleSections.length - visibleArticleSections.length} more sections available in the full draft.
            </div>
          ) : null}
          {articleExpanded && articleTakeaways.length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Takeaways</div>
              <div className="mt-2 space-y-2 text-xs text-slate-300">
                {articleTakeaways.map((takeaway) => (
                  <div key={takeaway}>{takeaway}</div>
                ))}
              </div>
            </div>
          ) : null}
          {articleExpanded && articleGlossary.length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Glossary</div>
              <div className="mt-2 space-y-2 text-xs text-slate-300">
                {articleGlossary.map((entry) => (
                  <div key={entry.term}>
                    <span className="font-medium text-white">{entry.term}:</span> {entry.definition}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {typeof articleGenerated?.nextAction === "string" && articleGenerated.nextAction ? (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">
              <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Next Action</div>
              <div className="mt-1">{articleGenerated.nextAction}</div>
            </div>
          ) : null}
          {canExpandArticle ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setArticleExpanded((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 px-2.5 py-1 text-[11px] text-cyan-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{articleExpanded ? "Show Summary" : "Read Full Draft"}</span>
              </button>
              <button
                type="button"
                onClick={handleEditDraft}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                <PencilLine className="h-3.5 w-3.5" />
                <span>Edit in Customizer</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sequencing</div>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {sequencing.map((step) => (
              <div key={step}>{step}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Next Actions</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {nextActions.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
};

interface ExperienceLiquidRendererProps {
  experience: ExperienceQube;
  packet: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
}

export function ExperienceLiquidRenderer({
  experience,
  packet,
  theme = "dark",
  personaId,
}: ExperienceLiquidRendererProps) {
  const templateKey = packet?.ui?.primary_template as string | undefined;

  if (!packet) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
        Waiting for the experience packet...
      </div>
    );
  }

  // Skill-backed experience: render SkillVideoPlayer
  if (templateKey === "skill:video_player_v1" && packet.skill) {
    return (
      <>
        <CompositionBundleBrief packet={packet} experienceId={experience.id} />
        <SkillVideoPlayer
          skill_id={packet.skill.skill_id}
          prompt={packet.skill.prompt}
          duration={packet.skill.duration}
          aspect_ratio={packet.skill.aspect_ratio}
          style={packet.skill.style}
          creative_pack={packet.skill.creative_pack}
          experience_id={experience.id}
          trust_override={packet.skill.trust_override}
          initial_video_url={packet.skill.video_url}
          initial_receipt={packet.skill.initial_receipt}
          persona_id={personaId}
          initial_generation_id={packet.skill.generation_id}
          initial_venice_model={packet.skill.venice_model_for_status}
        />
      </>
    );
  }

  if (templateKey === "skill:image_player_v1" && packet.image_generation) {
    return (
      <>
        <CompositionBundleBrief packet={packet} experienceId={experience.id} />
        <SkillImagePlayer
          provider_id={packet.image_generation.provider_id}
          portrait_prompt={packet.image_generation.portrait_prompt}
          landscape_prompt={packet.image_generation.landscape_prompt}
          visual_style={packet.image_generation.visual_style}
          experience_id={experience.id}
          autoInvoke={packet.image_generation.auto_invoke !== false}
          initial_images={packet.image_generation.initial_images}
          initial_receipt={packet.image_generation.initial_receipt}
          persona_id={personaId}
        />
      </>
    );
  }

  // Standard Liquid UI template resolution
  const Template = templateKey ? liquidTemplateRegistry[templateKey] : undefined;
  const fallbackTemplate =
    liquidTemplateRegistry["liquidui:drawer_grid_2a"] ||
    liquidTemplateRegistry["liquidui:drawer_grid_v1"] ||
    liquidTemplateRegistry["knyt:drawer_grid_v1"];
  const useFallback = !Template || Template === LiquidUIPlaceholderTemplate;
  const ResolvedTemplate = useFallback ? fallbackTemplate : Template;

  if (!ResolvedTemplate) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-200">
        Liquid UI template not found for {templateKey || "unknown template"}.
      </div>
    );
  }

  return (
    <ResolvedTemplate
      theme={theme}
      personaId={personaId}
      packet={packet}
      experience={experience}
    />
  );
}
