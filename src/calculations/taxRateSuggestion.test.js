import { describe, it, expect } from 'vitest';
import { sumGrossAnnualIncome, getSuggestedTaxRate, getMarginalRentalTaxRate } from './taxRateSuggestion';
import { calculateEffectiveTaxRate, AU_TAX_BRACKETS, calculateMarginalMedicareLevyRate } from './auTaxBrackets';
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

const houseRent = (over = {}) => ({
  id: 2, name: 'House Rent', amount: 600, startMonth: 1,
  recurrence: 'monthly', endMonth: MAX_MONTH, isGross: true, ...over,
});

describe('getMarginalRentalTaxRate', () => {
  it('returns null when there is no rental income at all', () => {
    expect(getMarginalRentalTaxRate([forever()])).toBeNull();
  });

  it('returns null when rental income exists but is not Gross-marked', () => {
    // Even with Gross salary present, the null case fires on RENTAL's own
    // Gross flag, not salary's.
    expect(getMarginalRentalTaxRate([forever(), houseRent({ isGross: false })])).toBeNull();
  });

  it('lands the combined total in the correct bracket, marginal rate = bracket rate + Medicare', () => {
    // $1,614/wk salary = $83,928/yr; $600/wk rent = $31,200/yr; combined
    // $115,128 falls in the 30% bracket, well above the Medicare shade-in band.
    const result = getMarginalRentalTaxRate([forever(), houseRent()]);
    expect(result.nonRentalGrossAnnual).toBeCloseTo(83928, 5);
    expect(result.rentalGrossAnnual).toBeCloseTo(31200, 5);
    expect(result.totalGrossAnnual).toBeCloseTo(115128, 5);

    const bracket = AU_TAX_BRACKETS.find((b) => result.totalGrossAnnual <= b.max);
    const expectedRate = (bracket.rate + calculateMarginalMedicareLevyRate(result.totalGrossAnnual)) * 100;
    expect(result.marginalRatePct).toBeCloseTo(expectedRate, 10);
    expect(result.marginalRatePct).toBeCloseTo(32, 5);
  });

  // Confirms the "stack on everything else Gross" base doesn't wrongly pull in
  // net-entered income - a known undercount (real bracket placement depends on
  // net-entered salary too, which isn't recoverable), the same documented
  // limitation sumGrossAnnualIncome already carries for the average case.
  it('excludes net (non-Gross) salary from the base, finding the bracket on rental alone', () => {
    const result = getMarginalRentalTaxRate([forever({ isGross: false }), houseRent()]);
    expect(result.nonRentalGrossAnnual).toBe(0);
    expect(result.totalGrossAnnual).toBeCloseTo(31200, 5);
  });

  // Proves calculateMarginalMedicareLevyRate is actually wired in, not a
  // hardcoded 2% - a low-income combined total lands inside the shade-in band.
  it('uses the 10% shade-in Medicare rate for a low combined total', () => {
    const lowSalary = forever({ amount: 400 }); // $20,800/yr
    const lowRent = houseRent({ amount: 200 }); // $10,400/yr -> combined $31,200
    const result = getMarginalRentalTaxRate([lowSalary, lowRent]);
    expect(result.totalGrossAnnual).toBeCloseTo(31200, 5);
    expect(calculateMarginalMedicareLevyRate(result.totalGrossAnnual)).toBeCloseTo(0.10, 5);
    // 15% bracket + 10% shade-in Medicare = 25%
    expect(result.marginalRatePct).toBeCloseTo(25, 5);
  });
});
