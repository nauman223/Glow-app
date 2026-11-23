import { computed, inject, type Signal } from '@angular/core';
import { CatalogService } from '@core/catalog/catalog.service';

import { AI_FEATURES, type AiFeatureDefinition } from './ai-features';

/**
 * The built AI screens the feature flags leave on, in registry order, for the AI tools sheets
 * (Home, editor). Starts loading the flags (local copy first; safe all-on defaults until then).
 * Call in an injection context.
 */
export function injectAvailableAiFeatures(): Signal<readonly AiFeatureDefinition[]> {
  const catalog = inject(CatalogService);
  void catalog.loadFlags();
  return computed(() => {
    const enabled = catalog.enabledAiFeatures();
    return AI_FEATURES.filter((feature) => enabled.has(feature.id));
  });
}
