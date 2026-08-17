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
  calculateTotalPropertyCost, calculateMonthlyFromWeekly,
} from './loan';
import { getActiveAmount } from './recurringAmount';
import { RENTAL_INCOME_CATEGORIES } from './incomeCategories';
import { estimateLmi } from './lmi';
import { sumClosingCosts } from './closingCosts';
import { safePercentage } from './safePercentage';
import { getStateModule } from './states';
import { calculateTotalCashRequired, calculateLiquidSavings } from './totalCashRequired';
import {
  calculateEmergencyBufferMonths, classifyEmergencyBuffer,
  calculateHousingCostRatio, classifyHousingCostRatio,
  calculateStressTestSurvivedDelta, classifyStressTest,
  calculateUpfrontCostRatio, classifyUpfrontCostRatio,
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
  const weeklyRentalIncome = getActiveAmount(c.incomeSources.filter((i) => RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, c.effectiveTaxRate);
  const monthlyIncome = calculateMonthlyFromWeekly(weeklyIncome);
  const monthlyRentalIncome = calculateMonthlyFromWeekly(weeklyRentalIncome);

  const emergencyBufferMonths = calculateEmergencyBufferMonths(liquidSavings, totalPropertyCost + monthlyPersonalExpenses);
  const housingCostRatio = calculateHousingCostRatio(totalPropertyCost, monthlyIncome + monthlyRentalIncome);
  const stressTestSurvivedDelta = calculateStressTestSurvivedDelta({
    loanAmount, interestRate: c.interestRate, totalMonths, monthlyPropertyExpenses,
    monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses,
  });
  const upfrontCostRatio = calculateUpfrontCostRatio(totalCashRequired, c.downPayment, c.propertyPrice);

  return {
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
const MATRIX = [
  {
    name: 'baseline (config.default.json)',
    overrides: {},
    expect: { EB: [6.3, 'Good'], HCR: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'not a first home buyer - loses the stamp duty concession',
    overrides: { isFirstHomeBuyer: false },
    expect: { EB: [1.3, 'High risk'], HCR: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [4.4, 'High'] },
  },
  {
    name: 'a much more expensive property',
    overrides: { propertyPrice: 1200000 },
    expect: { EB: [-1.5, 'High risk'], HCR: [85, 'High risk'], ST: [0, 'High risk'], UCR: [4.4, 'High'] },
  },
  {
    name: 'more available savings',
    overrides: { totalSavings: 500000 },
    expect: { EB: [39.4, 'Excellent'], HCR: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a higher interest rate',
    overrides: { interestRate: 10 },
    expect: { EB: [4.8, 'Moderate'], HCR: [76, 'High risk'], ST: [2, 'Good'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a shorter loan term',
    overrides: { loanTermYears: 15 },
    expect: { EB: [4.9, 'Moderate'], HCR: [74, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a smaller deposit',
    overrides: { downPayment: 100000 },
    expect: { EB: [40.7, 'Excellent'], HCR: [73, 'High risk'], ST: [2, 'Good'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a smaller deposit with LMI paid upfront',
    overrides: { downPayment: 100000, payLmiUpfront: true },
    expect: { EB: [37.2, 'Excellent'], HCR: [73, 'High risk'], ST: [2, 'Good'], UCR: [4.1, 'High'] },
  },
  {
    name: 'a much higher salary',
    overrides: { incomeSources: salaryOnly(3000) },
    expect: { EB: [6.3, 'Good'], HCR: [30, 'Excellent'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a much lower salary',
    overrides: { incomeSources: salaryOnly(800) },
    expect: { EB: [6.3, 'Good'], HCR: [111, 'High risk'], ST: [0, 'High risk'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'higher personal expenses',
    overrides: { personalExpenseItems: groceriesOnly(1300) },
    expect: { EB: [5.5, 'Moderate'], HCR: [55, 'High risk'], ST: [3, 'Excellent'], UCR: [1.7, 'Excellent'] },
  },
  {
    name: 'a cheaper property with a smaller deposit',
    overrides: { propertyPrice: 400000, downPayment: 100000 },
    expect: { EB: [80.5, 'Excellent'], HCR: [34, 'Good'], ST: [3, 'Excellent'], UCR: [1.2, 'Excellent'] },
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

    it('effectiveTaxRate changes nothing when no income item is Gross-marked', () => {
      const at0 = runScenario({ effectiveTaxRate: 0 });
      const at20 = runScenario({ effectiveTaxRate: 20 });
      expect(at0).toEqual(at20);
    });
  });
});
