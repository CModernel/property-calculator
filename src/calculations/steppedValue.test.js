import { describe, it, expect } from 'vitest';
import { getSteppedValue } from './steppedValue';

describe('getSteppedValue', () => {
  it('returns the base value when there are no changes', () => {
    expect(getSteppedValue(200, [], 1)).toBe(200);
    expect(getSteppedValue(200, [], 100)).toBe(200);
  });

  it('returns the base value before the first change kicks in', () => {
    expect(getSteppedValue(200, [{ startMonth: 13, amount: 250 }], 12)).toBe(200);
  });

  it('applies the change starting exactly on its startMonth - open-ended, no end', () => {
    expect(getSteppedValue(200, [{ startMonth: 13, amount: 250 }], 13)).toBe(250);
    expect(getSteppedValue(200, [{ startMonth: 13, amount: 250 }], 300)).toBe(250);
  });

  it('picks the most recent applicable change, not the first in the array', () => {
    const changes = [
      { startMonth: 13, amount: 250 },
      { startMonth: 25, amount: 300 },
    ];
    expect(getSteppedValue(200, changes, 20)).toBe(250);
    expect(getSteppedValue(200, changes, 25)).toBe(300);
    expect(getSteppedValue(200, changes, 100)).toBe(300);
  });

  it('works regardless of array order', () => {
    const changes = [
      { startMonth: 25, amount: 300 },
      { startMonth: 13, amount: 250 },
    ];
    expect(getSteppedValue(200, changes, 20)).toBe(250);
    expect(getSteppedValue(200, changes, 25)).toBe(300);
  });

  it('when two changes share the same startMonth, the first one encountered in the array wins', () => {
    const changes = [
      { startMonth: 13, amount: 250 },
      { startMonth: 13, amount: 999 },
    ];
    expect(getSteppedValue(200, changes, 13)).toBe(250);
  });

  it('applies a change with startMonth 0 from the very first queried month', () => {
    expect(getSteppedValue(200, [{ startMonth: 0, amount: 999 }], 0)).toBe(999);
  });
});
