import { HOME_STRINGS } from '../../home.strings';

const DAY_MS = 86_400_000;

const SHORT_DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const FULL_DATE_TIME = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday", "3 Nov" (locale order), or with the year when it is not this year. */
export function relativeDayLabel(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / DAY_MS);
  if (days === 0) {
    return HOME_STRINGS.recent.today;
  }
  if (days === 1) {
    return HOME_STRINGS.recent.yesterday;
  }
  return date.getFullYear() === now.getFullYear()
    ? SHORT_DATE.format(date)
    : SHORT_DATE_WITH_YEAR.format(date);
}

/** Unambiguous local date and time for screen readers. */
export function fullDateTimeLabel(isoDate: string): string {
  return FULL_DATE_TIME.format(new Date(isoDate));
}
