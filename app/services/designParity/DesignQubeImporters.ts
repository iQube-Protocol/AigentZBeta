import type {
  DesignQubeSource,
  DesignQubeTokens,
  StyleQube,
  StructureQube,
  TextStyleSpec,
} from "@/types/designQube";

export type DesignQubeImportResult = {
  tokens?: DesignQubeTokens;
  styleQube?: StyleQube;
  structureQube?: StructureQube;
  sources?: DesignQubeSource[];
  warnings?: string[];
};

const HEX_COLOR_RE = /#([0-9a-fA-F]{3,8})/;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(clamp(n) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function luminance(color: { r: number; g: number; b: number }) {
  const toLinear = (c: number) => {
    const v = clamp(c);
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const normalized = value.toString().trim().replace("px", "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function parseCssVariables(cssText: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const regex = /--([A-Za-z0-9-_]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cssText))) {
    vars[match[1].trim()] = match[2].trim();
  }
  return vars;
}

function inferColorsFromVars(vars: Record<string, string>) {
  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (!HEX_COLOR_RE.test(value)) continue;
    const name = key.toLowerCase();
    if (name.includes("primary")) colors.primary = value;
    else if (name.includes("secondary")) colors.secondary = value;
    else if (name.includes("accent")) colors.accent = value;
    else if (name.includes("surface")) colors.surface = value;
    else if (name.includes("background") || name.includes("bg")) colors.bg = value;
    else if (name.includes("text-muted") || (name.includes("text") && name.includes("muted"))) colors.muted = value;
    else if (name.includes("text")) colors.text = value;
    else if (name.includes("border")) colors.border = value;
  }
  return colors;
}

function inferTypographyFromVars(vars: Record<string, string>) {
  const fontFamily = vars["font-sans"] || vars["font-family"] || vars["font-body"];
  const scale: Record<string, number> = {};
  const weight: Record<string, number> = {};

  for (const [key, value] of Object.entries(vars)) {
    const name = key.toLowerCase();
    if (name.includes("font-size")) {
      const num = parseNumber(value);
      if (num) {
        if (name.includes("xs")) scale.xs = num;
        else if (name.includes("sm")) scale.sm = num;
        else if (name.includes("md") || name.includes("base")) scale.md = num;
        else if (name.includes("lg")) scale.lg = num;
        else if (name.includes("xl")) scale.xl = num;
      }
    }
    if (name.includes("font-weight")) {
      const num = parseNumber(value);
      if (num) {
        if (name.includes("regular")) weight.regular = num;
        else if (name.includes("medium")) weight.medium = num;
        else if (name.includes("semibold")) weight.semibold = num;
        else if (name.includes("bold")) weight.bold = num;
      }
    }
  }

  return {
    fontFamily,
    scale,
    weight,
  };
}

function inferSpacingFromVars(vars: Record<string, string>) {
  const spacing: Record<string, number> = {};
  for (const [key, value] of Object.entries(vars)) {
    const name = key.toLowerCase();
    if (!name.includes("space")) continue;
    const num = parseNumber(value);
    if (!num) continue;
    if (name.includes("xs")) spacing.xs = num;
    else if (name.includes("sm")) spacing.sm = num;
    else if (name.includes("md")) spacing.md = num;
    else if (name.includes("lg")) spacing.lg = num;
    else if (name.includes("xl")) spacing.xl = num;
    else if (name.includes("2xl")) spacing["2xl"] = num;
  }
  return spacing;
}

function inferRadiusFromVars(vars: Record<string, string>) {
  const radius: Record<string, number> = {};
  for (const [key, value] of Object.entries(vars)) {
    const name = key.toLowerCase();
    if (!name.includes("radius")) continue;
    const num = parseNumber(value);
    if (!num) continue;
    if (name.includes("sm")) radius.sm = num;
    else if (name.includes("md")) radius.md = num;
    else if (name.includes("lg")) radius.lg = num;
    else if (name.includes("xl")) radius.xl = num;
  }
  return radius;
}

function buildCssTextSpec(vars: Record<string, string>): TextStyleSpec | undefined {
  const fontFamily = vars["font-body"] || vars["font-family"] || vars["font-sans"];
  const fontSize = vars["font-size-base"] || vars["font-size-md"];
  const lineHeight = vars["line-height-base"] || vars["line-height"];

  if (!fontFamily && !fontSize && !lineHeight) return undefined;

  return {
    copyTone: vars["copy-tone"] || vars["text-tone"],
    readerCss: {
      fontFamily,
      fontSize,
      lineHeight,
      maxWidth: vars["reader-max-width"],
      paragraphSpacing: vars["reader-paragraph-spacing"] || vars["paragraph-spacing"],
      letterSpacing: vars["letter-spacing"],
      textAlign: vars["text-align"],
      hyphens: vars["hyphens"],
      textRendering: vars["text-rendering"],
      fontSmoothing: vars["font-smoothing"],
    },
  };
}

