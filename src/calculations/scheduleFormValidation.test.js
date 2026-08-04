import { describe, it, expect } from 'vitest';
import { validateAmount, validateScheduleRange, hasDuplicateOneTimeMonth } from './scheduleFormValidation';

describe('validateAmount', () => {
  it('rejects zero and negative amounts', () => {
    expect(validateAmount(0)).toBe(false);
    expect(validateAmount(-10)).toBe(false);
  });

  it('accepts a positive amount', () => {
    expect(validateAmount(10)).toBe(true);
  });
});

describe('validateScheduleRange', () => {
  it('is always valid for a one-time entry, regardless of the month values', () => {
    expect(validateScheduleRange(true, 10, 5)).toBe(true);
  });

  it('is valid when startMonth is before or equal to endMonth', () => {
    expect(validateScheduleRange(false, 3, 12)).toBe(true);
    expect(validateScheduleRange(false, 5, 5)).toBe(true);
  });

  it('is invalid when startMonth is after endMonth for a recurring entry', () => {
    expect(validateScheduleRange(false, 12, 3)).toBe(false);
  });
});

describe('hasDuplicateOneTimeMonth', () => {
  it('detects a one-time entry already scheduled for the same month', () => {
    const items = [{ recurrence: 'none', startMonth: 5 }];
    expect(hasDuplicateOneTimeMonth(items, 5)).toBe(true);
  });

  it('ignores recurring entries when checking for a duplicate', () => {
    const items = [{ recurrence: 'monthly', startMonth: 5, endMonth: 360 }];
    expect(hasDuplicateOneTimeMonth(items, 5)).toBe(false);
  });

  it('returns false when no entry matches the month', () => {
    const items = [{ recurrence: 'none', startMonth: 5 }];
    expect(hasDuplicateOneTimeMonth(items, 6)).toBe(false);
  });
});
