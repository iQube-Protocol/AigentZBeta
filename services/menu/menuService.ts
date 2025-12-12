/**
 * Menu Service - Manages menu configuration and state
 */

import type {
  SmartMenuConfig,
  MenuItem,
  MenuSection,
  MenuState,
  MenuStateDelta,
  MenuContext,
  MenuVisibilityRules,
} from '@/types/smartMenu';

export function evaluateMenuVisibility(
  rules: MenuVisibilityRules | undefined,
  context: MenuContext
): boolean {
  if (!rules) return true;
  if (rules.allowedPersonas?.length && !rules.allowedPersonas.includes(context.personaId)) return false;
  if (rules.requiresAuth && context.identityState === 'anon') return false;
  if (rules.minReputationScore && (context.reputationScore || 0) < rules.minReputationScore) return false;
  if (rules.hideOnMobile && context.deviceType === 'mobile') return false;
  if (rules.hideOnDesktop && context.deviceType === 'desktop') return false;
  return true;
}

export function filterVisibleItems(items: MenuItem[], context: MenuContext): MenuItem[] {
  return items
    .filter(item => evaluateMenuVisibility(item.visibilityRules, context))
    .map(item => ({ ...item, children: item.children ? filterVisibleItems(item.children, context) : undefined }));
}

export function filterVisibleSections(sections: MenuSection[], context: MenuContext): MenuSection[] {
  return sections
    .filter(s => evaluateMenuVisibility(s.visibilityRules, context))
    .map(s => ({ ...s, items: filterVisibleItems(s.items, context) }))
    .filter(s => s.items.length > 0);
}

export function createInitialMenuState(config: SmartMenuConfig): MenuState {
  return {
    expandedSections: [],
    openDrawerIds: config.drawerOrder?.slice(0, 1) || [],
    focusedDrawerId: config.drawerOrder?.[0],
  };
}

export function applyMenuStateDelta(state: MenuState, delta: MenuStateDelta): MenuState {
  return { ...state, ...delta };
}

export function toggleDrawer(state: MenuState, drawerId: string): MenuState {
  const isOpen = state.openDrawerIds.includes(drawerId);
  return {
    ...state,
    openDrawerIds: isOpen ? state.openDrawerIds.filter(id => id !== drawerId) : [...state.openDrawerIds, drawerId],
    focusedDrawerId: isOpen ? state.focusedDrawerId : drawerId,
  };
}
