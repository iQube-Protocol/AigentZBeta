/**
 * DesignQube Import Actions
 *
 * Import tokens from CSS, Figma, or Adobe XD.
 */

import {
  importFromCSS,
  importFromFigma,
  importFromXD,
} from "@/app/services/designParity/DesignQubeImporters";

export const designQubeImportCssAction = {
  name: "designQubeImportCSS",
  description: "Import design tokens and reader CSS from a CSS stylesheet string.",
  parameters: [
    {
      name: "cssText",
      type: "string" as const,
      description: "Raw CSS text (supports CSS custom properties).",
      required: true,
    },
    {
      name: "sourceLabel",
      type: "string" as const,
      description: "Optional label for the CSS source.",
      required: false,
    },
  ],
  handler: async ({ cssText, sourceLabel }: { cssText: string; sourceLabel?: string }) => {
    const result = importFromCSS({ cssText, sourceLabel });
    return { success: true, result };
  },
};

export const designQubeImportFigmaAction = {
  name: "designQubeImportFigma",
  description: "Import design tokens from a Figma file (requires access token).",
  parameters: [
    {
      name: "fileKey",
      type: "string" as const,
      description: "Figma file key (from the URL).",
      required: true,
    },
    {
      name: "accessToken",
      type: "string" as const,
      description: "Figma personal access token.",
      required: true,
    },
    {
      name: "sourceLabel",
      type: "string" as const,
      description: "Optional label for the Figma source.",
      required: false,
    },
  ],
  handler: async ({
    fileKey,
    accessToken,
    sourceLabel,
  }: {
    fileKey: string;
    accessToken: string;
    sourceLabel?: string;
  }) => {
    const result = await importFromFigma({ fileKey, accessToken, sourceLabel });
    return { success: true, result };
  },
};

export const designQubeImportXdAction = {
  name: "designQubeImportXD",
  description: "Import design tokens from an Adobe XD design token JSON export.",
  parameters: [
    {
      name: "xdJson",
      type: "string" as const,
      description: "XD design token JSON (stringified).",
      required: true,
    },
    {
      name: "sourceLabel",
      type: "string" as const,
      description: "Optional label for the XD source.",
      required: false,
    },
  ],
  handler: async ({ xdJson, sourceLabel }: { xdJson: string; sourceLabel?: string }) => {
    let parsed;
    try {
      parsed = JSON.parse(xdJson);
    } catch {
      return { success: false, error: "Invalid XD JSON." };
    }
    const result = importFromXD({ xdJson: parsed, sourceLabel });
    return { success: true, result };
  },
};

export const designQubeImportActions = [
  designQubeImportCssAction,
  designQubeImportFigmaAction,
  designQubeImportXdAction,
];
