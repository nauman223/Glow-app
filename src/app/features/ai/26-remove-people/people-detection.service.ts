import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { isAiCancellation } from '@core/ai-local/ai-local.errors';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { LoggerService } from '@core/logging/logger.service';

import { findPeople, type PeopleRegions } from './people-regions';

/**
 * - `idle`: waiting for the photo.
 * - `detecting`: on-device person segmentation is running.
 * - `ready`: done (possibly with no one found).
 * - `unavailable`: the device cannot run it, or it failed: the screen falls back to letting the
 *   server find the people.
 */
export type PeopleDetectionStatus = 'idle' | 'detecting' | 'ready' | 'unavailable';

/** Edges hardened at this confidence: blobs need a clear inside / outside. */
const PERSON_THRESHOLD = 0.5;

/**
 * Finds the people in the photo on the device (MediaPipe person segmentation, split into one
 * region per separate person), for board 26's Auto detect. Nothing is uploaded. Provide it in
 * the page; it stops the job and frees the regions on leave.
 */
@Injectable()
export class PeopleDetectionService {
  private readonly ai = inject(AiLocalService);
  private readonly logger = inject(LoggerService);
  private readonly controller = new AbortController();
  private readonly statusState = signal<PeopleDetectionStatus>('idle');
  private readonly regionsState = signal<PeopleRegions | null>(null);

  public readonly status = this.statusState.asReadonly();
  public readonly regions = this.regionsState.asReadonly();
  public readonly people = computed(() => this.regionsState()?.people ?? []);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.controller.abort();
      this.regionsState()?.dispose();
    });
  }

  /** Runs once per screen; resolves with the regions, or `null` when unavailable. */
  public async detect(image: ImageBitmap): Promise<PeopleRegions | null> {
    if (this.statusState() !== 'idle') {
      return this.regionsState();
    }
    if (!this.ai.supported) {
      this.statusState.set('unavailable');
      return null;
    }
    this.statusState.set('detecting');
    const startedAt = performance.now();
    try {
      const mask = await this.ai.segment(
        image,
        { mode: 'person', featherPx: 0, threshold: PERSON_THRESHOLD },
        { signal: this.controller.signal, channel: 'remove-people' },
      );
      let regions: PeopleRegions;
      try {
        regions = findPeople(mask.bitmap);
      } finally {
        mask.bitmap.close();
      }
      this.logger.info('People detected on device', {
        count: regions.people.length,
        durationMs: Math.round(performance.now() - startedAt),
      });
      this.regionsState.set(regions);
      this.statusState.set('ready');
      return regions;
    } catch (error: unknown) {
      if (!isAiCancellation(error)) {
        this.logger.warn('On-device people detection failed', error);
        this.statusState.set('unavailable');
      }
      return null;
    }
  }
}
