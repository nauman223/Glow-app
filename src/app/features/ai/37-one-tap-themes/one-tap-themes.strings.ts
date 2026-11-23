export const ONE_TAP_THEMES_STRINGS = {
  eyebrow: 'Trending this week',
  title: 'One-tap themes',
  categoriesLabel: 'Theme categories',
  allCategories: 'All',
  galleryLabel: 'Themes',
  loading: 'Loading themes',
  isNew: 'New',
  /** Usage line under a card, e.g. "12.4K uses". */
  uses: (count: string): string => `${count} uses`,
  /** Drop banner: "New themes drop in" + the bold "3 days". */
  dropPrefix: 'New themes drop in',
  previewEyebrow: 'Theme preview',
  previewOptionsLabel: 'Theme options',
  /** History label, e.g. "Winter frost theme" (shown as "Undo Winter frost theme"). */
  historyLabel: (name: string): string => `${name} theme`,
  emptyTitle: 'No themes here yet',
  emptyMessage: 'New themes drop regularly. Try another category.',
  catalogErrorTitle: 'Themes could not be loaded',
  catalogErrorMessage: 'Check your connection and try again.',
  /** Board 17 dialog title for the Pro themes pack. */
  unlockTitle: 'Unlock Pro themes',
} as const;
