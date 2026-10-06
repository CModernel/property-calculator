import { calculateCompoundedValue } from './growthRate';

// Same max month used everywhere else in the app (tenant/exceptional-expense
// sliders) - also doubles as the "Forever" sentinel for endMonth, per the
// user's own suggestion: an item ending at the max month never gets cut off
// before the simulation itself ends, so there's no need for a separate
// null-means-unbounded case.
export const MAX_MONTH = 360;

const INTERVAL_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };

// A single "Schedule" shape replaces the old one-time/recurring-forever/
// period split: { startMonth, recurrence: 'none'|'monthly'|'quarterly'|
// 'yearly', endMonth }. `endMonth` is only meaningful (and only stored) when
// recurrence isn't 'none'.
export function isScheduleActive(schedule, month) {
  if (month < schedule.startMonth) return false;
  if (schedule.recurrence === 'none') return month === schedule.startMonth;
  if (month > schedule.endMonth) return false;
  return (month - schedule.startMonth) % INTERVAL_MONTHS[schedule.recurrence] === 0;
}

// TODO-94: converts a Gross (pre-tax) item's amount to net via a flat
// effective tax rate - a no-op for any item without isGross (Exceptional/
// Personal Expense items never set it, so they're unaffected regardless of
// effectiveTaxRate).
function getNetAmount(item, effectiveTaxRate) {
  return item.isGross ? item.amount * (1 - effectiveTaxRate / 100) : item.amount;
}

// Sums the `amount` of every item active in the given month. Shared by
// Income Sources and Exceptional Expenses, which use the exact same shape.
export function getActiveAmount(items, month, effectiveTaxRate = 0) {
  return items.reduce((sum, item) => (isScheduleActive(item, month) ? sum + getNetAmount(item, effectiveTaxRate) : sum), 0);
}

// TODO-90: same as getActiveAmount, but each active item's amount grows by
// a fixed annual rate compounding from simulation month 1 - not from the
// item's own startMonth, a deliberate simplification (matches TODO-89's
// Property Appreciation, which also grows from month 1 regardless of when
// the mortgage itself started).
export function getActiveAmountWithGrowth(items, month, annualGrowthRate, effectiveTaxRate = 0) {
  const growthMultiplier = calculateCompoundedValue(1, annualGrowthRate, month);
  return items.reduce(
    (sum, item) => (isScheduleActive(item, month) ? sum + getNetAmount(item, effectiveTaxRate) * growthMultiplier : sum),
    0
  );
}

// TODO-182: the per-month AVERAGE of an item, for the point-in-time figures
// (Day-1 cards and the Health Check's Day-1 and Stabilized readings). Exact
// months - getActiveAmount - charge a quarterly/yearly item in full in its
// firing month and $0 in the others, so a single snapshot month either
// overstates it 3-12x or drops it entirely depending on alignment. Here a
// recurring item counts amount / interval in every month it is in force
// (startMonth..endMonth), the same /4 and /12 the stepped property fields use
// (loan.js). A one-time item stays exact: it's a lump sum, not a rate. The
// simulation and the Timeline Explorer keep the exact months.
// Returns the share of the item's amount that counts in `month` (0 when it
// isn't in force, or its recurrence is unknown - the same "doesn't count" the
// exact path gives such an item).
function getAveragedShare(item, month) {
  if (item.recurrence === 'none') return isScheduleActive(item, month) ? 1 : 0;
  if (!(item.recurrence in INTERVAL_MONTHS)) return 0;
  if (month < item.startMonth || month > item.endMonth) return 0;
  return 1 / INTERVAL_MONTHS[item.recurrence];
}

// Items with a zero share are SKIPPED, not multiplied by 0, exactly like
// getActiveAmount skips inactive ones: `NaN * 0` is NaN, so one malformed
// amount on an item that isn't even in force would otherwise poison the total.
export function getAveragedAmount(items, month, effectiveTaxRate = 0) {
  return items.reduce((sum, item) => {
    const share = getAveragedShare(item, month);
    return share === 0 ? sum : sum + getNetAmount(item, effectiveTaxRate) * share;
  }, 0);
}

export function getAveragedAmountWithGrowth(items, month, annualGrowthRate, effectiveTaxRate = 0) {
  return getAveragedAmount(items, month, effectiveTaxRate) * calculateCompoundedValue(1, annualGrowthRate, month);
}

// How many times a schedule has fired by the given month (inclusive) -
// used by the Timeline Explorer's cumulative offset history, where a
// recurring contribution needs a running total instead of a single
// active/inactive check.
export function countOccurrencesUpTo(schedule, month) {
  if (month < schedule.startMonth) return 0;
  if (schedule.recurrence === 'none') return 1;
  const cappedMonth = Math.min(month, schedule.endMonth);
  return Math.floor((cappedMonth - schedule.startMonth) / INTERVAL_MONTHS[schedule.recurrence]) + 1;
}

// Coarser than isScheduleActive - the Timeline Explorer's status lists
// (Income Context, Expenses Status) want to keep showing an item through its
// whole "past" life once it's over, not just flicker active on its exact
// firing months, so a recurring item counts as 'active' for its entire
// [startMonth, endMonth] range rather than only on months it actually fires.
export function classifyScheduleStatus(schedule, month) {
  if (month < schedule.startMonth) return 'future';
  if (schedule.recurrence === 'none') return month > schedule.startMonth ? 'past' : 'active';
  return month > schedule.endMonth ? 'past' : 'active';
}

const RECURRENCE_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

// Human-readable summary for list rows (e.g. "Monthly, from month 1" or
// "Quarterly, months 3-12").
export function formatScheduleLabel(schedule) {
  if (schedule.recurrence === 'none') return `Month ${schedule.startMonth}`;
  const label = RECURRENCE_LABELS[schedule.recurrence];
  return schedule.endMonth === MAX_MONTH
    ? `${label}, from month ${schedule.startMonth}`
    : `${label}, months ${schedule.startMonth}-${schedule.endMonth}`;
}
