import type {
  SmartContentQube,
  ImageVariant,
  VideoVariant,
  MediaOrientation,
  MediaDevice,
  MediaRatio,
} from "@/types/smartContent";

export type MediaVariantQuery = {
  device?: MediaDevice;
  orientation?: MediaOrientation;
  ratio?: MediaRatio;
  sizeKey?: string;
  templateVariant?: string;
  useTemplateRatioOverrides?: boolean;
};

const normalize = (value?: string) => (value || "").toLowerCase();

const ratioFromTemplate = (templateVariant?: string, device?: MediaDevice): MediaRatio | undefined => {
  const template = normalize(templateVariant);
  if (!template) return undefined;
  if (template.includes("hero") || template.includes("reader") || template.includes("viewer")) {
    return device === "mobile" ? "9:16" : "16:9";
  }
  if (template.includes("poster") || template.includes("card")) {
    return device === "mobile" ? "3:4" : "4:3";
  }
  if (template.includes("thumb") || template.includes("thumbnail")) {
    return "1:1";
  }
  if (template.includes("carousel")) {
    return device === "mobile" ? "3:4" : "16:9";
  }
  return undefined;
};

const resolveVariant = <T extends { url: string }>(
  group: {
    default?: T;
    device?: Partial<Record<MediaDevice, T>>;
    orientation?: Partial<Record<MediaOrientation, T>>;
    ratios?: Partial<Record<MediaRatio, T>>;
    sizes?: Record<string, T>;
  } | undefined,
  query?: MediaVariantQuery
): T | undefined => {
  if (!group) return undefined;
  const ratioHint =
    query?.ratio ??
    (query?.useTemplateRatioOverrides === false
      ? undefined
      : ratioFromTemplate(query?.templateVariant, query?.device));
  if (query?.device && group.device?.[query.device]) return group.device[query.device];
  if (query?.orientation && group.orientation?.[query.orientation]) return group.orientation[query.orientation];
  if (ratioHint && group.ratios?.[ratioHint]) return group.ratios[ratioHint];
  if (query?.sizeKey && group.sizes?.[query.sizeKey]) return group.sizes[query.sizeKey];
  return group.default;
};

export const resolveImageVariant = (content: SmartContentQube, query?: MediaVariantQuery): ImageVariant | undefined => {
  return resolveVariant(content.mediaVariants?.image, query);
};

export const resolveVideoVariant = (content: SmartContentQube, query?: MediaVariantQuery): VideoVariant | undefined => {
  return resolveVariant(content.mediaVariants?.video, query);
};

export const getCoverImageUrl = (content: SmartContentQube, query?: MediaVariantQuery): string => {
  return resolveImageVariant(content, query)?.url || content.coverImageUri || "";
};
