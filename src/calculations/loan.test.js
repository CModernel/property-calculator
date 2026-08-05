import { describe, it, expect } from 'vitest';
import {
  TOTAL_MONTHS,
  calculateLoanAmount,
  calculateMonthlyRate,
  calculateMonthlyPayment,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyWaterRates,
  calculateMonthlyLandTax,
  calculateMonthlyPropertyExpenses,
  calculateTotalPropertyCost,
  calculateInitialMonthlyInterest,
  calculateNoOffsetTotalInterest,
  calculateWeeklyPersonalExpenses,
  calculateMonthlyPersonalExpenses,
  calculateMonthlyFromWeekly,
  calculateMonthlyNetBalance,
  calculateWeeklyNetBalance,
  calculateFortnightlyNetBalance,
  calculateMonthlyToOffset,
  calculateWeeklyToOffset,
  calculateFortnightlyToOffset,
  calculateTotalScheduledOffset,
} from './loan';

// App.jsx defaults, used across several tests so expected values can be
// cross-checked against the live UI.
const DEFAULTS = {
  propertyPrice: 500000,
  downPayment: 250000,
  interestRate: 5.38,
  strataFees: 1000,
  utilities: 200,
  councilRates: 450,
  insurance: 80,
  foodExpenses: 100,
  transportExpenses: 50,
  phoneInternet: 7,
};

describe('calculateLoanAmount', () => {
  it('subtracts down payment from property price', () => {
    expect(calculateLoanAmount(DEFAULTS.propertyPrice, DEFAULTS.downPayment)).toBe(250000);
  });
});

describe('calculateMonthlyRate', () => {
  it('converts an annual percentage rate to a monthly decimal rate', () => {
    expect(calculateMonthlyRate(DEFAULTS.interestRate)).toBeCloseTo(0.0044833, 6);
  });
});

describe('calculateMonthlyPayment', () => {
  it('matches the standard annuity formula for the default loan', () => {
    const loanAmount = calculateLoanAmount(DEFAULTS.propertyPrice, DEFAULTS.downPayment);
    const monthlyRate = calculateMonthlyRate(DEFAULTS.interestRate);
    expect(calculateMonthlyPayment(loanAmount, monthlyRate, TOTAL_MONTHS)).toBeCloseTo(1400.71, 1);
  });

  it('returns 0 for a fully paid-off loan (loanAmount = 0)', () => {
    const monthlyRate = calculateMonthlyRate(DEFAULTS.interestRate);
    expect(calculateMonthlyPayment(0, monthlyRate, TOTAL_MONTHS)).toBe(0);
  });
});

describe('property expenses', () => {
  it('derives quarterly fees down to a monthly amount', () => {
    expect(calculateMonthlyStrata(DEFAULTS.strataFees)).toBe(250);
    expect(calculateMonthlyCouncil(DEFAULTS.councilRates)).toBe(112.5);
  });

  it('sums strata, utilities, council, insurance, maintenance, water rates, land tax and property management', () => {
    const monthlyStrata = calculateMonthlyStrata(DEFAULTS.strataFees);
    const monthlyCouncil = calculateMonthlyCouncil(DEFAULTS.councilRates);
    expect(
      calculateMonthlyPropertyExpenses({
        monthlyStrata,
        utilities: DEFAULTS.utilities,
        monthlyCouncil,
        insurance: DEFAULTS.insurance,
        maintenance: 0,
        monthlyWaterRates: 0,
        monthlyLandTax: 0,
        propertyManagement: 0,
      })
    ).toBe(642.5);
  });

  it('includes maintenance, water rates, land tax and property management when present', () => {
    expect(
      calculateMonthlyPropertyExpenses({
        monthlyStrata: 0,
        utilities: 0,
        monthlyCouncil: 0,
        insurance: 0,
        maintenance: 100,
        monthlyWaterRates: 50,
        monthlyLandTax: 200,
        propertyManagement: 150,
      })
    ).toBe(500);
  });
});

describe('calculateMonthlyWaterRates / calculateMonthlyLandTax', () => {
  it('converts quarterly water rates to a monthly figure', () => {
    expect(calculateMonthlyWaterRates(200)).toBe(50);
  });

  it('converts yearly land tax to a monthly figure', () => {
    expect(calculateMonthlyLandTax(2400)).toBe(200);
  });
});

describe('calculateTotalPropertyCost', () => {
  it('adds the mortgage payment and property expenses', () => {
    expect(calculateTotalPropertyCost(1400.71, 642.5)).toBeCloseTo(2043.21, 1);
  });
});

describe('calculateInitialMonthlyInterest', () => {
  it('computes initial monthly interest from the initial principal', () => {
    // 250000 loan minus a 20000 month-1 offset lump sum = 230000 principal.
    expect(calculateInitialMonthlyInterest(230000, 0.004483333333333333)).toBeCloseTo(1031.17, 1);
  });
});

