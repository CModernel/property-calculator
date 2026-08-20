import { describe, it, expect } from 'vitest';
import {
  findStabilizationMonth,
  resolveProjectedFinancials,
  worseOf,
  DEFAULT_STABILIZATION_MONTH,
} from './projectedHealthCheck';
import { calculateCompoundedValue } from './growthRate';
import { calculateVacancyFactor } from './vacancyFactor';
import { getGrossActiveAmount } from './grossIncome';
import { RENTAL_INCOME_CATEGORIES } from './incomeCategories';

// getActiveAmountWithGrowth's multiplier is `(1 + monthlyRate) ** month` -
// already one month of compounding at month 1, not a no-op (matches
// offsetSimulation.js's own loop, whose `months` counter is 1 on its first
// iteration). Precise expected values are derived with the same formula
// rather than hand-approximated, to avoid floating-point mismatches.
function growth(base, annualRate, month) {
  return calculateCompoundedValue(base, annualRate, month);
}

const NO_EXPENSE_FIELDS = {
  strataFees: { base: 0, changes: [] },
  utilities: { base: 200, changes: [] },
  councilRates: { base: 0, changes: [] },
  insurance: { base: 0, changes: [] },
  maintenance: { base: 0, changes: [] },
  waterRates: { base: 0, changes: [] },
  landTax: { base: 0, changes: [] },
  propertyManagement: { base: 0, changes: [] },
};

const BASE_SCHEDULES = {
  incomeSources: [],
  personalExpenseItems: [],
  expenseFields: NO_EXPENSE_FIELDS,
  interestRateField: null,
};

describe('findStabilizationMonth', () => {
  it('falls back to the year-5 default when nothing is scheduled', () => {
    expect(findStabilizationMonth(BASE_SCHEDULES)).toBe(DEFAULT_STABILIZATION_MONTH);
  });

  it('counts a recurring income source starting after month 1', () => {
    const month = findStabilizationMonth({
      ...BASE_SCHEDULES,
      incomeSources: [{ name: 'Salary/Wages', amount: 1000, startMonth: 24, recurrence: 'monthly', endMonth: 360 }],
    });
    expect(month).toBe(24);
  });

  it('counts a recurring item ending before MAX_MONTH (a tenant moving out)', () => {
    const month = findStabilizationMonth({
      ...BASE_SCHEDULES,
      incomeSources: [{ name: 'House Rent', amount: 500, startMonth: 1, recurrence: 'monthly', endMonth: 36 }],
    });
    expect(month).toBe(36);
  });

  it('excludes one-time items - a lump sum is a transient blip, not a new steady state', () => {
    const month = findStabilizationMonth({
      ...BASE_SCHEDULES,
      incomeSources: [{ name: 'Bonus', amount: 5000, startMonth: 48, recurrence: 'none' }],
    });
    expect(month).toBe(DEFAULT_STABILIZATION_MONTH);
  });

  it('ignores a recurring item whose own start is month 1 and whose end is the MAX_MONTH default - nothing about it changes', () => {
    const month = findStabilizationMonth({
      ...BASE_SCHEDULES,
      incomeSources: [{ name: 'Salary/Wages', amount: 1000, startMonth: 1, recurrence: 'monthly', endMonth: 360 }],
    });
    expect(month).toBe(DEFAULT_STABILIZATION_MONTH);
  });

  it('counts a scheduled property-expense-field change', () => {
    const month = findStabilizationMonth({
      ...BASE_SCHEDULES,
      expenseFields: { ...NO_EXPENSE_FIELDS, utilities: { base: 200, changes: [{ id: 1, amount: 250, startMonth: 18 }] } },
    });
    expect(month).toBe(18);
  });

  it('counts a scheduled interest-rate change', () => {
    const month = findStabilizationMonth({
      ...BASE_SCHEDULES,
      interestRateField: { base: 6, changes: [{ id: 1, amount: 6.5, startMonth: 12 }] },
    });
    expect(month).toBe(12);
  });

  it('takes the max across every mixed source', () => {
    const month = findStabilizationMonth({
      incomeSources: [{ name: 'Salary/Wages', amount: 1000, startMonth: 24, recurrence: 'monthly', endMonth: 360 }],
      personalExpenseItems: [{ name: 'Groceries', amount: 400, startMonth: 6, recurrence: 'monthly', endMonth: 360 }],
      expenseFields: { ...NO_EXPENSE_FIELDS, utilities: { base: 200, changes: [{ id: 1, amount: 250, startMonth: 18 }] } },
      interestRateField: { base: 6, changes: [{ id: 1, amount: 6.5, startMonth: 12 }] },
    });
    expect(month).toBe(24);
  });
});

