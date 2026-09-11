export function textBlob(input: {
  name?: string;
  description?: string;
  capabilities?: string[];
  targetUsers?: string[];
  sourceUrl?: string;
  websiteUrl?: string;
  repositoryUrl?: string;
}): string {
  return [
    input.name,
    input.description,
    input.sourceUrl,
    input.websiteUrl,
    input.repositoryUrl,
    ...(input.capabilities ?? []),
    ...(input.targetUsers ?? []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

export function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
