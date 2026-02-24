/**
 * DesignQube Copilot Actions
 *
 * Allows the Copilot to analyze DesignQube gaps and suggest refinements.
 */

import { loadDesignQube } from "@/services/metame/designQubeLoader";
import { DISGenerator } from "@/app/services/designParity/DesignIntentSpec";
import { ConstraintManifestGenerator } from "@/app/services/designParity/ConstraintManifest";
import { analyzeDesignGap } from "@/app/services/designParity/DesignGapCheck";

export const designQubeGapCheckAction = {
  name: "designQubeGapCheck",
  description:
    "Analyze a DesignQube for missing style, structure, voice, text, or source coverage. Returns a gap report with suggested actions.",
  parameters: [
    {
      name: "designQubeId",
      type: "string" as const,
      description: "Optional DesignQube ID. Defaults to the KNYT guidance DesignQube.",
      required: false,
    },
    {
      name: "includePipeline",
      type: "boolean" as const,
      description: "If true, include DIS and CM outputs alongside the gap report.",
      required: false,
    },
  ],
  handler: async ({
    designQubeId,
    includePipeline = false,
  }: {
    designQubeId?: string;
    includePipeline?: boolean;
  }) => {
    try {
      const designQube = await loadDesignQube({
        id: designQubeId || undefined,
        includeImages: false,
      });

      let dis;
      let cm;
      if (includePipeline) {
        dis = await DISGenerator.generateFromDesignQube(designQube, [], { strictMode: false });
        cm = ConstraintManifestGenerator.generateFromDIS(dis);
      }

      const gapReport = analyzeDesignGap({ designQube, dis, cm });

      return {
        success: true,
        gapReport,
        dis,
        cm,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to analyze DesignQube gaps",
      };
    }
  },
};

export const designQubeActions = [designQubeGapCheckAction];
