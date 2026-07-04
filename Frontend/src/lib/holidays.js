// Thailand public holidays for 2026 (ISO yyyy-mm-dd -> label).
//
// NOTE: lunar/observance dates below are best-effort and should be reconciled
// against the official Bank of Thailand calendar before go-live. Songkran
// (Apr 13–15) is included as required by policy.
export const HOLIDAYS_2026 = {
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

export function getHolidayName(isoDate) {
  return HOLIDAYS_2026[isoDate] || null;
}
