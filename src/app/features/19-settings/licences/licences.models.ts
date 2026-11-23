export type LicenceGroup = 'font' | 'model' | 'library';

/** One entry of `public/licenses/index.json` (written by `npm run licences`). */
export interface LicenceComponentDto {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly group: string;
  readonly licence: string;
  readonly notice?: string;
  readonly url?: string;
  readonly text: string;
}

export interface LicenceComponent {
  readonly id: string;
  readonly name: string;
  readonly version: string | null;
  readonly group: LicenceGroup;
  /** SPDX identifier, e.g. `MIT`. */
  readonly licence: string;
  readonly notice: string | null;
  readonly url: string | null;
  /** Licence text file, relative to the licences folder. Shared texts share a path. */
  readonly textPath: string;
}

export type LicenceTextState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly text: string }
  | { readonly status: 'error' };

export interface LicenceEntry {
  readonly component: LicenceComponent;
  readonly licenceName: string;
  readonly expanded: boolean;
  readonly text: LicenceTextState;
}

export interface LicenceSection {
  readonly group: LicenceGroup;
  readonly heading: string;
  readonly entries: readonly LicenceEntry[];
}

/** Display order of the sections. */
export const LICENCE_GROUPS: readonly LicenceGroup[] = ['font', 'model', 'library'];
/** Generated names only (`texts/<hash>.txt`): nothing else is ever fetched from the index. */
const TEXT_PATH = /^texts\/[0-9a-f]{12}\.txt$/;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function toDto(value: unknown): LicenceComponentDto | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, name, group, licence, text } = value;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof group !== 'string' ||
    typeof licence !== 'string' ||
    typeof text !== 'string'
  ) {
    return null;
  }
  return {
    id,
    name,
    group,
    licence,
    text,
    version: optionalString(value['version']),
    notice: optionalString(value['notice']),
    url: optionalString(value['url']),
  };
}

function isGroup(value: string): value is LicenceGroup {
  return LICENCE_GROUPS.some((group) => group === value);
}

export function mapLicenceComponent(dto: LicenceComponentDto): LicenceComponent | null {
  if (!isGroup(dto.group) || !TEXT_PATH.test(dto.text)) {
    return null;
  }
  return {
    id: dto.id,
    name: dto.name,
    version: dto.version ?? null,
    group: dto.group,
    licence: dto.licence,
    notice: dto.notice ?? null,
    url: dto.url?.startsWith('https://') === true ? dto.url : null,
    textPath: dto.text,
  };
}

/** Parses the index payload; malformed entries are dropped, a malformed index throws. */
export function mapLicenceIndex(payload: unknown): readonly LicenceComponent[] {
  const components: unknown = isRecord(payload) ? payload['components'] : null;
  if (!Array.isArray(components)) {
    throw new Error('Malformed licence index');
  }
  const entries: readonly unknown[] = components;
  return entries.flatMap((entry) => {
    const dto = toDto(entry);
    const component = dto === null ? null : mapLicenceComponent(dto);
    return component === null ? [] : [component];
  });
}
