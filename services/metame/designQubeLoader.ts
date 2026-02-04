import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import type {
  DesignQube,
  DesignQubeManifest,
  DesignQubeReference,
  DesignQubeTokens,
  DesignQubeConstraints,
} from "../../types/designQube";

const TokensSchema = z
  .object({
    meta: z
      .object({
        schemaVersion: z.string().optional(),
        authority_level: z.string().optional(),
      })
      .optional(),
    themes: z
      .object({
        light: z.record(z.any()).optional(),
        dark: z.record(z.any()).optional(),
      })
      .optional(),
    typography: z.record(z.any()).optional(),
    radius: z.record(z.any()).optional(),
    spacing: z.record(z.any()).optional(),
    shadow: z.record(z.any()).optional(),
  })
  .partial();

const ConstraintsSchema = z
  .object({
    actions: z
      .object({
        maxPrimary: z.number().int().optional(),
      })
      .optional(),
    material: z
      .object({
        glass: z
          .object({
            enabled: z.boolean().optional(),
            blurPx: z.number().optional(),
            alpha: z.number().optional(),
            borderAlpha: z.number().optional(),
            surfaces: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .optional(),
    navigation: z.record(z.any()).optional(),
    currencyDisplay: z
      .object({
        wallet: z.string().optional(),
        content: z.string().optional(),
        offers: z.string().optional(),
      })
      .optional(),
    currencyPolicy: z.record(z.any()).optional(),
  })
  .partial();

const ReferencesSchema = z.array(
  z.object({
    id: z.string(),
    file: z.string(),
    title: z.string().optional(),
    tags: z.array(z.string()).optional(),
    themeHint: z.string().optional(),
    notes: z.string().optional(),
    templateId: z.string().optional(),
  })
);

const DEFAULT_DESIGN_QUBE_ID = "knyt-guidance";
const DEFAULT_DESIGN_QUBE_NAME = "KNYT Guidance DesignQube";

const FILES = {
  manifest: "designqube.manifest.json",
  tokens: "tokens.guidance.json",
  constraints: "constraints.json",
  components: "components.json",
  templates: "template-map.json",
  references: path.join("references", "index.json"),
  styleBrief: "style-brief.md",
};

const ManifestSchema = z
  .object({
    schemaVersion: z.string().optional(),
    designQubeId: z.string().optional(),
    name: z.string().optional(),
    authorityLevel: z.string().optional(),
    themes: z.array(z.string()).optional(),
    paths: z
      .object({
        tokens: z.string().optional(),
        components: z.string().optional(),
        constraints: z.string().optional(),
        templateMap: z.string().optional(),
        referencesIndex: z.string().optional(),
        styleBrief: z.string().optional(),
      })
      .optional(),
  })
  .partial();

async function readJsonIfExists<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

async function listReferenceImages(folderPath: string): Promise<DesignQubeReference[]> {
  try {
    const entries = await fs.readdir(folderPath);
    const images = entries.filter((entry) => entry.toLowerCase().endsWith(".png"));
    return images.map((file, index) => ({
      id: `ref-${index + 1}`,
      file,
    }));
  } catch {
    return [];
  }
}

export async function loadDesignQube({
  rootDir = process.cwd(),
  id = DEFAULT_DESIGN_QUBE_ID,
  includeImages = false,
}: {
  rootDir?: string;
  id?: string;
  includeImages?: boolean;
}): Promise<DesignQube> {
  const sourcePath = path.join(rootDir, "apps", "metame", "KNYTDesignQube");
  const manifestRaw = await readJsonIfExists<DesignQubeManifest>(path.join(sourcePath, FILES.manifest));
  const manifest = manifestRaw ? ManifestSchema.parse(manifestRaw) : undefined;
  const paths = {
    tokens: manifest?.paths?.tokens ?? FILES.tokens,
    constraints: manifest?.paths?.constraints ?? FILES.constraints,
    components: manifest?.paths?.components ?? FILES.components,
    templates: manifest?.paths?.templateMap ?? FILES.templates,
    references: manifest?.paths?.referencesIndex ?? FILES.references,
    styleBrief: manifest?.paths?.styleBrief ?? FILES.styleBrief,
  };

  const tokensRaw = await readJsonIfExists<DesignQubeTokens>(path.join(sourcePath, paths.tokens));
  const constraintsRaw = await readJsonIfExists<DesignQubeConstraints>(path.join(sourcePath, paths.constraints));
  const componentsRaw = await readJsonIfExists<Record<string, any>>(path.join(sourcePath, paths.components));
  const templatesRaw = await readJsonIfExists<Record<string, any>>(path.join(sourcePath, paths.templates));
  const referencesRaw = await readJsonIfExists<DesignQubeReference[]>(path.join(sourcePath, paths.references));
  const styleBrief = await readTextIfExists(path.join(sourcePath, paths.styleBrief));

  const tokens = tokensRaw ? TokensSchema.parse(tokensRaw) : undefined;
  const constraints = constraintsRaw ? ConstraintsSchema.parse(constraintsRaw) : undefined;
  const referencesParsed = referencesRaw ? ReferencesSchema.parse(referencesRaw) : undefined;

  let references = referencesParsed;
  if (!references || references.length === 0) {
    references = await listReferenceImages(sourcePath);
  }

  if (includeImages && references && references.length > 0) {
    const withImages = await Promise.all(
      references.map(async (ref) => {
        try {
          const filePath = path.join(sourcePath, ref.file);
          const data = await fs.readFile(filePath);
          const base64 = data.toString("base64");
          return {
            ...ref,
            dataUrl: `data:image/png;base64,${base64}`,
          };
        } catch {
          return ref;
        }
      })
    );
    references = withImages;
  }

  return {
    id: manifest?.designQubeId || id,
    name: manifest?.name || DEFAULT_DESIGN_QUBE_NAME,
    authorityLevel: manifest?.authorityLevel || tokens?.meta?.authority_level,
    sourcePath,
    manifest,
    tokens,
    constraints,
    components: componentsRaw,
    templates: templatesRaw,
    references,
    styleBrief,
    updatedAt: new Date().toISOString(),
  };
}