export function importFromCSS({
  cssText,
  sourceLabel = "CSS Import",
  sourceLocation,
}: {
  cssText: string;
  sourceLabel?: string;
  sourceLocation?: string;
}): DesignQubeImportResult {
  const vars = parseCssVariables(cssText);
  const colors = inferColorsFromVars(vars);
  const typography = inferTypographyFromVars(vars);
  const spacing = inferSpacingFromVars(vars);
  const radius = inferRadiusFromVars(vars);
  const textSpec = buildCssTextSpec(vars);

  const tokens: DesignQubeTokens = {
    themes: Object.keys(colors).length
      ? {
          dark: {
            color: colors,
          },
        }
      : undefined,
    typography: {
      fontFamily: typography.fontFamily ? { sans: typography.fontFamily } : undefined,
      scale: Object.keys(typography.scale).length ? typography.scale : undefined,
      weight: Object.keys(typography.weight).length ? typography.weight : undefined,
    },
    spacing: Object.keys(spacing).length ? spacing : undefined,
    radius: Object.keys(radius).length ? radius : undefined,
  };

  const styleQube: StyleQube | undefined = textSpec
    ? {
        text: textSpec,
      }
    : undefined;

  const sources: DesignQubeSource[] = [
    {
      id: `css-${Date.now()}`,
      type: "css",
      label: sourceLabel,
      location: sourceLocation,
      extractedAt: new Date().toISOString(),
      coverage: ["tokens", "text"],
    },
  ];

  return {
    tokens,
    styleQube,
    sources,
    warnings: Object.keys(vars).length === 0 ? ["No CSS variables found."] : undefined,
  };
}

function collectFigmaData(node: any, ctx: { colors: { color: string; count: number; lum: number }[]; fonts: Map<string, number>; fontSizes: Map<number, number> }) {
  if (!node) return;
  if (Array.isArray(node.fills)) {
    node.fills.forEach((fill: any) => {
      if (fill?.type === "SOLID" && fill.color) {
        const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        const existing = ctx.colors.find((c) => c.color === hex);
        if (existing) existing.count += 1;
        else ctx.colors.push({ color: hex, count: 1, lum: luminance(fill.color) });
      }
    });
  }
  if (node.type === "TEXT" && node.style) {
    if (node.style.fontFamily) {
      ctx.fonts.set(node.style.fontFamily, (ctx.fonts.get(node.style.fontFamily) || 0) + 1);
    }
    if (node.style.fontSize) {
      const size = Number(node.style.fontSize);
      if (Number.isFinite(size)) ctx.fontSizes.set(size, (ctx.fontSizes.get(size) || 0) + 1);
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child: any) => collectFigmaData(child, ctx));
  }
}

function buildColorPalette(colors: { color: string; count: number; lum: number }[]) {
  if (colors.length === 0) return {};
  const sortedByFreq = [...colors].sort((a, b) => b.count - a.count);
  const sortedByLum = [...colors].sort((a, b) => a.lum - b.lum);
  const darkest = sortedByLum[0]?.color;
  const lightest = sortedByLum[sortedByLum.length - 1]?.color;
  const surface = sortedByLum[Math.min(1, sortedByLum.length - 1)]?.color;
  const border = sortedByLum[Math.min(2, sortedByLum.length - 1)]?.color;

  return {
    primary: sortedByFreq[0]?.color,
    secondary: sortedByFreq[1]?.color,
    accent: sortedByFreq[2]?.color,
    bg: darkest,
    surface,
    text: lightest,
    border,
  };
}

function buildTypographyScale(fontSizes: Map<number, number>) {
  const sizes = Array.from(fontSizes.keys()).sort((a, b) => a - b);
  const scale: Record<string, number> = {};
  if (sizes.length > 0) {
    scale.xs = sizes[0];
    scale.sm = sizes[Math.min(1, sizes.length - 1)];
    scale.md = sizes[Math.min(2, sizes.length - 1)] ?? sizes[0];
    scale.lg = sizes[Math.min(3, sizes.length - 1)] ?? sizes[sizes.length - 1];
    scale.xl = sizes[Math.min(4, sizes.length - 1)] ?? sizes[sizes.length - 1];
    scale["2xl"] = sizes[Math.min(5, sizes.length - 1)] ?? sizes[sizes.length - 1];
  }
  return scale;
}

