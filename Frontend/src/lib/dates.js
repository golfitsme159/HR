import { getHolidayName } from './holidays';

// Date helpers for the WFH calendar. These MIRROR the backend rules in
// Backend/src/utils/dateUtils.js (block Sat/Sun/Mon/Fri, >= 1 business day
// notice) and additionally disable Thai public holidays on the client.

const BLOCKED_WEEKDAYS = [0, 1, 5, 6]; // Sun, Mon, Fri, Sat

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local yyyy-mm-dd (avoids the UTC shift of toISOString). */
export function toISODate(date) {
  const d = startOfDay(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function isBlockedWeekday(date) {
  return BLOCKED_WEEKDAYS.includes(date.getDay());
}

/** Business days strictly between start and end (both endpoints excluded). */
export function businessDaysBetween(start, end) {
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  let count = 0;
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < last) {
    if (isBusinessDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Business days in [start, end] inclusive (weekends excluded). */
export function businessDaysInclusive(start, end) {
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  let count = 0;
  while (cursor <= last) {
    if (isBusinessDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Evaluates a candidate WFH date against all rules.
 * @returns {{ selectable: boolean, reason: string | null, holiday: string | null }}
 */
export function evaluateWfhDate(date, today = new Date()) {
  const d = startOfDay(date);
  const t = startOfDay(today);
  const holiday = getHolidayName(toISODate(d));

  if (d <= t) return { selectable: false, reason: 'Past / today', holiday };
  if (d.getDay() === 0 || d.getDay() === 6)
    return { selectable: false, reason: 'Weekend', holiday };
  if (d.getDay() === 1 || d.getDay() === 5)
    return { selectable: false, reason: 'Mon/Fri policy', holiday };
  if (holiday) return { selectable: false, reason: 'Public holiday', holiday };
  if (businessDaysBetween(t, d) < 1)
    return { selectable: false, reason: 'Needs 1 working day notice', holiday };

  return { selectable: true, reason: null, holiday };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const monthName = (m) => MONTH_NAMES[m];

/** Builds a 6-row calendar grid (Sun-first) for the given year/month. */
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Short human date, e.g. "Tue, 14 Jul 2026". */
export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
