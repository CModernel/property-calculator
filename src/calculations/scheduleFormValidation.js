export function validateAmount(amount) {
  return amount > 0;
}

export function validateScheduleRange(oneTime, startMonth, endMonth) {
  return oneTime || startMonth <= endMonth;
}

// Offset-contribution-specific: only one-time lumps landing on the exact
// same month conflict - two independent recurring contributions starting
// the same month don't.
export function hasDuplicateOneTimeMonth(items, startMonth) {
  return items.some(item => item.recurrence === 'none' && item.startMonth === startMonth);
}
