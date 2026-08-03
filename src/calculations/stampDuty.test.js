import { describe, it, expect } from 'vitest';
import { calculateStandardStampDuty, calculateStampDuty } from './stampDuty';

describe('calculateStandardStampDuty', () => {
  it('matches the reference example for a $900k purchase', () => {
    // 11,602 + (900,000 - 387,000) x 4.5% = 34,687
    expect(calculateStandardStampDuty(900000)).toBeCloseTo(34687, 5);
  });

  it('applies the first tier rate at the bottom of the scale', () => {
    expect(calculateStandardStampDuty(18000)).toBeCloseTo(225, 5);
  });

  it('applies the base + rate formula across tier boundaries', () => {
    expect(calculateStandardStampDuty(38000)).toBeCloseTo(525, 5);
    // The published $1,662 base for the next tier is itself rounded from the
    // $1,662.50 this tier's own formula produces at its upper boundary.
    expect(calculateStandardStampDuty(103000)).toBeCloseTo(1662.5, 5);
    expect(calculateStandardStampDuty(387000)).toBeCloseTo(11602, 5);
    expect(calculateStandardStampDuty(1290000)).toBeCloseTo(52237, 5);
  });

  it('applies the top tier rate above $1.29M', () => {
    expect(calculateStandardStampDuty(1500000)).toBeCloseTo(52237 + 210000 * 0.055, 5);
  });

  it('handles $0 property price', () => {
    expect(calculateStandardStampDuty(0)).toBe(0);
  });
});

describe('calculateStampDuty (First Home Buyer)', () => {
  it('is fully exempt at or below $800k', () => {
    expect(calculateStampDuty(800000, true)).toBe(0);
    expect(calculateStampDuty(500000, true)).toBe(0);
  });

  it('matches the three reference concessional values exactly', () => {
    // Anchored on standard duty at $1M ($39,187), interpolated linearly across
    // the $800k-$1M concession band.
    expect(calculateStampDuty(850000, true)).toBeCloseTo(9796.75, 2);
    expect(calculateStampDuty(900000, true)).toBeCloseTo(19593.5, 2);
    expect(calculateStampDuty(950000, true)).toBeCloseTo(29390.25, 2);
  });

  it('drops the concession entirely at $1M and above, charging standard duty', () => {
    expect(calculateStampDuty(1000000, true)).toBeCloseTo(calculateStandardStampDuty(1000000), 5);
    expect(calculateStampDuty(1200000, true)).toBeCloseTo(calculateStandardStampDuty(1200000), 5);
  });

  it('charges standard duty regardless of price when not a first home buyer', () => {
    expect(calculateStampDuty(900000, false)).toBeCloseTo(calculateStandardStampDuty(900000), 5);
    expect(calculateStampDuty(500000, false)).toBeCloseTo(calculateStandardStampDuty(500000), 5);
  });
});
