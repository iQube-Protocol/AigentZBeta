import type React from 'react';

import { QriptoLiquidCodexTab } from '../tabs/QriptoLiquidCodexTab';
import { KnytDrawerGridFallbackTemplate } from './KnytDrawerGridFallbackTemplate';
import { LiquidUIPlaceholderTemplate } from './LiquidUIPlaceholderTemplate';

export type LiquidTemplateComponent = React.ComponentType<any>;

export const liquidTemplateRegistry: Record<string, LiquidTemplateComponent> = {
  'qripto-codex-home': QriptoLiquidCodexTab,
  'liquidui:drawer_grid_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_1a': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_1b': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_1c': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_2a': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_2b': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_2c': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_3a': KnytDrawerGridFallbackTemplate,
  'liquidui:drawer_grid_3b': KnytDrawerGridFallbackTemplate,
  'liquidui:reader_viewer_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:timeline_activity_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:chat_conversation_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:meeting_live_room_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:editor_compose_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:canvas_workspace_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:builder_ide_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:notebook_lab_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:checkout_payment_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:marketplace_exchange_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:board_kanban_v1': KnytDrawerGridFallbackTemplate,
  'liquidui:settings_admin_v1': LiquidUIPlaceholderTemplate,
  'liquidui:map_geo_v1': LiquidUIPlaceholderTemplate,
  'knyt:drawer_grid_v1': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_1a': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_1b': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_1c': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_2a': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_2b': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_2c': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_3a': KnytDrawerGridFallbackTemplate,
  'knyt:drawer_grid_3b': KnytDrawerGridFallbackTemplate,
  'knyt:dual_poster_stage_v1': LiquidUIPlaceholderTemplate,
  'knyt:motion_stage_v1': LiquidUIPlaceholderTemplate,
  'knyt:quest_hud_hub_v1': LiquidUIPlaceholderTemplate,
  'knyt:realm_bridge_map_v1': LiquidUIPlaceholderTemplate,
};
