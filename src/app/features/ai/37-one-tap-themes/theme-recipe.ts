import { type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type ThemeRecipe } from '@core/catalog/catalog.models';
import { type ImageSize } from '@core/image/image.models';
import { releaseSurface, type Surface } from '@core/image/image-surface';
import { composeSky, DEFAULT_SCENE_RELIGHT } from '@features/ai/27-replace-sky/sky-compositor';
import { type LoadedSky } from '@features/ai/27-replace-sky/sky-images';
import { findSkyPreset, type SkyPreset } from '@features/ai/27-replace-sky/sky-presets';
import { defaultLightPoint } from '@features/ai/35-relight/relight-light';
import { findRelightPreset, type RelightPreset } from '@features/ai/35-relight/relight-presets';
import { type RelightScene, renderRelight } from '@features/ai/35-relight/relight-renderer';

import { applyThemeLook, copyToSurface } from './theme-look';

/** What a recipe's sky step needs; `null` skips the step (no sky in the photo). */
export interface ThemeSkyInput {
  readonly mask: CanvasImageSource;
  readonly bounds: NormalizedRect | null;
  readonly sky: LoadedSky;
}

export interface ThemeRenderInput {
  readonly image: CanvasImageSource;
  readonly size: ImageSize;
  readonly recipe: ThemeRecipe;
  readonly sky: ThemeSkyInput | null;
  /** Person mask and face for the relight step (it also works without them). */
  readonly scene: RelightScene;
}

/** The sky preset a recipe asks for, or `null` (none, or an id this app does not know). */
export function recipeSky(recipe: ThemeRecipe): SkyPreset | null {
  return recipe.sky === null ? null : findSkyPreset(recipe.sky.presetId);
}

export function recipeRelight(recipe: ThemeRecipe): RelightPreset | null {
  return recipe.relight === null ? null : findRelightPreset(recipe.relight.presetId);
}

/** Replaces `current` with `next`, freeing `current`. */
function swap(current: Surface, next: Surface): Surface {
  releaseSurface(current);
  return next;
}

/**
 * Applies a theme recipe in the approved order: sky → relight → adjust → filter. Unknown sky or
 * relight presets and a missing sky are skipped, so the rest of the theme still applies. The
 * relight step places the light the way Relight does by default (beside the face). The returned
 * surface belongs to the caller.
 */
export function renderTheme(input: ThemeRenderInput): Surface {
  const { recipe, size, scene } = input;
  let surface = copyToSurface(input.image, size);
  if (recipe.sky !== null && input.sky !== null) {
    surface = swap(
      surface,
      composeSky({
        image: surface,
        mask: input.sky.mask,
        bounds: input.sky.bounds,
        sky: input.sky.sky.bitmap,
        tone: input.sky.sky.tone,
        size,
        blend: recipe.sky.blend,
        relight: DEFAULT_SCENE_RELIGHT,
      }),
    );
  }
  const relightPreset = recipeRelight(recipe);
  if (recipe.relight !== null && relightPreset !== null) {
    surface = swap(
      surface,
      renderRelight({
        image: surface,
        size,
        scene,
        light: defaultLightPoint(scene.face),
        preset: relightPreset,
        intensity: recipe.relight.intensity,
        temperature: recipe.relight.temperature,
      }),
    );
  }
  applyThemeLook(surface, size, recipe.adjust, recipe.filter);
  return surface;
}
