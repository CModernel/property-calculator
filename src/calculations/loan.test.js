import { describe, it, expect } from 'vitest';
import {
  TOTAL_MONTHS,
  calculateLoanAmount,
  calculateMonthlyRate,
  calculateMonthlyPayment,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyPropertyExpenses,
  calculateTotalPropertyCost,
  getMonth1Offset,
  calculateInitialPrincipal,
  calculateInitialMonthlyInterest,
  calculateNoOffsetTotalInterest,
  calculateMonthlyPropertyBalance,
  calculateWeeklyPropertyBalance,
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
  otherExpenses: 50,
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

  it('sums strata, utilities, council and insurance', () => {
    const monthlyStrata = calculateMonthlyStrata(DEFAULTS.strataFees);
    const monthlyCouncil = calculateMonthlyCouncil(DEFAULTS.councilRates);
    expect(
      calculateMonthlyPropertyExpenses(monthlyStrata, DEFAULTS.utilities, monthlyCouncil, DEFAULTS.insurance)
    ).toBe(642.5);
  });
});

describe('calculateTotalPropertyCost', () => {
  it('adds the mortgage payment and property expenses', () => {
    expect(calculateTotalPropertyCost(1400.71, 642.5)).toBeCloseTo(2043.21, 1);
  });
});

describe('getMonth1Offset / calculateInitialPrincipal / calculateInitialMonthlyInterest', () => {
  it('returns 0 when there is no contribution scheduled for month 1', () => {
    expect(getMonth1Offset([])).toBe(0);
    expect(getMonth1Offset([{ month: 2, amount: 5000 }])).toBe(0);
  });

  it('returns the amount scheduled for month 1', () => {
    expect(getMonth1Offset([{ month: 1, amount: 20000 }])).toBe(20000);
  });

  it('clamps initial principal to 0 when month1Offset exceeds the loan amount', () => {
    expect(calculateInitialPrincipal(250000, 300000)).toBe(0);
  });

  it('computes initial monthly interest from the initial principal', () => {
    const initialPrincipal = calculateInitialPrincipal(250000, 20000);
    expect(calculateInitialMonthlyInterest(initialPrincipal, 0.004483333333333333)).toBeCloseTo(1031.17, 1);
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

describe('property balance', () => {
  it('subtracts total property cost from monthly rental income', () => {
    expect(calculateMonthlyPropertyBalance(1950, 2043.21)).toBeCloseTo(-93.21, 1);
  });

  it('converts the monthly property balance to a weekly figure', () => {
    expect(calculateWeeklyPropertyBalance(-93.21)).toBeCloseTo(-21.51, 1);
  });
});

describe('personal expenses and income', () => {
  it('sums weekly personal expenses', () => {
    expect(
      calculateWeeklyPersonalExpenses(DEFAULTS.foodExpenses, DEFAULTS.transportExpenses, DEFAULTS.otherExpenses)
    ).toBe(200);
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
  it('sums all scheduled contribution amounts', () => {
    expect(calculateTotalScheduledOffset([{ amount: 10000 }, { amount: 5000 }])).toBe(15000);
    expect(calculateTotalScheduledOffset([])).toBe(0);
  });
});
