import { describe, it, expect } from 'vitest';
import { withMonthlyPrincipal, getYearTickMonths } from './chartData';

describe('withMonthlyPrincipal', () => {
  it('returns an empty array unchanged', () => {
    expect(withMonthlyPrincipal([])).toEqual([]);
  });

  it('month 1 gets its own totalPrincipalPaid as the monthly figure (nothing paid before it)', () => {
    const result = withMonthlyPrincipal([{ month: 1, totalPrincipalPaid: 500 }]);
    expect(result[0].monthlyPrincipalPaid).toBe(500);
  });

  it('later months get the difference from the previous month\'s cumulative total', () => {
    const result = withMonthlyPrincipal([
      { month: 1, totalPrincipalPaid: 500 },
      { month: 2, totalPrincipalPaid: 1100 },
      { month: 3, totalPrincipalPaid: 1800 },
    ]);
    expect(result.map(r => r.monthlyPrincipalPaid)).toEqual([500, 600, 700]);
  });

  it('preserves every other field on each entry', () => {
    const result = withMonthlyPrincipal([{ month: 1, totalPrincipalPaid: 500, balance: 249500, offset: 0 }]);
    expect(result[0]).toMatchObject({ month: 1, balance: 249500, offset: 0 });
  });
});

describe('getYearTickMonths', () => {
  it('returns an empty array for zero or negative months', () => {
    expect(getYearTickMonths(0)).toEqual([]);
    expect(getYearTickMonths(-5)).toEqual([]);
  });

  it('returns every 12th month plus the final month, for an exact multiple of 12', () => {
    expect(getYearTickMonths(36)).toEqual([12, 24, 36]);
  });

  it('appends the final month when it falls short of the next year boundary', () => {
    expect(getYearTickMonths(128)).toEqual([12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 128]);
  });

  it('a loan paid off within its first year still gets a tick at the payoff month', () => {
    expect(getYearTickMonths(7)).toEqual([7]);
  });
});
