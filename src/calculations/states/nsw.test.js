import { describe, it, expect } from 'vitest';
import nsw, { calculateStandardStampDuty, calculateStampDuty, calculateForeignPurchaserSurcharge } from './nsw';
import { sumClosingCosts } from '../closingCosts';

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

  it('uses the NEXT tier one dollar above each bracket boundary, not the previous tier (off-by-one guard)', () => {
    expect(calculateStandardStampDuty(18001)).toBeCloseTo(225.015, 5);
    expect(calculateStandardStampDuty(38001)).toBeCloseTo(525.0175, 5);
    expect(calculateStandardStampDuty(103001)).toBeCloseTo(1662.035, 5);
    expect(calculateStandardStampDuty(387001)).toBeCloseTo(11602.045, 5);
    expect(calculateStandardStampDuty(1290001)).toBeCloseTo(52237.055, 5);
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

  it('starts a small nonzero taper one dollar above the $800k exemption boundary, not a jump straight to 0', () => {
    const dutyAt1M = calculateStandardStampDuty(1000000);
    const expected = (dutyAt1M * (800001 - 800000)) / 200000;
    expect(calculateStampDuty(800001, true)).toBeCloseTo(expected, 5);
    expect(calculateStampDuty(800001, true)).toBeGreaterThan(0);
  });

  it('still uses the taper formula one dollar below the $1M concession cutoff, not standard duty', () => {
    // The taper formula is anchored to converge smoothly toward standard
    // duty as price approaches $1M, so the two are numerically close right
    // at this boundary - what distinguishes them is that this result must
    // match the taper computation exactly, at full precision.
    const dutyAt1M = calculateStandardStampDuty(1000000);
    const expected = (dutyAt1M * (999999 - 800000)) / 200000;
    expect(calculateStampDuty(999999, true)).toBeCloseTo(expected, 5);
    // Exactly at $1M, the concession cuts off entirely regardless of
    // isFirstHomeBuyer - confirms the >= 1000000 branch, not >, gates it.
    expect(calculateStampDuty(1000000, true)).toBeCloseTo(calculateStandardStampDuty(1000000), 5);
  });
});

describe('calculateForeignPurchaserSurcharge', () => {
  it('is 0 when not a foreign purchaser', () => {
    expect(calculateForeignPurchaserSurcharge(900000, false)).toBe(0);
  });

  it('charges 8% of the property price for a foreign purchaser', () => {
    expect(calculateForeignPurchaserSurcharge(900000, true)).toBeCloseTo(72000, 5);
  });

  it('handles $0 property price', () => {
    expect(calculateForeignPurchaserSurcharge(0, true)).toBe(0);
  });
});

describe('nsw state module shape (TODO-58)', () => {
  it('exposes the fields every state module must have', () => {
    expect(nsw.code).toBe('NSW');
    expect(nsw.label).toBe('New South Wales');
    expect(nsw.fhbSchemeName).toBe('First Home Buyer Assistance Scheme');
    expect(nsw.foreignPurchaserSurchargeRate).toBe(0.08);
    expect(nsw.calculateStampDuty).toBe(calculateStampDuty);
    expect(nsw.calculateForeignPurchaserSurcharge).toBe(calculateForeignPurchaserSurcharge);
  });

  it('defaultClosingCosts sums to the documented NSW average of roughly $4,750', () => {
    const total = sumClosingCosts(Object.values(nsw.defaultClosingCosts));
    expect(total).toBe(4750);
  });
});
