export function markSectionComplete(
  current: string[],
  sections: readonly string[],
): string[] {
  const set = new Set(current);
  for (const s of sections) set.add(s);
  return Array.from(set);
}
