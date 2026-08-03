import { describe, it, expect } from 'vitest';
import { isMonthInRange } from './dateRange';

describe('isMonthInRange', () => {
  it('is always active when both bounds are null', () => {
    expect(isMonthInRange(1, null, null)).toBe(true);
    expect(isMonthInRange(999, null, null)).toBe(true);
  });

  it('is always active when both bounds are undefined', () => {
    expect(isMonthInRange(1, undefined, undefined)).toBe(true);
  });

  it('is active from startMonth onward, indefinitely, when there is no end bound', () => {
    expect(isMonthInRange(4, 5, null)).toBe(false);
    expect(isMonthInRange(5, 5, null)).toBe(true);
    expect(isMonthInRange(1000, 5, null)).toBe(true);
  });

  it('is active up to endMonth, with no defined start, when there is no start bound', () => {
    expect(isMonthInRange(1, null, 10)).toBe(true);
    expect(isMonthInRange(10, null, 10)).toBe(true);
    expect(isMonthInRange(11, null, 10)).toBe(false);
  });

  it('is active on the inclusive start and end boundaries', () => {
    expect(isMonthInRange(5, 5, 10)).toBe(true);
    expect(isMonthInRange(10, 5, 10)).toBe(true);
  });

  it('is active strictly inside the range', () => {
    expect(isMonthInRange(7, 5, 10)).toBe(true);
  });

  it('is inactive before the start or after the end', () => {
    expect(isMonthInRange(4, 5, 10)).toBe(false);
    expect(isMonthInRange(11, 5, 10)).toBe(false);
  });
});
