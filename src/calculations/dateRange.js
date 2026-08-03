// null/undefined on either bound means "no restriction" - always active.
export function isMonthInRange(month, startMonth, endMonth) {
  if (startMonth == null || endMonth == null) return true;
  return month >= startMonth && month <= endMonth;
}
