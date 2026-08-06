import { describe, it, expect } from 'vitest';
import { calculatePresentValueOfInterest } from './inflation';

describe('calculatePresentValueOfInterest', () => {
  it('discounts each month\'s interest individually at 1%/month (12% p.a.)', () => {
    const monthlyData = [
      { month: 1, monthlyInterestPaid: 100 },
      { month: 2, monthlyInterestPaid: 100 },
    ];
    // 100/1.01 + 100/1.01^2 ≈ 99.0099 + 98.0296 ≈ 197.0395
    expect(calculatePresentValueOfInterest(monthlyData, 12)).toBeCloseTo(197.0395, 3);
  });

  it('matches the nominal sum exactly at 0% inflation', () => {
    const monthlyData = [
      { month: 1, monthlyInterestPaid: 150 },
      { month: 2, monthlyInterestPaid: 140 },
      { month: 3, monthlyInterestPaid: 130 },
    ];
    expect(calculatePresentValueOfInterest(monthlyData, 0)).toBe(420);
  });

  it('is 0 for an empty monthlyData array (e.g. the sentinel "nothing to offset" result)', () => {
    expect(calculatePresentValueOfInterest([], 5)).toBe(0);
  });

  it('discounts later months more heavily than earlier ones', () => {
    const monthlyData = [
      { month: 1, monthlyInterestPaid: 100 },
      { month: 360, monthlyInterestPaid: 100 },
    ];
    const result = calculatePresentValueOfInterest(monthlyData, 5);
    // The month-360 dollar is worth far less today than the month-1 dollar.
    expect(result).toBeLessThan(200);
    expect(result).toBeGreaterThan(100);
  });
});
