import { describe, it, expect } from 'vitest';
import { sumGrossAnnualIncome, getSuggestedTaxRate } from './taxRateSuggestion';
import { calculateEffectiveTaxRate } from './auTaxBrackets';
import { MAX_MONTH } from './recurringAmount';

const forever = (over = {}) => ({
  id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1,
  recurrence: 'monthly', endMonth: MAX_MONTH, isGross: true, ...over,
});

describe('sumGrossAnnualIncome', () => {
  it('is 0 when no item is marked Gross - the shipped default scenario', () => {
    expect(sumGrossAnnualIncome([forever({ isGross: false })])).toBe(0);
    expect(sumGrossAnnualIncome([{ ...forever(), isGross: undefined }])).toBe(0);
    expect(sumGrossAnnualIncome([])).toBe(0);
  });

  it('annualises a recurring weekly gross salary', () => {
    // $1,614/week x 52 = $83,928
    expect(sumGrossAnnualIncome([forever()])).toBeCloseTo(83928, 5);
  });

  it('counts only the Gross-marked items in a mixed list', () => {
    const items = [forever(), forever({ id: 2, amount: 900, isGross: false })];
    expect(sumGrossAnnualIncome(items)).toBeCloseTo(83928, 5);
  });

  // The bug the sum-over-12-months design exists to prevent: a one-time item is
  // active in exactly one month, so `amount * 52` would inflate it 52x.
  it('counts a one-time gross bonus once, not 52 times', () => {
    const bonus = { id: 3, name: 'Bonus', amount: 5000, startMonth: 1, recurrence: 'none', isGross: true };
    const annual = sumGrossAnnualIncome([bonus]);
    expect(annual).toBeCloseTo(5000 * 52 / 12, 5);
    expect(annual).toBeLessThan(5000 * 52);
  });

  it('annualises a quarterly gross item to the same figure the simulation implies', () => {
    // Active in months 1, 4, 7, 10 - four occurrences, each contributing the
    // weekly amount converted to a month (x52/12), matching getActiveAmount +
    // calculateMonthlyFromWeekly everywhere else in the app.
    const quarterly = forever({ recurrence: 'quarterly', amount: 1200 });
    expect(sumGrossAnnualIncome([quarterly])).toBeCloseTo(4 * 1200 * 52 / 12, 5);
  });

  it('excludes an item whose schedule has not started within the first year', () => {
    expect(sumGrossAnnualIncome([forever({ startMonth: 25 })])).toBe(0);
  });

  it('counts only the months an item is actually active when it ends mid-year', () => {
    // Active months 1-6 of the twelve scanned.
    const endsAtSix = forever({ endMonth: 6 });
    expect(sumGrossAnnualIncome([endsAtSix])).toBeCloseTo(6 * 1614 * 52 / 12, 5);
  });

  // Rental income is taxable, so it belongs in the bracket lookup. Note this
  // deliberately does NOT net off property expenses, interest or depreciation -
  // negative gearing is modelled inside offsetSimulation.js, and subtracting it
  // here too would double-count. So the suggestion overstates tax for a geared
  // investor, which the UI copy states.
  it('includes gross-marked rental income alongside salary', () => {
    const items = [forever(), forever({ id: 4, name: 'House Rent', amount: 600 })];
    expect(sumGrossAnnualIncome(items)).toBeCloseTo((1614 + 600) * 52, 5);
  });
});

describe('getSuggestedTaxRate', () => {
  it('returns null when there is no gross-marked income, so the UI can say why', () => {
    expect(getSuggestedTaxRate([forever({ isGross: false })])).toBeNull();
    expect(getSuggestedTaxRate([])).toBeNull();
  });

  it('reports the annual income it used alongside the rate', () => {
    const result = getSuggestedTaxRate([forever()]);
    expect(result.annualGrossIncome).toBeCloseTo(83928, 5);
    expect(result.suggestedRatePct).toBeCloseTo(20.705, 2);
  });

  it('defers entirely to calculateEffectiveTaxRate for the rate itself', () => {
    const result = getSuggestedTaxRate([forever({ amount: 3000 })]);
    expect(result.suggestedRatePct).toBeCloseTo(calculateEffectiveTaxRate(3000 * 52), 10);
  });

  // A genuinely 0% rate is distinct from "nothing to suggest from" - both would
  // collapse together if this returned 0 instead of null in the empty case.
  it('returns a real 0% suggestion for income under the tax-free threshold', () => {
    const result = getSuggestedTaxRate([forever({ amount: 300 })]);
    expect(result).not.toBeNull();
    expect(result.suggestedRatePct).toBe(0);
  });
});
