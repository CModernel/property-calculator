// Each bound is independently optional: null/undefined means "unbounded in
// that direction". Both null means always active; only startMonth set means
// active from that month onward with no end; only endMonth set means active
// up to that month with no defined start; both set means the inclusive range.
export function isMonthInRange(month, startMonth, endMonth) {
  if (startMonth != null && month < startMonth) return false;
  if (endMonth != null && month > endMonth) return false;
  return true;
}
