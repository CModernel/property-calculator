// changes: array of {startMonth, amount}, need not be sorted. A change is
// open-ended - it applies from its startMonth onward until a later change
// (if any) supersedes it. No applicable change yet -> the base value.
export function getSteppedValue(base, changes, month) {
  const applicable = changes.filter((c) => c.startMonth <= month);
  if (applicable.length === 0) return base;
  return applicable.reduce((latest, c) => (c.startMonth > latest.startMonth ? c : latest)).amount;
}
