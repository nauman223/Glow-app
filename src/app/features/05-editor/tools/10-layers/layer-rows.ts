import { linkedSignal, type Signal, type WritableSignal } from '@angular/core';
import { type CanvasLayer } from '@core/canvas/layers/layer.models';

import { layerName } from './layer-names';

/** View model of one drawer row. */
export interface LayerRow {
  readonly layer: CanvasLayer;
  readonly name: string;
  readonly thumbnail: string | null;
  /** The base photo and locked layers stay where they are. */
  readonly draggable: boolean;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

/** Rows for `layers` (top first); nothing moves below the base photo. */
export function buildLayerRows(
  layers: readonly CanvasLayer[],
  thumbnails: ReadonlyMap<string, string>,
): LayerRow[] {
  return layers.map((layer, index) => {
    const draggable = layer.role !== 'base' && !layer.locked;
    const below = layers.at(index + 1);
    return {
      layer,
      name: layerName(layer),
      thumbnail: thumbnails.get(layer.id) ?? null,
      draggable,
      canMoveUp: draggable && index > 0,
      canMoveDown: draggable && below !== undefined && below.role !== 'base',
    };
  });
}

/**
 * The row whose properties the drawer shows: the canvas selection when there is one; otherwise
 * the row the user picked (locked and hidden layers cannot be selected on the canvas), as long
 * as it still exists; otherwise the top layer.
 */
export function focusedLayerId(
  selectedId: Signal<string | null>,
  layers: Signal<readonly CanvasLayer[]>,
): WritableSignal<string | null> {
  return linkedSignal<
    { readonly selected: string | null; readonly layers: readonly CanvasLayer[] },
    string | null
  >({
    source: () => ({ selected: selectedId(), layers: layers() }),
    computation: (source, previous) => {
      const exists = (id: string | null | undefined): id is string =>
        id !== null && id !== undefined && source.layers.some((layer) => layer.id === id);
      if (exists(source.selected)) {
        return source.selected;
      }
      const kept = previous?.value;
      return exists(kept) ? kept : (source.layers.at(0)?.id ?? null);
    },
  });
}
