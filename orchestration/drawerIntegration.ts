/**
 * Drawer Integration
 * 
 * Converts DrawerChange[] into state deltas for frontend application
 */

import type { DrawerChange, DrawerStateDelta } from "./types";

export function applyDrawerChanges(
  changes: DrawerChange[],
  current: DrawerStateDelta = {}
): DrawerStateDelta {
  const delta: DrawerStateDelta = { ...current };
  
  for (const change of changes) {
    switch (change.action) {
      case "focusDrawer":
        if (change.drawerId) {
          delta.focusDrawerId = change.drawerId;
        }
        break;
        
      case "focusTab":
        if (change.tabId) {
          delta.focusTabId = change.tabId;
        }
        break;
        
      case "openDrawer":
        if (change.drawerId) {
          const openIds = delta.openDrawerIds || [];
          if (!openIds.includes(change.drawerId)) {
            delta.openDrawerIds = [...openIds, change.drawerId];
          }
        }
        break;
        
      case "resizeDrawer":
        if (change.drawerId && change.size) {
          const resizes = delta.resize || [];
          delta.resize = [
            ...resizes.filter(r => r.drawerId !== change.drawerId),
            { drawerId: change.drawerId, size: change.size },
          ];
        }
        break;
        
      case "updateMenuBehavior":
        if (change.menuBehavior) {
          delta.menuBehavior = change.menuBehavior;
        }
        break;
        
      case "highlightDrawer":
        if (change.drawerId) {
          const highlights = delta.highlightDrawerIds || [];
          if (!highlights.includes(change.drawerId)) {
            delta.highlightDrawerIds = [...highlights, change.drawerId];
          }
        }
        break;
        
      case "noChange":
        // Do nothing
        break;
    }
  }
  
  return delta;
}
