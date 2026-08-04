import { isMonthInRange } from './dateRange';

// Sums the `amount` of every item active in the given month. Each item is
// either a one-time hit (`type: 'one-time'`, active only when `month` matches
// exactly) or recurring (`type: 'recurring'`), either forever
// (`recurrence: 'forever'`) or for an inclusive `[startMonth, endMonth]`
// window (`recurrence: 'period'`). Shared by exceptional expenses and income
// sources, which use the exact same shape.
export function getActiveAmount(items, month) {
  return items.reduce((sum, item) => {
    if (item.type === 'one-time') {
      return item.month === month ? sum + item.amount : sum;
    }
    if (item.recurrence === 'forever') return sum + item.amount;
    if (item.recurrence === 'period' && isMonthInRange(month, item.startMonth, item.endMonth)) {
      return sum + item.amount;
    }
    return sum;
  }, 0);
}
