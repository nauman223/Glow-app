import { type ActivatedRouteSnapshot } from '@angular/router';
import { type CollageTemplateId } from '@core/collage/collage.models';
import {
  findCollageTemplate,
  isCollageTemplateId,
  templatePhotoCount,
} from '@core/collage/collage-templates';
import { type EditorFollowUp } from '@core/editor-launch/editor-launch.service';
import { findAiFeature } from '@features/ai/_shell/ai-features';

/** `single` opens the editor on tap (phase 1); `multiple` collects an ordered selection (collage). */
export type PickerSelectionMode = 'single' | 'multiple';

/** Library access state as the screen sees it. `ready` covers both full and limited access. */
export type PickerStatus = 'checking' | 'unsupported' | 'prompt' | 'denied' | 'ready';

/** What the body of the screen shows. */
export type PickerView = Exclude<PickerStatus, 'ready'> | 'loading' | 'error' | 'empty' | 'grid';

/** Full-screen access states rendered by PermissionStateComponent. */
export type PermissionStateKind = 'prompt' | 'denied' | 'unsupported';

/** Route data key that switches the picker to multi-select, e.g. `data: { selection: 'multiple' }`. */
export const PICKER_SELECTION_DATA_KEY = 'selection';

/**
 * Query parameter naming the collage template the photos are for (`/picker?collage=grid-2x2`).
 * It switches the picker to multi-select, capped at the template's photo count, and Continue
 * then opens the editor with a new collage.
 */
export const PICKER_COLLAGE_QUERY_KEY = 'collage';

/**
 * Query parameter naming the AI screen the photo is for (`/picker?ai=one-tap-themes`, from the
 * Home "AI tools" sheet): the editor opens with the photo, then that screen on top of it.
 */
export const PICKER_AI_QUERY_KEY = 'ai';

/** The AI screen the picked photo goes on to (see PICKER_AI_QUERY_KEY); `null` for none. */
export function readAiFollowUp(route: ActivatedRouteSnapshot): EditorFollowUp | null {
  const feature = findAiFeature(route.queryParamMap.get(PICKER_AI_QUERY_KEY));
  return feature === null ? null : { route: feature.route };
}

export const PICKER_PAGE_SIZE = 60;

/** Upper bound for multi-select (collage cells). */
export const PICKER_MAX_SELECTION = 9;

export interface PickerConfig {
  readonly mode: PickerSelectionMode;
  readonly maxSelection: number;
  /** The collage being built; null for the single-photo flow. */
  readonly collage: CollageTemplateId | null;
}

/** Reads the picker mode from the route: the collage query parameter, else route data. */
export function readPickerConfig(route: ActivatedRouteSnapshot): PickerConfig {
  const collage: unknown = route.queryParamMap.get(PICKER_COLLAGE_QUERY_KEY);
  if (isCollageTemplateId(collage)) {
    const maxSelection = Math.min(
      PICKER_MAX_SELECTION,
      templatePhotoCount(findCollageTemplate(collage)),
    );
    return { mode: 'multiple', maxSelection, collage };
  }
  const multiple = route.data[PICKER_SELECTION_DATA_KEY] === 'multiple';
  return {
    mode: multiple ? 'multiple' : 'single',
    maxSelection: multiple ? PICKER_MAX_SELECTION : 1,
    collage: null,
  };
}
