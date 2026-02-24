type PremiumItem = {
  id: string;
  tags?: string[];
  badge?: string;
  isPremium?: boolean;
};

export function isPremiumContent(item: PremiumItem): boolean {
  if (item.isPremium) return true;
  const tags = (item.tags || []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => ['premium', 'paid', 'locked', 'subscriber'].includes(tag))) {
    return true;
  }
  const badge = (item.badge || '').toLowerCase();
  return badge.includes('premium');
}

export function isLockedContent(
  item: PremiumItem,
  isOwned?: (item: PremiumItem) => boolean
): boolean {
  if (!isPremiumContent(item)) return false;
  if (!isOwned) return false;
  return !isOwned(item);
}
