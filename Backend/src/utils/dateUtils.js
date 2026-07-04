/**
 * Date helpers for WFH business rules.
 *
 * All comparisons are done at day granularity (time-of-day stripped) using the
 * server's local timezone. Deploy the server in the company's timezone
 * (e.g. Asia/Bangkok) or set TZ accordingly so "today" matches the employee.
 */

const DAY = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

// WFH is only allowed on Tue/Wed/Thu — block Sat, Sun, Mon, Fri.
const BLOCKED_WFH_DAYS = [DAY.SAT, DAY.SUN, DAY.MON, DAY.FRI];

// Thai public holidays for 2026 (local yyyy-mm-dd -> label). This is the
// server-side source of truth and MIRRORS Frontend/src/lib/holidays.js. WFH is
// never allowed on these dates, regardless of weekday. Songkran (Apr 13–15) is
// included as required by policy; reconcile the lunar/observance dates against
// the official Bank of Thailand calendar before go-live.
const HOLIDAYS_2026 = {
  '2026-01-01': "New Year's Day",
  '2026-03-03': 'Makha Bucha Day',
  '2026-04-06': 'Chakri Memorial Day',
  '2026-04-13': 'Songkran Festival',
  '2026-04-14': 'Songkran Festival',
  '2026-04-15': 'Songkran Festival',
  '2026-05-01': 'National Labour Day',
  '2026-05-04': 'Coronation Day',
  '2026-06-01': 'Visakha Bucha Day (observed)',
  '2026-06-03': "Queen Suthida's Birthday",
  '2026-07-28': "King Vajiralongkorn's Birthday",
  '2026-07-29': 'Asalha Bucha Day',
  '2026-07-30': 'Khao Phansa Day',
  '2026-08-12': "Mother's Day (Queen Sirikit's Birthday)",
  '2026-10-13': 'King Bhumibol Memorial Day',
  '2026-10-23': 'Chulalongkorn Day',
  '2026-12-07': "Father's Day (observed)",
  '2026-12-10': 'Constitution Day',
  '2026-12-31': "New Year's Eve",
};

/** Returns a new Date at 00:00:00.000 of the given date's calendar day. */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local yyyy-mm-dd for the given date (avoids the UTC shift of toISOString). */
function toISODate(date) {
  const d = startOfDay(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Returns the public-holiday label for the date, or null if it isn't one. */
function getHolidayName(date) {
  return HOLIDAYS_2026[toISODate(date)] || null;
}

/** True if the date is a Thai public holiday (WFH is never allowed then). */
function isPublicHoliday(date) {
  return Boolean(getHolidayName(date));
}

/** Business days are Mon–Fri. */
function isBusinessDay(date) {
  const day = date.getDay();
  return day !== DAY.SAT && day !== DAY.SUN;
}

/** True if WFH is not permitted on this weekday (Sat/Sun/Mon/Fri). */
function isBlockedWfhDay(date) {
  return BLOCKED_WFH_DAYS.includes(new Date(date).getDay());
}

/**
 * Counts business days strictly between `start` and `end` (both endpoints
 * excluded). Used to enforce the "at least 1 business day notice" rule.
 *
 * Example: start = Fri, end = Tue -> Monday is the only day in between -> 1.
 */
function businessDaysBetween(start, end) {
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  let count = 0;

  cursor.setDate(cursor.getDate() + 1); // exclude start
  while (cursor < last) {
    if (isBusinessDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count; // `last` itself is excluded
}

/**
 * Counts business days (Mon–Fri) between `start` and `end`, both endpoints
 * INCLUDED. Used to size a leave request against the annual quota — weekends do
 * not consume quota. Returns 0 if the range is only weekends or start > end.
 */
function countBusinessDaysInclusive(start, end) {
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  let count = 0;

  while (cursor <= last) {
    if (isBusinessDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** First day of this date's month and first day of the next month (exclusive end). */
function monthRange(date) {
  const d = startOfDay(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

module.exports = {
  DAY,
  BLOCKED_WFH_DAYS,
  HOLIDAYS_2026,
  startOfDay,
  toISODate,
  getHolidayName,
  isPublicHoliday,
  isBusinessDay,
  isBlockedWfhDay,
  businessDaysBetween,
  countBusinessDaysInclusive,
  monthRange,
};