export async function importFromFigma({
  fileKey,
  accessToken,
  fileJson,
  sourceLabel = "Figma Import",
}: {
  fileKey?: string;
  accessToken?: string;
  fileJson?: any;
  sourceLabel?: string;
}): Promise<DesignQubeImportResult> {
  let figmaFile = fileJson;

  if (!figmaFile && fileKey && accessToken) {
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: {
        "X-Figma-Token": accessToken,
      },
    });
    if (!response.ok) {
      return {
        warnings: [`Figma API request failed (${response.status}).`],
      };
    }
    figmaFile = await response.json();
  }

  if (!figmaFile?.document) {
    return {
      warnings: ["No Figma document provided."],
    };
  }

  const ctx = {
    colors: [] as { color: string; count: number; lum: number }[],
    fonts: new Map<string, number>(),
    fontSizes: new Map<number, number>(),
  };

  collectFigmaData(figmaFile.document, ctx);

  const palette = buildColorPalette(ctx.colors);
  const fontFamilies = Array.from(ctx.fonts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const scale = buildTypographyScale(ctx.fontSizes);

  const tokens: DesignQubeTokens = {
    themes: Object.keys(palette).length
      ? {
          dark: {
            color: palette,
          },
        }
      : undefined,
    typography: {
      fontFamily: fontFamilies[0] ? { sans: fontFamilies[0] } : undefined,
      scale: Object.keys(scale).length ? scale : undefined,
    },
  };

  const sources: DesignQubeSource[] = [
    {
      id: fileKey ? `figma-${fileKey}` : `figma-${Date.now()}`,
      type: "figma",
      label: sourceLabel,
      location: fileKey ? `https://www.figma.com/file/${fileKey}` : undefined,
      extractedAt: new Date().toISOString(),
      coverage: ["tokens", "typography", "colors"],
    },
  ];

  return {
    tokens,
    sources,
    warnings: ctx.colors.length === 0 ? ["No color tokens found in Figma file."] : undefined,
  };
}

function collectDesignTokenValues(node: any, path: string[] = [], acc: { keyPath: string; value: any }[] = []) {
  if (!node || typeof node !== "object") return acc;
  if ("value" in node && typeof node.value !== "object") {
    acc.push({ keyPath: path.join("."), value: node.value });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "value") continue;
    collectDesignTokenValues(value as any, [...path, key], acc);
  }
  return acc;
}

export function importFromXD({
  xdJson,
  sourceLabel = "Adobe XD Import",
}: {
  xdJson: any;
  sourceLabel?: string;
}): DesignQubeImportResult {
  if (!xdJson) {
    return { warnings: ["No XD JSON provided."] };
  }

  const tokens: DesignQubeTokens = {};
  const colors: Record<string, string> = {};
  const scale: Record<string, number> = {};
  let fontFamily: string | undefined;

  const entries = collectDesignTokenValues(xdJson);
  for (const entry of entries) {
    const key = entry.keyPath.toLowerCase();
    const value = entry.value;
    if (typeof value === "string" && HEX_COLOR_RE.test(value) && key.includes("color")) {
      const name = key.split(".").pop() || "color";
      colors[name] = value;
    }
    if (typeof value === "string" && key.includes("font") && !fontFamily) {
      fontFamily = value;
    }
    if (typeof value === "number" && key.includes("size")) {
      const name = key.split(".").pop() || "md";
      scale[name] = value;
    }
  }

  if (Object.keys(colors).length) {
    tokens.themes = {
      dark: {
        color: colors,
      },
    };
  }
  if (fontFamily || Object.keys(scale).length) {
    tokens.typography = {
      fontFamily: fontFamily ? { sans: fontFamily } : undefined,
      scale: Object.keys(scale).length ? scale : undefined,
    };
  }

  const sources: DesignQubeSource[] = [
    {
      id: `xd-${Date.now()}`,
      type: "xd",
      label: sourceLabel,
      extractedAt: new Date().toISOString(),
      coverage: ["tokens", "typography", "colors"],
    },
  ];

  return {
    tokens,
    sources,
    warnings: entries.length === 0 ? ["No design tokens found in XD JSON."] : undefined,
  };
}
