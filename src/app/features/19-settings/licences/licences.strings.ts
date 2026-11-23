import { type LicenceGroup } from './licences.models';

export const LICENCES_STRINGS = {
  title: 'Open-source licences',
  backLabel: 'Back to Settings',
  intro:
    'Glow is built with open-source software, fonts and AI models. Their authors and licences are listed below.',
  loading: 'Loading licences',
  loadErrorTitle: 'Licences could not be loaded',
  loadErrorMessage: 'Something went wrong while reading the licence list.',
  retry: 'Try again',
  groups: {
    font: 'Fonts',
    model: 'On-device AI models',
    library: 'Software libraries',
  } satisfies Readonly<Record<LicenceGroup, string>>,
  versionPrefix: 'Version ',
  source: 'Source',
  opensInBrowser: '(opens in your browser)',
  showText: 'Show licence text',
  hideText: 'Hide licence text',
  loadingText: 'Loading licence text',
  textError: 'The licence text could not be loaded.',
} as const;

/** Display names for the SPDX identifiers in the licence index. */
export const LICENCE_NAMES: Readonly<Record<string, string>> = {
  '0BSD': 'BSD Zero Clause License',
  'Apache-2.0': 'Apache License 2.0',
  ISC: 'ISC License',
  MIT: 'MIT License',
  'MPL-2.0': 'Mozilla Public License 2.0',
  'OFL-1.1': 'SIL Open Font License 1.1',
};
