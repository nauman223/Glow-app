import { type MediaAsset } from '@core/media/media-library.models';

import { PICKER_STRINGS } from '../../picker.strings';

export interface CameraCell {
  readonly kind: 'camera';
  readonly key: string;
}

export interface AssetCell {
  readonly kind: 'asset';
  readonly key: string;
  readonly asset: MediaAsset;
  readonly label: string;
  readonly selected: boolean;
  readonly pending: boolean;
  /** 1-based position in a multi-selection; null when unselected or in single mode. */
  readonly order: number | null;
  /** Multi-select only: show the empty selection circle. */
  readonly showCircle: boolean;
  readonly ariaPressed: 'true' | 'false' | null;
}

export interface PlaceholderCell {
  readonly kind: 'placeholder';
  readonly key: string;
}

export type GridCell = CameraCell | AssetCell | PlaceholderCell;

export interface GridRow {
  readonly key: string;
  readonly cells: readonly GridCell[];
}

export interface GridRowsInput {
  readonly assets: readonly MediaAsset[];
  readonly selection: ReadonlyMap<string, number>;
  readonly numbered: boolean;
  readonly pendingId: string | null;
  readonly loadingMore: boolean;
  readonly columns: number;
}

const CAMERA_CELL: CameraCell = { kind: 'camera', key: 'camera-tile' };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** Accessible names are cached per asset object; rows are rebuilt on every selection change. */
const labelCache = new WeakMap<MediaAsset, string>();

function assetLabel(asset: MediaAsset): string {
  let label = labelCache.get(asset);
  if (label === undefined) {
    const taken = new Date(asset.takenAt);
    label = Number.isNaN(taken.getTime())
      ? PICKER_STRINGS.photo
      : PICKER_STRINGS.photoLabel(dateFormat.format(taken));
    labelCache.set(asset, label);
  }
  return label;
}

function toAssetCell(asset: MediaAsset, input: GridRowsInput): AssetCell {
  const position = input.selection.get(asset.id) ?? null;
  return {
    kind: 'asset',
    key: asset.id,
    asset,
    label: assetLabel(asset),
    selected: position !== null,
    pending: asset.id === input.pendingId,
    order: input.numbered ? position : null,
    showCircle: input.numbered && position === null,
    ariaPressed: input.numbered ? (position === null ? 'false' : 'true') : null,
  };
}

/** Camera tile first (as in the design), then the assets, then a placeholder row while paging. */
export function buildGridRows(input: GridRowsInput): readonly GridRow[] {
  const cells: GridCell[] = [CAMERA_CELL];
  for (const asset of input.assets) {
    cells.push(toAssetCell(asset, input));
  }
  if (input.loadingMore) {
    // Fill the last partial row, then one full row of placeholders.
    const missing = (input.columns - (cells.length % input.columns)) % input.columns;
    for (let index = 0; index < missing + input.columns; index += 1) {
      cells.push({ kind: 'placeholder', key: `placeholder-${index.toString()}` });
    }
  }
  const rows: GridRow[] = [];
  for (let start = 0; start < cells.length; start += input.columns) {
    const rowCells = cells.slice(start, start + input.columns);
    rows.push({ key: rowCells[0]?.key ?? `row-${start.toString()}`, cells: rowCells });
  }
  return rows;
}
