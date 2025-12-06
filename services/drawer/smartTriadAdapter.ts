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
          cardVariant: slot.variantId || 'default',
          dataSource: { type: 'currentContent' },
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
      dynamicMode: drawerSet.dynamicMode || 'static-only',
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
