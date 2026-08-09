import { describe, it, expect } from 'vitest';
import { calculateOffsetTimingBenefit, calculateCardCashback } from './creditCardBenefit';

describe('calculateOffsetTimingBenefit', () => {
  it('reproduces the worked example: $1,030/month, 27 extra days, 6.13% p.a.', () => {
    // averageExtraOffsetBalance = 1030 * (27/30) = 927; 927 * 0.0613 ≈ 56.81
    expect(calculateOffsetTimingBenefit(1030, 27, 6.13)).toBeCloseTo(56.81, 1);
  });

  it('is 0 when no card spend is entered', () => {
    expect(calculateOffsetTimingBenefit(0, 27, 6.13)).toBe(0);
  });

  it('is 0 when the interest rate is 0', () => {
    expect(calculateOffsetTimingBenefit(1030, 27, 0)).toBe(0);
  });

  it('scales linearly with the average days held', () => {
    const at27 = calculateOffsetTimingBenefit(1000, 27, 6);
    const at54 = calculateOffsetTimingBenefit(1000, 54, 6);
    expect(at54).toBeCloseTo(at27 * 2, 5);
  });

  it('is 0 when avgExtraDaysHeld is 0 (no float at all)', () => {
    expect(calculateOffsetTimingBenefit(1030, 0, 6.13)).toBe(0);
  });

  it('scales linearly with monthly card spend too, not just days held', () => {
    const at1000 = calculateOffsetTimingBenefit(1000, 27, 6);
    const at2000 = calculateOffsetTimingBenefit(2000, 27, 6);
    expect(at2000).toBeCloseTo(at1000 * 2, 5);
  });
});

describe('calculateCardCashback', () => {
  it('reproduces the worked example: $1,030/month, 1% cashback, no fee', () => {
    // 1030 * 12 * 0.01 = 123.6
    expect(calculateCardCashback(1030, 1, 0)).toBeCloseTo(123.6, 1);
  });

  it('subtracts the annual card fee from the cashback', () => {
    expect(calculateCardCashback(1030, 1, 99)).toBeCloseTo(24.6, 1);
  });

  it('can go negative when the fee exceeds the cashback earned', () => {
    expect(calculateCardCashback(200, 0.5, 99)).toBeLessThan(0);
  });

  it('is just the negative fee when cashbackPct is 0', () => {
    expect(calculateCardCashback(1030, 0, 50)).toBe(-50);
  });
});