describe('calculateNoOffsetTotalInterest', () => {
  it('computes the 30-year no-offset interest for the default loan', () => {
    const loanAmount = calculateLoanAmount(DEFAULTS.propertyPrice, DEFAULTS.downPayment);
    const monthlyRate = calculateMonthlyRate(DEFAULTS.interestRate);
    const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyRate, TOTAL_MONTHS);
    // Was hardcoded as 272000 in the UI, which was wrong by ~$18k and never
    // responded to changes in price / down payment / rate.
    expect(calculateNoOffsetTotalInterest(monthlyPayment, loanAmount, TOTAL_MONTHS)).toBeCloseTo(254255, 0);
  });

  it('scales with the loan amount', () => {
    const monthlyRate = calculateMonthlyRate(DEFAULTS.interestRate);
    const small = calculateNoOffsetTotalInterest(
      calculateMonthlyPayment(250000, monthlyRate), 250000
    );
    const big = calculateNoOffsetTotalInterest(
      calculateMonthlyPayment(600000, monthlyRate), 600000
    );
    expect(big).toBeGreaterThan(small);
  });

  it('scales with the interest rate', () => {
    const loanAmount = 250000;
    const cheap = calculateNoOffsetTotalInterest(
      calculateMonthlyPayment(loanAmount, calculateMonthlyRate(4)), loanAmount
    );
    const pricey = calculateNoOffsetTotalInterest(
      calculateMonthlyPayment(loanAmount, calculateMonthlyRate(8)), loanAmount
    );
    expect(pricey).toBeGreaterThan(cheap);
  });
});

describe('personal expenses and income', () => {
  it('sums weekly personal expenses (food + transport only, phoneInternet defaulting to 0)', () => {
    expect(
      calculateWeeklyPersonalExpenses(DEFAULTS.foodExpenses, DEFAULTS.transportExpenses)
    ).toBe(150);
  });

  it('includes phoneInternet in the sum when provided (TODO-64)', () => {
    expect(
      calculateWeeklyPersonalExpenses(DEFAULTS.foodExpenses, DEFAULTS.transportExpenses, DEFAULTS.phoneInternet)
    ).toBe(157);
  });

  it('converts weekly personal expenses to a monthly figure', () => {
    expect(calculateMonthlyPersonalExpenses(200)).toBeCloseTo(866.67, 1);
  });

  it('converts a weekly amount to a monthly figure', () => {
    expect(calculateMonthlyFromWeekly(1614)).toBeCloseTo(6994, 0);
  });
});

describe('net balance (PCALC-6 regression coverage)', () => {
  const monthlyIncome = 6994;
  const weeklyIncome = 1614;
  const monthlyRentalIncome = 1950;
  const weeklyRentalIncome = 450;
  const monthlyPersonalExpenses = 866.67;
  const weeklyPersonalExpenses = 200;
  const totalPropertyCost = 2043.55;

  it('includes rental income in the monthly net balance (PCALC-6 fix)', () => {
    const result = calculateMonthlyNetBalance(
      monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses, totalPropertyCost
    );
    const oldBuggyFormula = monthlyIncome - monthlyPersonalExpenses - totalPropertyCost;
    expect(result).not.toBeCloseTo(oldBuggyFormula, 2);
    expect(result).toBeCloseTo(monthlyIncome + monthlyRentalIncome - monthlyPersonalExpenses - totalPropertyCost, 2);
  });

  it('includes rental income in the weekly net balance, using the totalPropertyCost*12/52 conversion (PCALC-6 fix)', () => {
    const result = calculateWeeklyNetBalance(
      weeklyIncome, weeklyRentalIncome, weeklyPersonalExpenses, totalPropertyCost
    );
    const oldBuggyFormula = weeklyIncome - weeklyPersonalExpenses - (totalPropertyCost * 12 / 52);
    expect(result).not.toBeCloseTo(oldBuggyFormula, 2);
    expect(result).toBeCloseTo(
      weeklyIncome + weeklyRentalIncome - weeklyPersonalExpenses - (totalPropertyCost * 12 / 52), 2
    );
  });

  it('doubles the weekly net balance to get the fortnightly figure', () => {
    expect(calculateFortnightlyNetBalance(500)).toBe(1000);
  });
});

describe('amounts available to offset', () => {
  it('clamps a negative net balance to 0', () => {
    expect(calculateMonthlyToOffset(-100)).toBe(0);
    expect(calculateWeeklyToOffset(-50)).toBe(0);
    expect(calculateFortnightlyToOffset(-200)).toBe(0);
  });

  it('passes through a positive net balance unchanged', () => {
    expect(calculateMonthlyToOffset(500)).toBe(500);
    expect(calculateWeeklyToOffset(150)).toBe(150);
    expect(calculateFortnightlyToOffset(300)).toBe(300);
  });
});

describe('calculateTotalScheduledOffset', () => {
  it('sums one-time scheduled contribution amounts', () => {
    expect(calculateTotalScheduledOffset([
      { amount: 10000, recurrence: 'none' },
      { amount: 5000, recurrence: 'none' },
    ])).toBe(15000);
    expect(calculateTotalScheduledOffset([])).toBe(0);
  });

  it('excludes recurring contributions - they come from future cash flow, not savings already set aside', () => {
    expect(calculateTotalScheduledOffset([
      { amount: 10000, recurrence: 'none' },
      { amount: 500, recurrence: 'quarterly', startMonth: 1, endMonth: 360 },
    ])).toBe(10000);
    expect(calculateTotalScheduledOffset([{ amount: 500, recurrence: 'monthly', startMonth: 1, endMonth: 360 }])).toBe(0);
  });
});
