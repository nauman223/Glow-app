import { type Type } from '@angular/core';
import { APP_ROUTES } from '@core/config/app.constants';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import { type IconName } from '@shared/ui/icon/icons';

import { EDITOR_STRINGS } from './editor.strings';

interface EditorToolBase {
  readonly id: string;
  /** Toolbar caption and top-bar title while the tool is open. */
  readonly label: string;
  readonly icon: IconName;
}

/**
 * A tool whose lazily loaded panel is shown in the editor while it is active. A panel is a
 * smart component that injects `EditorStore` and its own tool service, and calls
 * `EditorStore.closeTool()` when the user applies or cancels.
 */
export interface EditorPanelToolDefinition extends EditorToolBase {
  readonly loadPanel: () => Promise<Type<unknown>>;
}

/**
 * A tool that is its own screen (AI tools): the toolbar navigates forward to `route` and the
 * editor stays alive underneath (like Export); the screen applies its result as one history
 * step and navigates back. Never opens a panel.
 */
export interface EditorRouteToolDefinition extends EditorToolBase {
  readonly route: string;
}

export type EditorToolDefinition = EditorPanelToolDefinition | EditorRouteToolDefinition;

/**
 * Toolbar order. Adding a tool is one entry here (plus its folder under `tools/`, or its AI
 * screen route); the toolbar, the top-bar title and panel loading are all driven by this list.
 */
export const EDITOR_TOOLS = [
  {
    id: 'crop',
    label: EDITOR_STRINGS.tools.crop,
    icon: 'crop',
    loadPanel: () =>
      import('./tools/06-crop/crop-panel.component').then((module) => module.CropPanelComponent),
  },
  {
    id: 'remove-background',
    label: AI_SHELL_STRINGS.features['remove-background'],
    icon: 'remove-bg',
    route: APP_ROUTES.aiRemoveBackground,
  },
  {
    id: 'adjust',
    label: EDITOR_STRINGS.tools.adjust,
    icon: 'adjust',
    loadPanel: () =>
      import('./tools/07-adjust/adjust-panel.component').then(
        (module) => module.AdjustPanelComponent,
      ),
  },
  {
    id: 'filters',
    label: EDITOR_STRINGS.tools.filters,
    icon: 'filters',
    loadPanel: () =>
      import('./tools/08-filters/filters-panel.component').then(
        (module) => module.FiltersPanelComponent,
      ),
  },
  {
    id: 'draw',
    label: EDITOR_STRINGS.tools.draw,
    icon: 'draw',
    loadPanel: () =>
      import('./tools/09-draw/draw-panel.component').then((module) => module.DrawPanelComponent),
  },
  {
    id: 'layers',
    label: EDITOR_STRINGS.tools.layers,
    icon: 'layers',
    loadPanel: () =>
      import('./tools/10-layers/layers-panel.component').then(
        (module) => module.LayersPanelComponent,
      ),
  },
  {
    id: 'text',
    label: EDITOR_STRINGS.tools.text,
    icon: 'text',
    loadPanel: () =>
      import('./tools/12-text/text-panel.component').then((module) => module.TextPanelComponent),
  },
  {
    id: 'stickers',
    label: EDITOR_STRINGS.tools.stickers,
    icon: 'sticker',
    loadPanel: () =>
      import('./tools/13-stickers/stickers-panel.component').then(
        (module) => module.StickersPanelComponent,
      ),
  },
  {
    id: 'collage',
    label: EDITOR_STRINGS.tools.collage,
    icon: 'collage',
    loadPanel: () =>
      import('./tools/11-collage/collage-panel.component').then(
        (module) => module.CollagePanelComponent,
      ),
  },
  {
    id: 'ai-tools',
    label: EDITOR_STRINGS.tools.aiTools,
    icon: 'ai-sparkle',
    loadPanel: () =>
      import('./tools/ai-tools/ai-tools-panel.component').then(
        (module) => module.AiToolsPanelComponent,
      ),
  },
] as const satisfies readonly EditorToolDefinition[];

export type EditorToolId = (typeof EDITOR_TOOLS)[number]['id'];
export type EditorTool = (typeof EDITOR_TOOLS)[number];
export type EditorPanelTool = Extract<EditorTool, { readonly loadPanel: unknown }>;

/** The panel tool `id`; `null` for none or for a route tool. */
export function findEditorTool(id: EditorToolId | null): EditorPanelTool | null {
  const tool = EDITOR_TOOLS.find((candidate) => candidate.id === id);
  return tool !== undefined && 'loadPanel' in tool ? tool : null;
}

/** The screen a route tool opens; `null` for panel tools. */
export function findToolRoute(id: EditorToolId): string | null {
  const tool = EDITOR_TOOLS.find((candidate) => candidate.id === id);
  return tool !== undefined && 'route' in tool ? tool.route : null;
}
