// TODO-147: a fixture-driven regression test for the four Tier-1 Purchase
// Health Check indicators (Emergency Buffer, Housing Cost Ratio, Interest Rate
// Stress Test, Upfront Cost Ratio). Grew out of a user-requested audit
// (2026-08-17) that ran these same real modules by hand in a throwaway
// script - useful once, but it left nothing behind, so the next change to any
// of these four could move all of them silently. This file is that audit,
// made permanent.
//
// Deliberately does NOT render <App/> - it replicates App.jsx's own wiring in
// `run()` below, calling the real calculation modules directly, so it stays
// fast and isolated from DOM churn. No formula is re-derived here: every
// number comes from the same `loan.js`/`recurringAmount.js`/`lmi.js`/
// `closingCosts.js`/`states/`/`totalCashRequired.js`/`purchaseHealthCheck.js`
// functions App.jsx itself calls - this file would fail to catch a bug that
// was baked into one of those functions identically on both sides, but that
// is true of any test that reuses the code under test's own building blocks,
// and re-deriving the formulas here would stop this being a check on the code
// at all (see the TODO's own instruction not to).
import { describe, it, expect } from 'vitest';
import {
  calculateLoanAmount, calculateMonthlyRate, calculateMonthlyPayment,
  calculateMonthlyStrata, calculateMonthlyCouncil, calculateMonthlyWaterRates,
  calculateMonthlyLandTax, calculateMonthlyPropertyExpenses,
  calculateTotalPropertyCost, calculateMonthlyFromWeekly, calculateMonthlyNetBalance,
} from './loan';
import { getActiveAmount } from './recurringAmount';
import { RENTAL_INCOME_CATEGORIES } from './incomeCategories';
import { estimateLmi } from './lmi';
import { sumClosingCosts } from './closingCosts';
import { safePercentage } from './safePercentage';
import { getStateModule } from './states';
import { calculateTotalCashRequired, calculateLiquidSavings } from './totalCashRequired';
import { calculateVacancyFactor } from './vacancyFactor';
import { getGrossActiveAmount } from './grossIncome';
import {
  calculateEmergencyBufferMonths, classifyEmergencyBuffer,
  calculateHousingCostRatio, classifyHousingCostRatio,
  calculateStressTestSurvivedDelta, classifyStressTest,
  calculateUpfrontCostRatio, classifyUpfrontCostRatio,
  calculateRentalYield, hasEnoughDataForRentalYield,
} from './purchaseHealthCheck';
import defaultConfig from '../../config.default.json';

