import { describe, it, expect } from 'vitest';
import { getActiveAmount } from './recurringAmount';

describe('getActiveAmount', () => {
  it('returns 0 for an empty list', () => {
    expect(getActiveAmount([], 5)).toBe(0);
  });

  it('includes a one-time item only on its exact month', () => {
    const items = [{ type: 'one-time', month: 6, amount: 1000 }];
    expect(getActiveAmount(items, 5)).toBe(0);
    expect(getActiveAmount(items, 6)).toBe(1000);
    expect(getActiveAmount(items, 7)).toBe(0);
  });

  it('includes a "forever" recurring item every month, even far in the future', () => {
    const items = [{ type: 'recurring', recurrence: 'forever', amount: 500 }];
    expect(getActiveAmount(items, 1)).toBe(500);
    expect(getActiveAmount(items, 300)).toBe(500);
  });

  it('includes a "period" recurring item only within its inclusive range', () => {
    const items = [{ type: 'recurring', recurrence: 'period', startMonth: 10, endMonth: 20, amount: 200 }];
    expect(getActiveAmount(items, 9)).toBe(0);
    expect(getActiveAmount(items, 10)).toBe(200);
    expect(getActiveAmount(items, 20)).toBe(200);
    expect(getActiveAmount(items, 21)).toBe(0);
  });

  it('sums multiple simultaneously-active items', () => {
    const items = [
      { type: 'recurring', recurrence: 'forever', amount: 500 },
      { type: 'recurring', recurrence: 'period', startMonth: 1, endMonth: 12, amount: 100 },
      { type: 'one-time', month: 5, amount: 50 },
    ];
    expect(getActiveAmount(items, 5)).toBe(650);
    expect(getActiveAmount(items, 13)).toBe(500);
  });

  it('does not depend on item order', () => {
    const items = [
      { type: 'one-time', month: 3, amount: 10 },
      { type: 'recurring', recurrence: 'forever', amount: 20 },
    ];
    expect(getActiveAmount(items, 3)).toBe(30);
  });
});
