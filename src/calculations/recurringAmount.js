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

// Sums the `amount` of every item active in the given month. Shared by
// Income Sources and Exceptional Expenses, which use the exact same shape.
export function getActiveAmount(items, month) {
  return items.reduce((sum, item) => (isScheduleActive(item, month) ? sum + item.amount : sum), 0);
}

// TODO-90: same as getActiveAmount, but each active item's amount grows by
// a fixed annual rate compounding from simulation month 1 - not from the
// item's own startMonth, a deliberate simplification (matches TODO-89's
// Property Appreciation, which also grows from month 1 regardless of when
// the mortgage itself started).
export function getActiveAmountWithGrowth(items, month, annualGrowthRate) {
  const growthMultiplier = calculateCompoundedValue(1, annualGrowthRate, month);
  return items.reduce((sum, item) => (isScheduleActive(item, month) ? sum + item.amount * growthMultiplier : sum), 0);
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