// Mirrors App.jsx's own Day-1 wiring (App.jsx:~440-730) exactly, at the same
// month-1 snapshot every one of these four indicators reads.
function runScenario(overrides = {}) {
  const c = {
    ...defaultConfig,
    ...overrides,
    effectiveTaxRate: overrides.effectiveTaxRate ?? 20,
    payLmiUpfront: overrides.payLmiUpfront ?? false,
    // Same fallback chain App.jsx:395 uses (`config.vacancyWeeksPerYear ?? 2`).
    vacancyWeeksPerYear: overrides.vacancyWeeksPerYear ?? defaultConfig.vacancyWeeksPerYear ?? 2,
  };
  const stateModule = getStateModule(c.state);

  const loanAmount = calculateLoanAmount(c.propertyPrice, c.downPayment);
  const lvr = safePercentage(loanAmount, c.propertyPrice);
  const monthlyRate = calculateMonthlyRate(c.interestRate);
  const totalMonths = c.loanTermYears * 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyRate, totalMonths);

  const stampDuty = stateModule.calculateStampDuty(c.propertyPrice, c.isFirstHomeBuyer);
  const foreignPurchaserSurcharge = stateModule.calculateForeignPurchaserSurcharge(c.propertyPrice, c.isForeignPurchaser);
  const lmi = estimateLmi(loanAmount, lvr);
  const closingCostsSubtotal = sumClosingCosts([
    c.conveyancing, c.buildingInspection, c.pestInspection, c.registrationFees,
    c.searches, c.loanEstablishmentFee, c.propertyValuation, c.homeInsurance,
    c.rateAdjustments, c.miscUpfrontCost ?? 0,
  ]);
  const totalCashRequired = calculateTotalCashRequired({
    downPayment: c.downPayment, stampDuty, foreignPurchaserSurcharge,
    closingCostsSubtotal, lmi, payLmiUpfront: c.payLmiUpfront,
  });
  const liquidSavings = calculateLiquidSavings({ totalSavings: c.totalSavings, totalCashRequired });

  // A house has no strata regardless of what's stored, same as App.jsx.
  const strataFees = c.propertyType === 'house' ? 0 : c.strataFees;
  const monthlyPropertyExpenses = calculateMonthlyPropertyExpenses({
    monthlyStrata: calculateMonthlyStrata(strataFees),
    utilities: c.utilities,
    monthlyCouncil: calculateMonthlyCouncil(c.councilRates),
    insurance: c.insurance,
    maintenance: c.maintenance,
    monthlyWaterRates: calculateMonthlyWaterRates(c.waterRates),
    monthlyLandTax: calculateMonthlyLandTax(c.isInvestmentProperty ? c.landTax : 0),
    propertyManagement: c.isInvestmentProperty ? c.propertyManagement : 0,
    miscPropertyExpense: c.miscPropertyExpense ?? 0,
  });
  const totalPropertyCost = calculateTotalPropertyCost(monthlyPayment, monthlyPropertyExpenses);

  const monthlyPersonalExpenses = getActiveAmount(c.personalExpenseItems, 1);
  const weeklyIncome = getActiveAmount(c.incomeSources.filter((i) => !RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, c.effectiveTaxRate);
  // TODO-150: mirrors App.jsx's vacancy haircut. config.default.json has no
  // vacancyWeeksPerYear key at all - App.jsx supplies the default itself - so
  // this must fall back the same way or the factor is NaN and every row in the
  // MATRIX fails, rental income or not.
  const weeklyRentalIncomeBeforeVacancy = getActiveAmount(c.incomeSources.filter((i) => RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, c.effectiveTaxRate);
  const weeklyRentalIncome = weeklyRentalIncomeBeforeVacancy * calculateVacancyFactor(c.vacancyWeeksPerYear);
  const monthlyIncome = calculateMonthlyFromWeekly(weeklyIncome);
  const monthlyRentalIncome = calculateMonthlyFromWeekly(weeklyRentalIncome);
  // TODO-151: mirrors App.jsx's before-tax figures, used ONLY by Housing Cost
  // Ratio and Rental Yield. Must stay expression-for-expression identical to
  // App.jsx or the MATRIX silently pins something the app doesn't do.
  const weeklyIncomeBeforeTax = getGrossActiveAmount(c.incomeSources.filter((i) => !RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, c.effectiveTaxRate);
  const weeklyRentalIncomeBeforeTaxAndVacancy = getGrossActiveAmount(c.incomeSources.filter((i) => RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, c.effectiveTaxRate);
  const monthlyIncomeBeforeTax = calculateMonthlyFromWeekly(weeklyIncomeBeforeTax);
  const monthlyRentalIncomeBeforeTax = calculateMonthlyFromWeekly(weeklyRentalIncomeBeforeTaxAndVacancy * calculateVacancyFactor(c.vacancyWeeksPerYear));

  const emergencyBufferMonths = calculateEmergencyBufferMonths(liquidSavings, totalPropertyCost + monthlyPersonalExpenses);
  const housingCostRatio = calculateHousingCostRatio(totalPropertyCost, monthlyIncomeBeforeTax + monthlyRentalIncomeBeforeTax);
  const stressTestSurvivedDelta = calculateStressTestSurvivedDelta({
    loanAmount, interestRate: c.interestRate, totalMonths, monthlyPropertyExpenses,
    monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses,
  });
  const upfrontCostRatio = calculateUpfrontCostRatio(totalCashRequired, c.downPayment, c.propertyPrice);

  return {
    // TODO-150: exposed so the investment-property block below can assert on the
    // vacancy haircut and on Rental Yield's deliberate exemption from it.
    monthlyRentalIncome,
    gearingCashflow: monthlyRentalIncome - monthlyPayment - monthlyPropertyExpenses,
    // TODO-151: the symptom that opened the TODO was a red indicator sitting
    // next to a healthy surplus, so the surplus has to be assertable here.
    // Uses the real helper rather than re-deriving the formula.
    monthlyNetBalance: calculateMonthlyNetBalance(monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses, totalPropertyCost),
    rentalYield: calculateRentalYield(weeklyRentalIncomeBeforeTaxAndVacancy, c.propertyPrice),
    rentalYieldHasData: hasEnoughDataForRentalYield(weeklyRentalIncomeBeforeVacancy),
    emergencyBufferMonths, emergencyBufferClass: classifyEmergencyBuffer(emergencyBufferMonths),
    housingCostRatio, housingCostRatioClass: classifyHousingCostRatio(housingCostRatio),
    stressTestSurvivedDelta, stressTestClass: classifyStressTest(stressTestSurvivedDelta),
    upfrontCostRatio, upfrontCostRatioClass: classifyUpfrontCostRatio(upfrontCostRatio),
  };
}

const salaryOnly = (weeklyAmount) => ([
  { id: 1, name: 'Salary/Wages', amount: weeklyAmount, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
]);
const groceriesOnly = (monthlyAmount) => ([
  { id: 1, name: 'Groceries', amount: monthlyAmount, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
]);

// Pinned 2026-08-17 from a real audit of the shipped app, re-verified against
// current code before writing this file. A future change to any of these four
// indicators (or anything they depend on) must update a row here on purpose -
// that's the entire point of this test existing.
//
// TODO-151 re-pinned every HCR value: the denominator became before-tax income,
// so at runScenario's 20% default each one is the old value x 0.8 (every
// scenario here is salary-only and net-entered, so the whole denominator is
// grossed up uniformly). `HCR0` carries the ORIGINAL audit figure, asserted by
// the rate-0 block below - keeping the 2026-08-17 numbers alive as an exact
// no-op guard instead of deleting them.
//
// Watch the rounding: the pinned integer is Math.round(ratio) while the label
// comes from the UNROUNDED value. The old `HCR: [30, 'Excellent']` row was the
// standing proof - 30 would classify as 'Good', and it read 'Excellent' only
// because the true value was 29.566. Never derive a label from the integer.
const MATRIX = [
  {
    name: 'baseline (config.default.json)',
    overrides: {},
    expect: { EB: [6.3, 'Good'], HCR: [44, 'Caution'], HCR0: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'not a first home buyer - loses the stamp duty concession',
    overrides: { isFirstHomeBuyer: false },
    expect: { EB: [1.3, 'High risk'], HCR: [44, 'Caution'], HCR0: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [4.4, 'High'] },
  },
  {
    name: 'a much more expensive property',
    overrides: { propertyPrice: 1200000 },
    expect: { EB: [-1.5, 'High risk'], HCR: [68, 'High risk'], HCR0: [85, 'High risk'], ST: [0, 'High risk'], UCR: [4.4, 'High'] },
  },
  {
    name: 'more available savings',
    overrides: { totalSavings: 500000 },
    expect: { EB: [39.4, 'Excellent'], HCR: [44, 'Caution'], HCR0: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a higher interest rate',
    overrides: { interestRate: 10 },
    expect: { EB: [4.8, 'Moderate'], HCR: [61, 'High risk'], HCR0: [76, 'High risk'], ST: [2, 'Good'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a shorter loan term',
    overrides: { loanTermYears: 15 },
    expect: { EB: [4.9, 'Moderate'], HCR: [59, 'High risk'], HCR0: [74, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a smaller deposit',
    overrides: { downPayment: 100000 },
    expect: { EB: [40.7, 'Excellent'], HCR: [58, 'High risk'], HCR0: [73, 'High risk'], ST: [2, 'Good'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a smaller deposit with LMI paid upfront',
    overrides: { downPayment: 100000, payLmiUpfront: true },
    expect: { EB: [37.2, 'Excellent'], HCR: [58, 'High risk'], HCR0: [73, 'High risk'], ST: [2, 'Good'], UCR: [4.1, 'High'] },
  },
  {
    name: 'a much higher salary',
    overrides: { incomeSources: salaryOnly(3000) },
    expect: { EB: [6.3, 'Good'], HCR: [24, 'Excellent'], HCR0: [30, 'Excellent'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a much lower salary',
    overrides: { incomeSources: salaryOnly(800) },
    expect: { EB: [6.3, 'Good'], HCR: [89, 'High risk'], HCR0: [111, 'High risk'], ST: [0, 'High risk'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'higher personal expenses',
    overrides: { personalExpenseItems: groceriesOnly(1300) },
    expect: { EB: [5.5, 'Moderate'], HCR: [44, 'Caution'], HCR0: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a cheaper property with a smaller deposit',
    overrides: { propertyPrice: 400000, downPayment: 100000 },
    expect: { EB: [80.5, 'Excellent'], HCR: [27, 'Excellent'], HCR0: [34, 'Good'], ST: [3, 'Excellent'], UCR: [1.2, 'Excellent'] },
  },
];

describe('Purchase Health Check Tier-1 indicators - scenario matrix (TODO-147)', () => {
  it.each(MATRIX)('$name', ({ overrides, expect: exp }) => {
    const result = runScenario(overrides);

    expect(result.emergencyBufferMonths).toBeCloseTo(exp.EB[0], 1);
    expect(result.emergencyBufferClass.label).toBe(exp.EB[1]);

    expect(Math.round(result.housingCostRatio)).toBe(exp.HCR[0]);
    expect(result.housingCostRatioClass.label).toBe(exp.HCR[1]);

    expect(result.stressTestSurvivedDelta).toBe(exp.ST[0]);
    expect(result.stressTestClass.label).toBe(exp.ST[1]);

    expect(result.upfrontCostRatio).toBeCloseTo(exp.UCR[0], 1);
    expect(result.upfrontCostRatioClass.label).toBe(exp.UCR[1]);
  });

  // TODO-151: at a 0% rate the before-tax reconstruction is a no-op, so every
  // row must reproduce the ORIGINAL 2026-08-17 audit figure exactly. This is
  // the whole-matrix version of grossIncome.test.js's bitwise no-op test, and
  // it's what makes the tax-rate default the only thing that moved.
  it.each(MATRIX)('$name - unchanged from the original audit at a 0% tax rate', ({ overrides, expect: exp }) => {
    const result = runScenario({ ...overrides, effectiveTaxRate: 0 });
    expect(Math.round(result.housingCostRatio)).toBe(exp.HCR0[0]);
    expect(result.housingCostRatioClass.label).toBe(exp.HCR0[1]);
  });

  // Two properties worth pinning explicitly because they surprise people and
  // are correct, per the TODO's own note - a regression here would be easy to
  // mistake for "fixing" a bug that isn't one.
  describe('surprising-but-correct properties', () => {
    it('Emergency Buffer is completely income-independent', () => {
      const low = runScenario({ incomeSources: salaryOnly(800) });
      const high = runScenario({ incomeSources: salaryOnly(3000) });
      expect(low.emergencyBufferMonths).toBe(high.emergencyBufferMonths);
      expect(low.emergencyBufferMonths).toBeCloseTo(6.3, 1);
    });

    // TODO-151 narrowed this rather than deleting it. It used to assert the
    // WHOLE result object was identical at 0% vs 20% - the exact property
    // grossing up the Housing Cost Ratio denominator breaks, on purpose.
    // Omitting the two HCR keys (rather than allow-listing the others) keeps it
    // strong: any field added to runScenario later is covered automatically, so
    // this still pins that the change was surgical.
    const withoutHcr = (result) => {
      const rest = { ...result };
      delete rest.housingCostRatio;
      delete rest.housingCostRatioClass;
      return rest;
    };

    it('effectiveTaxRate still changes nothing OUTSIDE Housing Cost Ratio when no income item is Gross-marked', () => {
      expect(withoutHcr(runScenario({ effectiveTaxRate: 0 }))).toEqual(withoutHcr(runScenario({ effectiveTaxRate: 20 })));
    });

    it('Housing Cost Ratio alone now moves with effectiveTaxRate (TODO-151)', () => {
      const at0 = runScenario({ effectiveTaxRate: 0 });
      const at20 = runScenario({ effectiveTaxRate: 20 });
      // A higher assumed rate implies a bigger gross salary behind the same
      // take-home, so the ratio improves. Counterintuitive next to the slider's
      // "higher = worse" colouring (TODO-139), which stays correct because it is
      // about cash flow - documented in App.jsx and in the slider's tooltip.
      expect(at20.housingCostRatio).toBeCloseTo(at0.housingCostRatio * 0.8, 10);
      expect(at0.housingCostRatioClass.label).toBe('High risk');
      expect(at20.housingCostRatioClass.label).toBe('Caution');
    });

    // The symptom that opened TODO-151: a red indicator sitting next to a
    // healthy surplus, out of the box. Not "now green" - 44% of gross on
    // housing is genuinely caution territory - but no longer a false alarm.
    it('no longer classifies the shipped default as High risk while it runs a surplus', () => {
      const result = runScenario();
      expect(result.monthlyNetBalance).toBeGreaterThan(0);
      expect(Math.round(result.housingCostRatio)).toBe(44);
      expect(result.housingCostRatioClass.label).not.toBe('High risk');
      expect(result.housingCostRatioClass.critical).toBe(false);
    });

    it('moves Housing Cost Ratio further at a high tax rate, monotonically', () => {
      const ratios = [0, 20, 45, 90].map((rate) => runScenario({ effectiveTaxRate: rate }).housingCostRatio);
      expect(ratios[1]).toBeLessThan(ratios[0]);
      expect(ratios[2]).toBeLessThan(ratios[1]);
      expect(ratios[3]).toBeLessThan(ratios[2]);
      expect(ratios.every(Number.isFinite)).toBe(true);
    });

    // Reachable only from a hand-edited or stale saved scenario (the slider
    // clamps to 90), and the failure it prevents is the one direction a risk
    // indicator must never fail in: an Infinite denominator would read 0% ->
    // "Excellent, plenty of headroom".
    it('falls back to the un-grossed ratio at a nonsensical 100% tax rate rather than reading Excellent', () => {
      const result = runScenario({ effectiveTaxRate: 100 });
      expect(Number.isFinite(result.housingCostRatio)).toBe(true);
      expect(Math.round(result.housingCostRatio)).toBe(55);
      expect(result.housingCostRatioClass.label).toBe('High risk');
    });

    // The locked decision, stated as a test: grossing up income nobody withheld
    // tax from would fabricate it, making the indicator read optimistically for
    // the users with the least margin. Same net income, different category ->
    // the non-withheld one must read WORSE (a smaller denominator).
    it.each(['Government Benefits', 'Child Support', 'Tax Refund', 'Gift', 'Pension', 'Dividends', 'Interest', 'Some side thing'])(
      'does not fabricate a gross figure for %s',
      (name) => {
        const asSalary = runScenario({ incomeSources: salaryOnly(1614) });
        const asOther = runScenario({
          incomeSources: [{ id: 1, name, amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 }],
        });
        expect(asOther.housingCostRatio).toBeGreaterThan(asSalary.housingCostRatio);
        expect(Math.round(asOther.housingCostRatio)).toBe(55);
      }
    );

    // Exercises the isGross branch end-to-end: a Gross-marked $2,017.50 and a
    // net-entered $1,614 are the same person at a 20% rate, so both must give
    // the same before-tax denominator - i.e. the same Housing Cost Ratio.
    it('agrees between a Gross-marked salary and the equivalent net-entered one', () => {
      const asNet = runScenario({ incomeSources: salaryOnly(1614) });
      const asGross = runScenario({
        incomeSources: [{ id: 1, name: 'Salary/Wages', amount: 1614 / 0.8, startMonth: 1, recurrence: 'monthly', endMonth: 360, isGross: true }],
      });
      expect(asGross.housingCostRatio).toBeCloseTo(asNet.housingCostRatio, 10);
    });
  });

  // TODO-150: the MATRIX above deliberately has no rental/investment row (every
  // scenario is salary-only), so this whole code path had no coverage at all -
  // which is how the Day-1 figure could disagree with both the engine and the
  // Stabilized reading unnoticed. Kept as its own block rather than as MATRIX
  // rows because it.each asserts all four of EB/HCR/ST/UCR unconditionally, and
  // these cases are about different indicators.
  describe('investment-property indicators and the vacancy haircut (TODO-150)', () => {
    const investmentWithRent = (vacancyWeeksPerYear) => runScenario({
      isInvestmentProperty: true,
      vacancyWeeksPerYear,
      incomeSources: [
        { id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
        { id: 2, name: 'House Rent', amount: 600, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
      ],
    });

    it('haircuts Day-1 rental income by exactly the vacancy factor', () => {
      const none = investmentWithRent(0);
      const fourWeeks = investmentWithRent(4);
      expect(fourWeeks.monthlyRentalIncome).toBeCloseTo(none.monthlyRentalIncome * (1 - 4 / 52), 6);
    });

    it('a vacancy assumption makes Housing Cost Ratio worse and Gearing weaker', () => {
      const none = investmentWithRent(0);
      const fourWeeks = investmentWithRent(4);
      expect(fourWeeks.housingCostRatio).toBeGreaterThan(none.housingCostRatio);
      expect(fourWeeks.gearingCashflow).toBeLessThan(none.gearingCashflow);
    });

    // The locked decision, stated as a test: Rental Yield is quoted gross of
    // vacancy on purpose, because its 3%/5% bands are the gross benchmark.
    // Without this, "helpfully" netting the yield later would look like a
    // consistency improvement rather than a redefinition of the bands.
    it('leaves Rental Yield untouched at every vacancy level', () => {
      const yields = [0, 4, 52].map((weeks) => investmentWithRent(weeks).rentalYield);
      expect(yields[1]).toBe(yields[0]);
      expect(yields[2]).toBe(yields[0]);
      expect(yields[0]).toBeCloseTo((600 * 52) / 850000 * 100, 6);
    });

    // The slider's max. The adjusted figure is exactly 0 here, so anything that
    // asks "did the user enter a rent?" must read the pre-vacancy figure or it
    // silently reports missing data for a property that plainly has a tenant.
    it('still reports rental data present at 52 weeks vacancy, even though income is 0', () => {
      const neverRented = investmentWithRent(52);
      expect(neverRented.monthlyRentalIncome).toBe(0);
      expect(neverRented.rentalYieldHasData).toBe(true);
    });

    // TODO-151 closed the other half of the same defect: TODO-150 made Rental
    // Yield gross of VACANCY but it was still net of tax for a Gross-marked
    // rental item, while its 3%/5% bands are the gross benchmark on both axes.
    describe('Rental Yield is gross of tax too (TODO-151)', () => {
      const withRent = (extra, rate) => runScenario({
        isInvestmentProperty: true,
        effectiveTaxRate: rate,
        incomeSources: [{ id: 1, name: 'House Rent', amount: 600, startMonth: 1, recurrence: 'monthly', endMonth: 360, ...extra }],
      });

      it('reports the declared rent for a Gross-marked item instead of netting it down', () => {
        const grossMarked = withRent({ isGross: true }, 20);
        // The rent the tenant actually pays - NOT 600 * 0.8.
        expect(grossMarked.rentalYield).toBeCloseTo((600 * 52) / 850000 * 100, 10);
      });

      it('does not move with the tax rate, on either entry style', () => {
        for (const extra of [{}, { isGross: true }]) {
          const rates = [0, 20, 45].map((rate) => withRent(extra, rate).rentalYield);
          expect(rates[1]).toBeCloseTo(rates[0], 10);
          expect(rates[2]).toBeCloseTo(rates[0], 10);
        }
      });

      // Rent has no withholding: the tenant pays 600 and the landlord receives
      // 600, so a net-entered rent must NOT be grossed up - that would invent
      // rent nobody paid, and rental yield is rent over price where rent is an
      // observable market figure.
      it('never grosses up a net-entered rent - there is no withholding to reverse', () => {
        expect(withRent({}, 45).rentalYield).toBeCloseTo((600 * 52) / 850000 * 100, 10);
      });
    });
  });
});
