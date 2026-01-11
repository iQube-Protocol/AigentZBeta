import type React from 'react';

import { QriptoLiquidCodexTab } from '../tabs/QriptoLiquidCodexTab';

export type LiquidTemplateComponent = React.ComponentType<any>;

export const liquidTemplateRegistry: Record<string, LiquidTemplateComponent> = {
  'qripto-codex-home': QriptoLiquidCodexTab,
};
