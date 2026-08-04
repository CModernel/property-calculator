import { describe, it, expect } from 'vitest';
import { getActiveAmount, isScheduleActive, countOccurrencesUpTo, classifyScheduleStatus, formatScheduleLabel, MAX_MONTH } from './recurringAmount';

describe('isScheduleActive', () => {
  it('is active only on its exact month when recurrence is "none"', () => {
    const schedule = { startMonth: 6, recurrence: 'none' };
    expect(isScheduleActive(schedule, 5)).toBe(false);
    expect(isScheduleActive(schedule, 6)).toBe(true);
    expect(isScheduleActive(schedule, 7)).toBe(false);
  });

  it('is active every month for "monthly" recurrence within its range', () => {
    const schedule = { startMonth: 3, recurrence: 'monthly', endMonth: 5 };
    expect(isScheduleActive(schedule, 2)).toBe(false);
    expect(isScheduleActive(schedule, 3)).toBe(true);
    expect(isScheduleActive(schedule, 4)).toBe(true);
    expect(isScheduleActive(schedule, 5)).toBe(true);
    expect(isScheduleActive(schedule, 6)).toBe(false);
  });

  it('is active only every 3rd month for "quarterly" recurrence', () => {
    const schedule = { startMonth: 3, recurrence: 'quarterly', endMonth: MAX_MONTH };
    expect(isScheduleActive(schedule, 3)).toBe(true);
    expect(isScheduleActive(schedule, 4)).toBe(false);
    expect(isScheduleActive(schedule, 5)).toBe(false);
    expect(isScheduleActive(schedule, 6)).toBe(true);
    expect(isScheduleActive(schedule, 9)).toBe(true);
  });

  it('is active only every 12th month for "yearly" recurrence', () => {
    const schedule = { startMonth: 1, recurrence: 'yearly', endMonth: MAX_MONTH };
    expect(isScheduleActive(schedule, 1)).toBe(true);
    expect(isScheduleActive(schedule, 12)).toBe(false);
    expect(isScheduleActive(schedule, 13)).toBe(true);
    expect(isScheduleActive(schedule, 25)).toBe(true);
  });

  it('never turns off when endMonth is at MAX_MONTH ("Forever")', () => {
    const schedule = { startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH };
    expect(isScheduleActive(schedule, MAX_MONTH)).toBe(true);
  });

  it('stops after endMonth (inclusive boundary)', () => {
    const schedule = { startMonth: 1, recurrence: 'monthly', endMonth: 10 };
    expect(isScheduleActive(schedule, 10)).toBe(true);
    expect(isScheduleActive(schedule, 11)).toBe(false);
  });
});

describe('getActiveAmount', () => {
  it('sums multiple active schedules for a given month', () => {
    const items = [
      { amount: 100, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
      { amount: 50, startMonth: 5, recurrence: 'none' },
      { amount: 20, startMonth: 3, recurrence: 'quarterly', endMonth: MAX_MONTH },
    ];
    expect(getActiveAmount(items, 5)).toBe(150); // monthly + one-time, quarterly not due
    expect(getActiveAmount(items, 6)).toBe(120); // monthly + quarterly (month 6 = 3+3)
  });

  it('returns 0 for an empty list', () => {
    expect(getActiveAmount([], 1)).toBe(0);
  });
});

describe('countOccurrencesUpTo', () => {
  it('returns 0 before the schedule has started', () => {
    expect(countOccurrencesUpTo({ startMonth: 6, recurrence: 'none' }, 5)).toBe(0);
  });

  it('counts a one-time schedule as exactly 1 occurrence once reached', () => {
    expect(countOccurrencesUpTo({ startMonth: 6, recurrence: 'none' }, 6)).toBe(1);
    expect(countOccurrencesUpTo({ startMonth: 6, recurrence: 'none' }, 50)).toBe(1);
  });

  it('counts every fired month for a recurring schedule', () => {
    const schedule = { startMonth: 3, recurrence: 'monthly', endMonth: MAX_MONTH };
    expect(countOccurrencesUpTo(schedule, 3)).toBe(1);
    expect(countOccurrencesUpTo(schedule, 5)).toBe(3);
  });

  it('counts only the fired months for quarterly/yearly recurrence', () => {
    expect(countOccurrencesUpTo({ startMonth: 1, recurrence: 'quarterly', endMonth: MAX_MONTH }, 9)).toBe(3);
    expect(countOccurrencesUpTo({ startMonth: 1, recurrence: 'yearly', endMonth: MAX_MONTH }, 25)).toBe(3);
  });

  it('stops counting past endMonth (inclusive boundary)', () => {
    const schedule = { startMonth: 1, recurrence: 'monthly', endMonth: 10 };
    expect(countOccurrencesUpTo(schedule, 10)).toBe(10);
    expect(countOccurrencesUpTo(schedule, 50)).toBe(10);
  });
});

describe('classifyScheduleStatus', () => {
  it('is "future" before the schedule starts', () => {
    expect(classifyScheduleStatus({ startMonth: 6, recurrence: 'none' }, 5)).toBe('future');
  });

  it('a one-time schedule is "active" only on its exact month, "past" after', () => {
    const schedule = { startMonth: 6, recurrence: 'none' };
    expect(classifyScheduleStatus(schedule, 6)).toBe('active');
    expect(classifyScheduleStatus(schedule, 7)).toBe('past');
  });

  it('a recurring schedule is "active" for its whole range, not just firing months', () => {
    const schedule = { startMonth: 3, recurrence: 'quarterly', endMonth: 12 };
    expect(classifyScheduleStatus(schedule, 3)).toBe('active');
    expect(classifyScheduleStatus(schedule, 4)).toBe('active'); // doesn't fire this month, but still active
    expect(classifyScheduleStatus(schedule, 12)).toBe('active');
  });

  it('a recurring schedule is "past" once past its endMonth', () => {
    const schedule = { startMonth: 3, recurrence: 'monthly', endMonth: 12 };
    expect(classifyScheduleStatus(schedule, 13)).toBe('past');
  });

  it('a "Forever" (endMonth === MAX_MONTH) schedule never becomes "past"', () => {
    expect(classifyScheduleStatus({ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }, MAX_MONTH)).toBe('active');
  });
});

describe('formatScheduleLabel', () => {
  it('formats a one-time schedule', () => {
    expect(formatScheduleLabel({ startMonth: 7, recurrence: 'none' })).toBe('Month 7');
  });

  it('formats an open-ended ("Forever") recurring schedule', () => {
    expect(formatScheduleLabel({ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH })).toBe(
      'Monthly, from month 1'
    );
  });

  it('formats a bounded period for each recurrence type', () => {
    expect(formatScheduleLabel({ startMonth: 3, recurrence: 'monthly', endMonth: 12 })).toBe('Monthly, months 3-12');
    expect(formatScheduleLabel({ startMonth: 3, recurrence: 'quarterly', endMonth: 12 })).toBe(
      'Quarterly, months 3-12'
    );
    expect(formatScheduleLabel({ startMonth: 1, recurrence: 'yearly', endMonth: 60 })).toBe('Yearly, months 1-60');
  });
});
