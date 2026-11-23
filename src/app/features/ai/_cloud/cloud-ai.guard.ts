import { inject } from '@angular/core';
import { type CanActivateFn } from '@angular/router';
import { isCloudAiFeature } from '@core/ai-cloud/ai-cloud.models';
import { CatalogService } from '@core/catalog/catalog.service';
import { ToastService } from '@core/notifications/toast.service';
import { aiGuard } from '@features/ai/_shell/ai.guard';

import { CLOUD_AI_STRINGS } from './cloud-ai.strings';

/** Route `data` key naming the cloud feature slug, e.g. `data: { cloudFeature: 'enhance' }`. */
export const CLOUD_FEATURE_ROUTE_KEY = 'cloudFeature';

/**
 * Cloud AI screens (the spec's `proOrCreditGuard`): a live editor document (aiGuard) and the
 * remote feature flag on; a disabled feature stays where the user is, with a toast. Credits and
 * Pro are checked when the user taps the action button (CloudChargeService), not here, so the
 * options can be explored freely. Lazy: wrap with `lazyGuard` in app.routes.ts.
 */
export const cloudAiGuard: CanActivateFn = (route, state) => {
  const editorReady = aiGuard(route, state);
  const feature: unknown = route.data[CLOUD_FEATURE_ROUTE_KEY];
  if (editorReady !== true || !isCloudAiFeature(feature)) {
    return editorReady;
  }
  const catalog = inject(CatalogService);
  const toast = inject(ToastService);
  return catalog.loadFlags().then(() => {
    if (catalog.isAiFeatureEnabled(feature)) {
      return true;
    }
    toast.show(CLOUD_AI_STRINGS.disabled, { variant: 'warning' });
    return false;
  });
};
