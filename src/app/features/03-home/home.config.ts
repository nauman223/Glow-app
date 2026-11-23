import { type CollageTemplateId } from '@core/collage/collage.models';
import { APP_ROUTES } from '@core/config/app.constants';
import { type IconName } from '@shared/ui/icon/icons';

import { HOME_STRINGS } from './home.strings';

/**
 * What a Home action does. New kinds (e.g. opening a collage template) are added here and
 * handled in `HomePage.run()`; the cards and chips that render actions stay unchanged.
 */
export type HomeActionCommand =
  | { readonly kind: 'navigate'; readonly route: string }
  | { readonly kind: 'camera' }
  /** Opens the "AI tools" sheet; the chosen screen then goes through the photo picker. */
  | { readonly kind: 'ai-tools' };

export interface HomeAction {
  readonly id: string;
  readonly label: string;
  /** Shown in the card's icon tiles. */
  readonly icon: IconName;
  readonly emphasis: 'primary' | 'outline';
  /** Replaces the label while the action is running; null for instant actions. */
  readonly busyLabel: string | null;
  readonly command: HomeActionCommand;
}

/**
 * "Start editing" card actions (screen 03). Only shipped features are listed: entries for
 * later phases are added when their routes exist, so Home never shows a dead link.
 */
export const START_EDITING_ACTIONS: readonly HomeAction[] = [
  {
    id: 'choose-photo',
    label: HOME_STRINGS.actions.choosePhoto,
    icon: 'gallery',
    emphasis: 'primary',
    busyLabel: null,
    command: { kind: 'navigate', route: APP_ROUTES.picker },
  },
  {
    id: 'take-photo',
    label: HOME_STRINGS.actions.takePhoto,
    icon: 'camera',
    emphasis: 'outline',
    busyLabel: HOME_STRINGS.actions.takePhotoLoading,
    command: { kind: 'camera' },
  },
];

/**
 * Tool chips under the card (screen 03). Only "AI tools" ships: the board's Collage, Layers,
 * Draw, Crop, Filters and Text chips are added when they have their own entry flow.
 */
export const HOME_CHIPS: readonly HomeAction[] = [
  {
    id: 'ai-tools',
    label: HOME_STRINGS.actions.aiTools,
    icon: 'ai-sparkle',
    emphasis: 'outline',
    busyLabel: null,
    command: { kind: 'ai-tools' },
  },
];

/** "Recent projects": the newest projects in a row; "See all" lists every project. */
export interface RecentProjectsSection {
  readonly id: string;
  readonly kind: 'recent-projects';
  readonly heading: string;
  /** Cards in the horizontal row. */
  readonly rowLimit: number;
}

/** "Templates": collage layouts that open the multi-select picker; "See all" lists every one. */
export interface TemplatesSection {
  readonly id: string;
  readonly kind: 'templates';
  readonly heading: string;
  /** The four cards of the design, in order. */
  readonly featured: readonly CollageTemplateId[];
}

/** A content section below the "Start editing" card, rendered by `HomePage` per `kind`. */
export type HomeSection = RecentProjectsSection | TemplatesSection;

/** Sections in display order (screen 03). */
export const HOME_SECTIONS: readonly HomeSection[] = [
  {
    id: 'recent-projects',
    kind: 'recent-projects',
    heading: HOME_STRINGS.recent.heading,
    rowLimit: 6,
  },
  {
    id: 'templates',
    kind: 'templates',
    heading: HOME_STRINGS.templates.heading,
    featured: ['split-v', 'one-two', 'grid-2x2', 'freestyle'],
  },
];
