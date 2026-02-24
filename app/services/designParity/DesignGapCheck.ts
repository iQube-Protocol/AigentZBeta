import type { DesignQube } from "@/types/designQube";
import type { DesignIntentSpec } from "./DesignIntentSpec";
import type { ConstraintManifest } from "./ConstraintManifest";

export type DesignGapSeverity = "low" | "medium" | "high";

export type DesignGapIssue = {
  id: string;
  category: "style" | "structure" | "voice" | "text" | "sources" | "copilot";
  severity: DesignGapSeverity;
  message: string;
  suggestion?: string;
};

export type DesignGapReport = {
  generatedAt: string;
  designQubeId: string;
  coverage: {
    style: boolean;
    structure: boolean;
    voice: boolean;
    text: boolean;
    sources: boolean;
    copilotHints: boolean;
  };
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: DesignGapIssue[];
  suggestedActions: string[];
};

export function analyzeDesignGap(params: {
  designQube: Partial<DesignQube> | null | undefined;
  dis?: DesignIntentSpec;
  cm?: ConstraintManifest;
}): DesignGapReport {
  const { designQube } = params;
  const issues: DesignGapIssue[] = [];
  const suggestedActions = new Set<string>();

  const styleQube = designQube?.styleQube;
  const structureQube = designQube?.structureQube;
  const voice = (styleQube as any)?.voice;
  const text = (styleQube as any)?.text;
  const sources = Array.isArray(designQube?.sources) ? designQube?.sources : [];
  const copilotHints = designQube?.copilotHints;

  if (!styleQube) {
    issues.push({
      id: "missing-styleqube",
      category: "style",
      severity: "high",
      message: "StyleQube is missing.",
      suggestion: "Import style guidance or run Composer Copilot extraction for visual + voice + text.",
    });
    suggestedActions.add("Run Composer Copilot to extract StyleQube from style guides or CSS.");
  }

  if (!structureQube) {
    issues.push({
      id: "missing-structureqube",
      category: "structure",
      severity: "high",
      message: "StructureQube is missing.",
      suggestion: "Define template selection criteria and layout rules for StructureQube.",
    });
    suggestedActions.add("Define StructureQube template selection rules.");
  }

  if (styleQube && (!voice || !voice.persona || !voice.accent || !voice.pace || !voice.pitch || !voice.tone)) {
    issues.push({
      id: "incomplete-voice-profile",
      category: "voice",
      severity: "medium",
      message: "Voice profile is incomplete (persona, accent, pace, pitch, tone).",
      suggestion: "Fill missing voice fields or derive them via Composer Copilot with TTS hints.",
    });
    suggestedActions.add("Complete voice profile with persona, accent, pace, pitch, tone.");
  }

  if (styleQube && (!text || (!text.readerCss && !text.cssText))) {
    issues.push({
      id: "missing-text-css",
      category: "text",
      severity: "medium",
      message: "Text styling lacks reader CSS details.",
      suggestion: "Add reader CSS or provide a copy rendering block for long-form content.",
    });
    suggestedActions.add("Add reader CSS details for copy rendering.");
  }

  if (structureQube && (!structureQube.templates || structureQube.templates.length === 0)) {
    issues.push({
      id: "missing-templates",
      category: "structure",
      severity: "medium",
      message: "StructureQube has no template list.",
      suggestion: "Enumerate template IDs that StructureQube can select.",
    });
    suggestedActions.add("Enumerate StructureQube template IDs.");
  }

  if (structureQube && !structureQube.templateSelection) {
    issues.push({
      id: "missing-template-selection",
      category: "structure",
      severity: "medium",
      message: "Template selection criteria are missing.",
      suggestion: "Define templateSelection by modality, density, or surface.",
    });
    suggestedActions.add("Define StructureQube templateSelection criteria.");
  }

  if (!sources || sources.length === 0) {
    issues.push({
      id: "missing-sources",
      category: "sources",
      severity: "medium",
      message: "No extraction sources recorded.",
      suggestion: "Add sources for style guides, CSS exports, and design files.",
    });
    suggestedActions.add("Add extraction sources for DesignQube.");
  }

  if (!copilotHints) {
    issues.push({
      id: "missing-copilot-hints",
      category: "copilot",
      severity: "low",
      message: "Copilot hints are missing.",
      suggestion: "Capture freeform briefs and TTS hints from Composer Copilot.",
    });
    suggestedActions.add("Capture Copilot hints for voice and text.");
  }

  const summary = issues.reduce(
    (acc, issue) => {
      acc.total += 1;
      acc[issue.severity] += 1;
      return acc;
    },
    { total: 0, high: 0, medium: 0, low: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    designQubeId: designQube?.id || "unknown",
    coverage: {
      style: Boolean(styleQube),
      structure: Boolean(structureQube),
      voice: Boolean(voice?.persona && voice?.accent && voice?.pace && voice?.pitch && voice?.tone),
      text: Boolean(text?.readerCss || text?.cssText),
      sources: Boolean(sources && sources.length > 0),
      copilotHints: Boolean(copilotHints),
    },
    summary,
    issues,
    suggestedActions: Array.from(suggestedActions),
  };
}
