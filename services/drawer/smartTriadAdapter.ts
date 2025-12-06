/**
 * SmartTriadAdapter
 * 
 * Adapts SmartTriadSet (new console format) to/from DrawerSet (production format).
 * Enables console to work with existing production backend APIs.
 */

import type { SmartTriadSet } from '@/src/smartTriad';
import type { DrawerSet, Drawer, DrawerTab } from '@/types/smartDrawer';

export class SmartTriadAdapter {
  /**
   * Convert SmartTriadSet (console format) to DrawerSet (production format)
   */
  static toDrawerSet(triadSet: SmartTriadSet): DrawerSet {
    const drawers: Drawer[] = triadSet.drawers.map(drawer => ({
      id: drawer.id,
      label: drawer.label,
      icon: this.mapLabelToIcon(drawer.label),
      side: drawer.side === 'center' ? undefined : drawer.side,
      defaultSize: drawer.defaultSize,
      defaultMenuBehavior: drawer.defaultMenuBehavior,
      allowedPersonas: [],
      tabs: drawer.tabs.map(tab => ({
        id: tab.id,
        label: tab.label,
        slots: tab.slots.map(slot => ({
          id: slot.id,
          label: slot.label,
          modality: slot.modality as any,
          variantId: slot.variantId,
          dataSource: { type: 'currentContent' },
          behaviour: { refreshMode: 'manual' },
          visibility: { alwaysShow: true },
        })),
      })),
    }));

    return {
      id: triadSet.id,
      appId: triadSet.appId,
      tenantId: 'tenant-main',
      personaId: triadSet.personaId,
      dynamicMode: triadSet.dynamicMode as any,
      drawers,
      wallet: {
        defaultDrawerId: triadSet.wallet?.defaultDrawerId || 'wallet',
        defaultTabId: triadSet.wallet?.defaultTabId || 'overview',
        personaAware: triadSet.wallet?.personaAware || false,
        showTasks: triadSet.wallet?.showTasks || false,
        showRewards: triadSet.wallet?.showRewards || false,
        showLibrary: triadSet.wallet?.showLibrary || false,
        sections: triadSet.wallet?.sections || {},
      },
      content: triadSet.content,
    };
  }

  /**
   * Convert DrawerSet (production format) to SmartTriadSet (console format)
   */
  static fromDrawerSet(drawerSet: DrawerSet): SmartTriadSet {
    return {
      id: drawerSet.id,
      appId: drawerSet.appId,
      personaId: drawerSet.personaId,
      dynamicMode: drawerSet.dynamicMode,
      drawers: drawerSet.drawers.map(drawer => ({
        id: drawer.id,
        label: drawer.label,
        side: drawer.side,
        defaultSize: drawer.defaultSize,
        defaultMenuBehavior: drawer.defaultMenuBehavior,
        tabs: drawer.tabs.map(tab => ({
          id: tab.id,
          label: tab.label,
          slots: tab.slots.map(slot => ({
            id: slot.id,
            label: slot.label,
            modality: slot.modality,
            variantId: slot.variantId,
          })),
        })),
      })),
      wallet: drawerSet.wallet,
      content: drawerSet.content,
    };
  }

  /**
   * Map drawer label to icon name
   */
  private static mapLabelToIcon(label: string): string {
    const iconMap: Record<string, string> = {
      'Wallet': 'wallet',
      'Article': 'file-text',
      'Analytics': 'trending-up',
      'Codex': 'layers',
      'Portfolio': 'briefcase',
    };
    return iconMap[label] || 'square';
  }
}
