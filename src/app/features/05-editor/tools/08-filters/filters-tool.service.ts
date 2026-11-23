import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  FILTER_PRESETS,
  type FilterPresetId,
  ORIGINAL_PRESET_ID,
  VISIBLE_FILTER_PRESETS,
} from '@core/canvas/filters/filter-presets';
import { ImageEditSession } from '@core/canvas/filters/image-edit-session';
import { type ImageEdits, NO_EDITS } from '@core/canvas/filters/image-edits.models';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { LoggerService } from '@core/logging/logger.service';

import { FilterThumbnailsService } from './filter-thumbnails.service';
import { FILTERS_STRINGS } from './filters.strings';

/** Intensity a newly chosen look starts at. */
const DEFAULT_INTENSITY = 100;

const PRO_PRESET_IDS: ReadonlySet<FilterPresetId> = new Set(
  FILTER_PRESETS.filter((preset) => preset.pro).map((preset) => preset.id),
);

export function isProPreset(id: FilterPresetId): boolean {
  return PRO_PRESET_IDS.has(id);
}

/**
 * Filters session (provided by the Filters panel). Only the preset part of the image's edit
 * model changes here, so a look and the Adjust values compose. Choosing a look is one history
 * step; the intensity slider previews live and records one step on release. A Pro look the user
 * cannot use yet is previewed only (never recorded); Apply is gated on it (`locked`).
 */
@Injectable()
export class FiltersToolService {
  private readonly session = inject(ImageEditSession);
  private readonly thumbnails = inject(FilterThumbnailsService);
  private readonly logger = inject(LoggerService);
  private readonly access = inject(PackAccessService).accessFor(PACK_IDS.filters);

  private readonly editsState = signal<ImageEdits>(NO_EDITS);
  private readonly tilesState = signal<Readonly<Partial<Record<FilterPresetId, string>>>>({});
  private readonly layerState = signal(false);
  /** The look the image had when the tool opened: part of the document, never re-gated. */
  private readonly startPresetState = signal<FilterPresetId>(ORIGINAL_PRESET_ID);
  /** Edits as last recorded in history (what a locked preview is reverted to). */
  private recorded: ImageEdits = NO_EDITS;
  private closed = false;

  public readonly presets = VISIBLE_FILTER_PRESETS;
  public readonly tiles = this.tilesState.asReadonly();
  /** A selected photo layer is being filtered rather than the base photo. */
  public readonly editingLayer = this.layerState.asReadonly();
  public readonly selected = computed<FilterPresetId>(
    () => this.editsState().preset?.id ?? ORIGINAL_PRESET_ID,
  );
  public readonly intensity = computed(
    () => this.editsState().preset?.intensity ?? DEFAULT_INTENSITY,
  );
  /** Free users without a live unlock may see the Pro pack's PRO badges. */
  public readonly proAccess = this.access;
  /** The selected look is a newly chosen Pro look the user has no access to: preview only. */
  public readonly locked = computed(() => {
    const id = this.selected();
    return isProPreset(id) && id !== this.startPresetState() && !this.access();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.closed = true;
    });
  }

  public async begin(): Promise<boolean> {
    const target = await this.session.begin();
    if (target === null) {
      return false;
    }
    this.editsState.set(target.edits);
    this.startPresetState.set(target.edits.preset?.id ?? ORIGINAL_PRESET_ID);
    this.recorded = target.edits;
    this.layerState.set(target.kind === 'layer');
    this.thumbnails
      .load(
        target.id,
        this.presets.map((preset) => preset.id),
        (id, url) => {
          this.tilesState.update((tiles) => ({ ...tiles, [id]: url }));
        },
        () => this.closed,
      )
      .catch((error: unknown) => {
        this.logger.warn('Filter thumbnails unavailable', error);
      });
    return true;
  }

  public async select(id: FilterPresetId): Promise<void> {
    if (id === this.selected()) {
      return;
    }
    const preset = id === ORIGINAL_PRESET_ID ? null : { id, intensity: this.intensity() };
    const edits = { ...this.editsState(), preset };
    this.editsState.set(edits);
    if (this.locked()) {
      this.session.preview(edits);
      return;
    }
    const label =
      preset === null
        ? FILTERS_STRINGS.commandLabels.remove
        : FILTERS_STRINGS.commandLabels.preset(FILTERS_STRINGS.presetNames[id]);
    await this.record(label, edits);
  }

  public previewIntensity(intensity: number): void {
    const edits = this.withIntensity(intensity);
    if (edits !== null) {
      this.session.preview(edits);
    }
  }

  public async commitIntensity(intensity: number): Promise<void> {
    const edits = this.withIntensity(intensity);
    if (edits !== null && this.locked()) {
      this.session.preview(edits);
    } else if (edits !== null) {
      await this.record(FILTERS_STRINGS.commandLabels.intensity, edits);
    }
  }

  public apply(): Promise<void> {
    return this.session.apply(FILTERS_STRINGS.commandLabels.apply, this.editsState());
  }

  public cancel(): Promise<void> {
    return this.session.cancel();
  }

  /** Puts the image back to its last recorded look, dropping a locked Pro preview. */
  public async revertPreview(): Promise<void> {
    this.editsState.set(this.recorded);
    // Settles pending previews and redraws the recorded edits; records nothing new.
    await this.session.commit(FILTERS_STRINGS.commandLabels.apply, this.recorded);
  }

  private async record(label: string, edits: ImageEdits): Promise<void> {
    await this.session.commit(label, edits);
    this.recorded = edits;
  }

  private withIntensity(intensity: number): ImageEdits | null {
    const current = this.editsState();
    if (current.preset === null) {
      return null;
    }
    const edits = { ...current, preset: { ...current.preset, intensity } };
    this.editsState.set(edits);
    return edits;
  }
}
