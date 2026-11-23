import { type ImageSize } from '@core/image/image.models';

import { type CanvasSnapshot } from './canvas.models';

const SNAPSHOT_VERSION = 1;

export interface SnapshotContent {
  readonly documentSize: ImageSize;
  readonly sourceSize: ImageSize;
  /** Output of `canvas.toObject(SERIALIZED_PROPERTIES)`. */
  readonly canvas: Record<string, unknown>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSize(value: unknown): value is ImageSize {
  return (
    isRecord(value) && typeof value['width'] === 'number' && typeof value['height'] === 'number'
  );
}

/** Fabric filter state; derived from the stored edit model, so it is never serialized. */
const DERIVED_IMAGE_KEYS = new Set(['filters', 'resizeFilter']);

/**
 * Removes Fabric filter instances from `canvas.toObject()` output, at any depth (groups). Images
 * get them back from `glowAdjust` / `glowPreset` after a restore (see rebuildAllImageEdits), so
 * snapshots stay small and undo never depends on Fabric's filter serialization.
 */
export function stripDerivedState(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDerivedState);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !DERIVED_IMAGE_KEYS.has(key))
      .map(([key, entry]) => [key, stripDerivedState(entry)]),
  );
}

export function serializeSnapshot(content: SnapshotContent): CanvasSnapshot {
  return JSON.stringify({ version: SNAPSHOT_VERSION, ...content }) as CanvasSnapshot;
}

export function parseSnapshot(snapshot: CanvasSnapshot): SnapshotContent {
  const parsed: unknown = JSON.parse(snapshot);
  if (
    !isRecord(parsed) ||
    parsed['version'] !== SNAPSHOT_VERSION ||
    !isSize(parsed['documentSize']) ||
    !isSize(parsed['sourceSize']) ||
    !isRecord(parsed['canvas'])
  ) {
    throw new Error('Unsupported canvas snapshot');
  }
  return {
    documentSize: parsed['documentSize'],
    sourceSize: parsed['sourceSize'],
    canvas: parsed['canvas'],
  };
}
