import { describe, it, expect } from 'vitest';
import {
  AU_TAX_BRACKETS,
  calculateIncomeTax,
  calculateMedicareLevy,
  calculateEffectiveTaxRate,
  MEDICARE_LEVY_LOWER_THRESHOLD,
  MEDICARE_LEVY_UPPER_THRESHOLD,
} from './auTaxBrackets';

describe('calculateIncomeTax', () => {
  it('is nil up to the tax-free threshold', () => {
    expect(calculateIncomeTax(0)).toBe(0);
    expect(calculateIncomeTax(18200)).toBeCloseTo(0, 5);
  });

  it('returns 0 rather than a negative figure for a negative income', () => {
    expect(calculateIncomeTax(-5000)).toBe(0);
  });

  it('matches the published cumulative base at every bracket threshold', () => {
    // (45,000 - 18,200) x 15% = 4,020
    expect(calculateIncomeTax(45000)).toBeCloseTo(4020, 5);
    // 4,020 + (135,000 - 45,000) x 30% = 31,020
    expect(calculateIncomeTax(135000)).toBeCloseTo(31020, 5);
    // 31,020 + (190,000 - 135,000) x 37% = 51,370
    expect(calculateIncomeTax(190000)).toBeCloseTo(51370, 5);
  });

  it('applies the top marginal rate above $190,000', () => {
    // 51,370 + 60,000 x 45% = 78,370
    expect(calculateIncomeTax(250000)).toBeCloseTo(51370 + 60000 * 0.45, 5);
  });

  it('matches a worked mid-bracket example', () => {
    // The shipped default scenario's own salary: $1,614/wk x 52 = $83,928.
    // 4,020 + (83,928 - 45,000) x 30% = 15,698.40
    expect(calculateIncomeTax(83928)).toBeCloseTo(15698.4, 5);
  });

  it('uses the NEXT bracket one dollar above each threshold, not the previous one (off-by-one guard)', () => {
    expect(calculateIncomeTax(18201)).toBeCloseTo(0.15, 5);
    expect(calculateIncomeTax(45001)).toBeCloseTo(4020.3, 5);
    expect(calculateIncomeTax(135001)).toBeCloseTo(31020.37, 5);
    expect(calculateIncomeTax(190001)).toBeCloseTo(51370.45, 5);
  });

  it('has internally consistent bases - each equals the tax at the previous tier\'s ceiling', () => {
    // Guards a typo in the table itself: a wrong `base` would otherwise produce
    // a silent discontinuity at a threshold rather than an obvious failure.
    for (const bracket of AU_TAX_BRACKETS) {
      if (bracket.over === 0) continue;
      expect(calculateIncomeTax(bracket.over)).toBeCloseTo(bracket.base, 5);
    }
  });
});

describe('calculateMedicareLevy', () => {
  it('is nil at or below the lower threshold', () => {
    expect(calculateMedicareLevy(0)).toBe(0);
    expect(calculateMedicareLevy(MEDICARE_LEVY_LOWER_THRESHOLD)).toBe(0);
  });

  it('shades in at 10c per dollar between the thresholds', () => {
    expect(calculateMedicareLevy(30000)).toBeCloseTo((30000 - MEDICARE_LEVY_LOWER_THRESHOLD) * 0.10, 5);
  });

  // The shade-in exists to meet the full 2% exactly at the upper threshold, so
  // there's no jump in the levy as income crosses it.
  it('converges on the full 2% at the upper threshold', () => {
    const shaded = calculateMedicareLevy(MEDICARE_LEVY_UPPER_THRESHOLD);
    expect(shaded).toBeCloseTo(MEDICARE_LEVY_UPPER_THRESHOLD * 0.02, 0);
    expect(calculateMedicareLevy(MEDICARE_LEVY_UPPER_THRESHOLD + 1)).toBeCloseTo((MEDICARE_LEVY_UPPER_THRESHOLD + 1) * 0.02, 5);
  });

  it('is a flat 2% well above the upper threshold', () => {
    expect(calculateMedicareLevy(83928)).toBeCloseTo(1678.56, 5);
  });
});

describe('calculateEffectiveTaxRate', () => {
  it('is 0 for no income, rather than NaN from dividing by zero', () => {
    expect(calculateEffectiveTaxRate(0)).toBe(0);
    expect(calculateEffectiveTaxRate(-1000)).toBe(0);
  });

  // The number that justifies this whole feature: the shipped default's salary
  // lands within rounding distance of the shipped default 20% rate.
  it('suggests ~20.7% for the default scenario\'s own salary', () => {
    // (15,698.40 income tax + 1,678.56 Medicare) / 83,928 = 20.705%
    expect(calculateEffectiveTaxRate(83928)).toBeCloseTo(20.705, 2);
    expect(Math.round(calculateEffectiveTaxRate(83928))).toBe(21);
  });

  it('is 0% for income entirely inside the tax-free threshold', () => {
    expect(calculateEffectiveTaxRate(18000)).toBe(0);
  });

  it('rises with income but stays well below the top marginal rate', () => {
    const at250k = calculateEffectiveTaxRate(250000);
    expect(at250k).toBeGreaterThan(calculateEffectiveTaxRate(83928));
    // An average rate can never reach the 45% marginal rate, since every lower
    // slice is taxed less - a result at/above 45% would mean the average and
    // marginal rates had been confused.
    expect(at250k).toBeLessThan(45);
  });
});
