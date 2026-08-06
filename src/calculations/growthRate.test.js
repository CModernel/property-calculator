import { describe, it, expect } from 'vitest';
import { calculateCompoundedValue } from './growthRate';

describe('calculateCompoundedValue', () => {
  it('compounds monthly at 1%/month (12% p.a.)', () => {
    expect(calculateCompoundedValue(100000, 12, 1)).toBeCloseTo(101000, 2);
    expect(calculateCompoundedValue(100000, 12, 2)).toBeCloseTo(102010, 2);
    expect(calculateCompoundedValue(100000, 12, 12)).toBeCloseTo(100000 * Math.pow(1.01, 12), 6);
  });

  it('stays flat at 0% growth, regardless of elapsed months', () => {
    expect(calculateCompoundedValue(850000, 0, 1)).toBe(850000);
    expect(calculateCompoundedValue(850000, 0, 360)).toBe(850000);
  });

  it('is exactly the base value at month 0', () => {
    expect(calculateCompoundedValue(850000, 5, 0)).toBe(850000);
  });

  it('shrinks the value under negative growth', () => {
    const result = calculateCompoundedValue(850000, -5, 12);
    expect(result).toBeLessThan(850000);
    expect(result).toBeGreaterThan(0);
  });
});