const SNAPSHOT_PARAMS = {
  incomeSources: [
    { name: 'Salary/Wages', amount: 2000, startMonth: 1, recurrence: 'monthly', endMonth: 360, isGross: false },
    { name: 'House Rent', amount: 400, startMonth: 1, recurrence: 'monthly', endMonth: 360, isGross: false },
  ],
  personalExpenseItems: [{ name: 'Groceries', amount: 500, startMonth: 1, recurrence: 'monthly', endMonth: 360 }],
  expenseFields: NO_EXPENSE_FIELDS,
  interestRateField: null,
  effectiveTaxRate: 0,
  salaryGrowthRate: 3,
  rentGrowthRate: 5,
  expenseGrowthRate: 2,
  vacancyWeeksPerYear: 0,
  loanAmount: 500_000,
  monthlyPayment: 3000,
  interestRate: 6,
  totalMonths: 360,
};

describe('resolveProjectedFinancials', () => {
  // Renamed by TODO-150: the old title claimed this "matches the Day-1 figures",
  // which is only true when every growth rate is 0 - SNAPSHOT_PARAMS sets 3%/5%,
  // so month 1 here is deliberately ONE month of compounding ahead of App.jsx's
  // Day-1 snapshot, which applies none. The genuine Day-1 equivalence property
  // is pinned separately below.
  it('resolves month 1 with that month\'s own compounding already applied', () => {
    const result = resolveProjectedFinancials(1, SNAPSHOT_PARAMS);
    expect(result.monthlyIncome).toBeCloseTo(growth(2000, 3, 1) * 52 / 12, 5);
    expect(result.monthlyRentalIncome).toBeCloseTo(growth(400, 5, 1) * 52 / 12, 5);
    expect(result.monthlyPersonalExpenses).toBeCloseTo(500 * calculateCompoundedValue(1, 2, 1), 5);
    expect(result.monthlyPropertyExpenses).toBeCloseTo(200 * calculateCompoundedValue(1, 2, 1), 5);
  });

  it('compounds salary and rental growth independently at their own rates', () => {
    const month13 = resolveProjectedFinancials(13, SNAPSHOT_PARAMS);
    expect(month13.monthlyIncome).toBeCloseTo(growth(2000, 3, 13) * 52 / 12, 5);
    expect(month13.monthlyRentalIncome).toBeCloseTo(growth(400, 5, 13) * 52 / 12, 5);
  });

  it('applies vacancy only to rental income, never to salary', () => {
    const withVacancy = resolveProjectedFinancials(1, { ...SNAPSHOT_PARAMS, vacancyWeeksPerYear: 4 });
    const withoutVacancy = resolveProjectedFinancials(1, SNAPSHOT_PARAMS);
    expect(withVacancy.monthlyRentalIncome).toBeCloseTo(withoutVacancy.monthlyRentalIncome * (1 - 4 / 52), 5);
    expect(withVacancy.monthlyIncome).toBeCloseTo(withoutVacancy.monthlyIncome, 5);
  });

  // TODO-150's actual regression test, and deliberately an INVARIANT rather
  // than a pinned pair: with growth switched off, month 1 here must reproduce
  // App.jsx's Day-1 snapshot exactly, at EVERY vacancy level. That is precisely
  // the property the bug violated - App.jsx applied no vacancy while this
  // module did, so the two resolved rental income by different definitions and
  // the Day1 -> Stabilized arrow partly measured that gap instead of a change
  // over time. Growth is zeroed because the month-1 compounding offset above is
  // a separate, deliberate difference; leaving it in would mask this one.
  describe('Day-1 equivalence (TODO-150)', () => {
    const NO_GROWTH = { ...SNAPSHOT_PARAMS, salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0 };

    it.each([0, 2, 4, 52])('resolves rental income identically to App.jsx Day-1 at %i weeks vacancy', (weeks) => {
      const projected = resolveProjectedFinancials(1, { ...NO_GROWTH, vacancyWeeksPerYear: weeks });
      // App.jsx's own Day-1 expression, using the same shared helper it calls.
      const day1Weekly = 400 * calculateVacancyFactor(weeks);
      expect(projected.monthlyRentalIncome).toBeCloseTo(day1Weekly * 52 / 12, 5);
      expect(projected.monthlyIncome).toBeCloseTo(2000 * 52 / 12, 5);
    });

    // TODO-151 renamed this field from monthlyRentalIncomeBeforeVacancy: it is
    // now gross of tax as well as of vacancy, so "Gross" became the accurate
    // word (TODO-150 had avoided it precisely because the figure was still net
    // of tax back then).
    it('exposes the pre-vacancy rental figure for Rental Yield, unaffected by vacancy', () => {
      const gross = [0, 4, 52].map(
        (weeks) => resolveProjectedFinancials(1, { ...NO_GROWTH, vacancyWeeksPerYear: weeks }).monthlyRentalIncomeBeforeTaxAndVacancy
      );
      expect(gross[1]).toBeCloseTo(gross[0], 5);
      expect(gross[2]).toBeCloseTo(gross[0], 5);
      expect(gross[0]).toBeCloseTo(400 * 52 / 12, 5);
    });

    // Why the field exists at all instead of dividing the factor back out of
    // monthlyRentalIncome: at the slider's max the factor is exactly 0.
    it('still reports the pre-vacancy figure when the adjusted one is 0 at 52 weeks', () => {
      const neverRented = resolveProjectedFinancials(1, { ...NO_GROWTH, vacancyWeeksPerYear: 52 });
      expect(neverRented.monthlyRentalIncome).toBe(0);
      expect(neverRented.monthlyRentalIncomeBeforeTaxAndVacancy).toBeGreaterThan(0);
    });

    // TODO-151's before-tax fields, held to the same standard. Added on review
    // of PCALC-100, whose own tests compared against hand-derived constants like
    // `(2000 / 0.8) * 52 / 12` - that only proves the module is self-consistent.
    // Building the expectation from getGrossActiveAmount instead cross-checks
    // TWO partitions against each other: App.jsx splits income two ways
    // (rental vs not) while this module splits it three ways (salary / rental /
    // other), and those two partitions agreeing is the riskiest part of the
    // change. The salary+other buckets here must sum to App.jsx's non-rental one.
    it.each([0, 20, 45, 100])('resolves before-tax income identically to App.jsx Day-1 at a %i%% rate', (rate) => {
      const params = { ...NO_GROWTH, effectiveTaxRate: rate };
      const projected = resolveProjectedFinancials(1, params);

      const nonRental = params.incomeSources.filter((i) => !RENTAL_INCOME_CATEGORIES.includes(i.name));
      const rental = params.incomeSources.filter((i) => RENTAL_INCOME_CATEGORIES.includes(i.name));
      const day1NonRental = getGrossActiveAmount(nonRental, 1, rate);
      const day1Rental = getGrossActiveAmount(rental, 1, rate);

      expect(projected.monthlyIncomeBeforeTax).toBeCloseTo(day1NonRental * 52 / 12, 5);
      expect(projected.monthlyRentalIncomeBeforeTax).toBeCloseTo(day1Rental * calculateVacancyFactor(NO_GROWTH.vacancyWeeksPerYear) * 52 / 12, 5);
      expect(projected.monthlyRentalIncomeBeforeTaxAndVacancy).toBeCloseTo(day1Rental * 52 / 12, 5);
    });
  });

  // TODO-151: the pre-tax fields feeding Housing Cost Ratio and Rental Yield,
  // whose bands are both defined on gross income.
  describe('gross (pre-tax) fields (TODO-151)', () => {
    const GROSS_MARKED = {
      ...SNAPSHOT_PARAMS,
      salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0,
      incomeSources: [
        { name: 'Salary/Wages', amount: 2000, startMonth: 1, recurrence: 'monthly', endMonth: 360, isGross: true },
        { name: 'House Rent', amount: 400, startMonth: 1, recurrence: 'monthly', endMonth: 360, isGross: true },
      ],
    };

    it('equals the net fields exactly at a 0% tax rate', () => {
      const at0 = resolveProjectedFinancials(1, { ...SNAPSHOT_PARAMS, effectiveTaxRate: 0 });
      expect(at0.monthlyIncomeBeforeTax).toBeCloseTo(at0.monthlyIncome, 5);
      expect(at0.monthlyRentalIncomeBeforeTax).toBeCloseTo(at0.monthlyRentalIncome, 5);
    });

    it('grosses a net-entered salary up by the flat rate', () => {
      const at20 = resolveProjectedFinancials(1, {
        ...SNAPSHOT_PARAMS, salaryGrowthRate: 0, rentGrowthRate: 0, effectiveTaxRate: 20,
      });
      expect(at20.monthlyIncomeBeforeTax).toBeCloseTo((2000 / 0.8) * 52 / 12, 5);
      // The net field is untouched by the rate for a non-gross item - that's
      // the asymmetry TODO-151 exists to reconcile for the banded indicators.
      expect(at20.monthlyIncome).toBeCloseTo(2000 * 52 / 12, 5);
    });

    // For a Gross-marked item the stored amount already IS pre-tax, so the
    // gross field must report it unchanged while the net field deducts tax.
    it('reports a Gross-marked item at face value while the net field nets it down', () => {
      const at20 = resolveProjectedFinancials(1, { ...GROSS_MARKED, effectiveTaxRate: 20 });
      expect(at20.monthlyIncomeBeforeTax).toBeCloseTo(2000 * 52 / 12, 5);
      expect(at20.monthlyIncome).toBeCloseTo(2000 * 0.8 * 52 / 12, 5);
      expect(at20.monthlyRentalIncomeBeforeTaxAndVacancy).toBeCloseTo(400 * 52 / 12, 5);
    });

    // The whole point of the Rental Yield half: the yield must not move with
    // the tax rate, because its bands are the gross-yield benchmark.
    it('leaves the pre-vacancy gross rental figure unmoved by the tax rate', () => {
      const rates = [0, 20, 45].map(
        (rate) => resolveProjectedFinancials(1, { ...GROSS_MARKED, effectiveTaxRate: rate }).monthlyRentalIncomeBeforeTaxAndVacancy
      );
      expect(rates[1]).toBeCloseTo(rates[0], 5);
      expect(rates[2]).toBeCloseTo(rates[0], 5);
    });

    it('never grosses up a non-taxable category', () => {
      const withBenefits = resolveProjectedFinancials(1, {
        ...SNAPSHOT_PARAMS, salaryGrowthRate: 0, rentGrowthRate: 0, effectiveTaxRate: 20,
        incomeSources: [{ name: 'Government Benefits', amount: 500, startMonth: 1, recurrence: 'monthly', endMonth: 360 }],
      });
      expect(withBenefits.monthlyIncomeBeforeTax).toBeCloseTo(500 * 52 / 12, 5);
    });

    // Added on review of PCALC-100. The gross-up is a UNIFORM rescale of both
    // readings only when the income mix is the same in both months. Here a
    // non-grossable Gift is active on Day 1 but gone by the stabilization month,
    // so the grossable SHARE differs and the two readings scale by different
    // factors. That is correct behaviour, not a bug - but it means the Day1 ->
    // Stabilized arrow can move for a reason that has nothing to do with income
    // actually changing, which is the kind of thing that gets reported as one.
    it('scales the two readings by DIFFERENT factors when the income mix changes between them', () => {
      const mixed = {
        ...SNAPSHOT_PARAMS,
        salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0,
        effectiveTaxRate: 20,
        incomeSources: [
          { name: 'Salary/Wages', amount: 1000, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
          { name: 'Gift', amount: 1000, startMonth: 1, recurrence: 'monthly', endMonth: 12 },
        ],
      };
      const day1 = resolveProjectedFinancials(1, mixed);
      const stabilized = resolveProjectedFinancials(24, mixed);

      // Day 1: only the $1,000 salary is grossable, the Gift is not.
      expect(day1.monthlyIncome).toBeCloseTo(2000 * 52 / 12, 5);
      expect(day1.monthlyIncomeBeforeTax).toBeCloseTo((1000 / 0.8 + 1000) * 52 / 12, 5);
      // Month 24: the Gift has ended, so 100% of what remains is grossable.
      expect(stabilized.monthlyIncome).toBeCloseTo(1000 * 52 / 12, 5);
      expect(stabilized.monthlyIncomeBeforeTax).toBeCloseTo((1000 / 0.8) * 52 / 12, 5);

      const day1Factor = day1.monthlyIncomeBeforeTax / day1.monthlyIncome;
      const stabilizedFactor = stabilized.monthlyIncomeBeforeTax / stabilized.monthlyIncome;
      expect(stabilizedFactor).toBeGreaterThan(day1Factor);
    });
  });

  it('applies the same expense growth multiplier to both property and personal expenses', () => {
    const month13 = resolveProjectedFinancials(13, SNAPSHOT_PARAMS);
    const multiplier13 = calculateCompoundedValue(1, 2, 13);
    expect(month13.monthlyPersonalExpenses).toBeCloseTo(500 * multiplier13, 5);
    expect(month13.monthlyPropertyExpenses).toBeCloseTo(200 * multiplier13, 5);
  });

  it('leaves the payment/rate unchanged when no rate change is scheduled', () => {
    const result = resolveProjectedFinancials(60, SNAPSHOT_PARAMS);
    expect(result.monthlyPayment).toBe(SNAPSHOT_PARAMS.monthlyPayment);
    expect(result.interestRate).toBe(SNAPSHOT_PARAMS.interestRate);
  });

  it('re-amortizes on the ORIGINAL loan amount when a scheduled rate change applies by this month', () => {
    const params = {
      ...SNAPSHOT_PARAMS,
      interestRateField: { base: 6, changes: [{ id: 1, amount: 7, startMonth: 12 }] },
    };
    const before = resolveProjectedFinancials(6, params);
    const after = resolveProjectedFinancials(24, params);
    expect(before.interestRate).toBe(6);
    expect(after.interestRate).toBe(7);
    expect(after.monthlyPayment).not.toBe(SNAPSHOT_PARAMS.monthlyPayment);
    expect(after.monthlyPayment).toBeGreaterThan(before.monthlyPayment);
  });
});

describe('worseOf', () => {
  it('picks the lower value when higher is better', () => {
    expect(worseOf(5, 8, 'higherIsBetter')).toBe(5);
    expect(worseOf(8, 5, 'higherIsBetter')).toBe(5);
  });

  it('picks the higher value when higher is worse', () => {
    expect(worseOf(30, 45, 'higherIsWorse')).toBe(45);
    expect(worseOf(45, 30, 'higherIsWorse')).toBe(45);
  });
});
