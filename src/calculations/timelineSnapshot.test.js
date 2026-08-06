import { describe, it, expect } from 'vitest';
import { getTimelineSnapshot, calculateEffectiveProgress, calculateTimeRemaining } from './timelineSnapshot';

describe('getTimelineSnapshot', () => {
  const monthlyData = [
    { month: 1, balance: 490000, offset: 1000, effectiveBalance: 489000, monthlyInterestPaid: 2500, totalInterestPaid: 2500, totalPrincipalPaid: 10000 },
    { month: 2, balance: 480000, offset: 2000, effectiveBalance: 478000, monthlyInterestPaid: 2450, totalInterestPaid: 4950, totalPrincipalPaid: 20000 },
  ];

  it('returns a synthetic "nothing has happened yet" snapshot at month 0', () => {
    const snapshot = getTimelineSnapshot(0, monthlyData, 500000, 2291.67);
    expect(snapshot).toEqual({
      balance: 500000,
      offset: 0,
      savings: 0,
      effectiveBalance: 500000,
      monthlyInterestPaid: 2292,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      propertyValue: 0,
    });
  });

  it('seeds the month-0 savings snapshot from initialSavingsBalance when given', () => {
    const snapshot = getTimelineSnapshot(0, monthlyData, 500000, 2291.67, 28453);
    expect(snapshot.savings).toBe(28453);
  });

  it('seeds the month-0 propertyValue snapshot from initialPropertyValue when given (TODO-89)', () => {
    const snapshot = getTimelineSnapshot(0, monthlyData, 500000, 2291.67, 28453, 850000);
    expect(snapshot.propertyValue).toBe(850000);
  });

  it('finds the exact month in monthlyData', () => {
    expect(getTimelineSnapshot(1, monthlyData, 500000, 2291.67)).toBe(monthlyData[0]);
    expect(getTimelineSnapshot(2, monthlyData, 500000, 2291.67)).toBe(monthlyData[1]);
  });

  it('falls back to the last recorded month when past the end of the simulation', () => {
    expect(getTimelineSnapshot(99, monthlyData, 500000, 2291.67)).toBe(monthlyData[monthlyData.length - 1]);
  });
});

describe('calculateEffectiveProgress', () => {
  it('is 0% at the start (effectiveBalance equals loanAmount)', () => {
    expect(calculateEffectiveProgress(500000, 500000)).toBe(0);
  });

  it('is 50% when half the balance is paid off', () => {
    expect(calculateEffectiveProgress(500000, 250000)).toBe(50);
  });

  it('is 100% once fully paid off', () => {
    expect(calculateEffectiveProgress(500000, 0)).toBe(100);
  });

  it('is 100% when there is no loan at all (a 100% cash purchase)', () => {
    expect(calculateEffectiveProgress(0, 0)).toBe(100);
  });
});

describe('calculateTimeRemaining', () => {
  it('splits the remaining months into years and months', () => {
    expect(calculateTimeRemaining(147, 0)).toEqual({ years: 12, months: 3 });
    expect(calculateTimeRemaining(147, 75)).toEqual({ years: 6, months: 0 });
  });

  it('clamps to zero once past the end of the simulation, instead of going negative', () => {
    expect(calculateTimeRemaining(147, 200)).toEqual({ years: 0, months: 0 });
  });
});
