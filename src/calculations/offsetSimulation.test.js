import { describe, it, expect } from 'vitest';
import { calculateLoanWithOffset } from './offsetSimulation';
import { calculateMonthlyRate, calculateMonthlyPayment, calculateMonthlyFromWeekly } from './loan';
import { MAX_MONTH } from './recurringAmount';
import { calculateCompoundedValue } from './growthRate';
import { calculateVacancyFactor } from './vacancyFactor';

describe('calculateLoanWithOffset', () => {
  it('returns the sentinel result when there is no surplus and no contributions', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
    });
    // TODO-167 added hasUsableProjection so consumers stop branching on the
    // magic numbers themselves. Kept as a whole-object toEqual on purpose: any
    // future field added to one return path and not the other fails here.
    expect(result).toEqual({ years: 999, months: 360, totalInterest: 999999, totalSavingsInterest: 0, totalNegativeGearingBenefit: 0, totalCashShortfall: 0, monthsWithShortfall: 0, monthlyData: [], hasUsableProjection: false });
  });

  it('always reports a numeric months, on the sentinel path too', () => {
    // The timeline reads `months` for its slider bounds. When the sentinel
    // omitted the key the UI rendered "Middle (NaN)" and "End (undefined)".
    const sentinel = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
      maxMonths: 240,
    });
    expect(Number.isFinite(sentinel.months)).toBe(true);
    expect(sentinel.months).toBe(240);
  });

  it('does not hit the sentinel when contributions are scheduled even with zero surplus', () => {
    const result = calculateLoanWithOffset({
      contributions: [{ startMonth: 1, recurrence: 'none', amount: 1000 }],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 1000,
      monthlyRate: 0,
      monthlyPayment: 100,
    });
    expect(result.months).toBe(1);
    expect(result.monthlyData).toHaveLength(1);
    expect(result.totalInterest).toBe(0);
    // TODO-167: the normal path's own half of the flag - a shape change that
    // set it on only one of the two returns would leave this false.
    expect(result.hasUsableProjection).toBe(true);
  });

  it('amortizes normally with no offset activity (basic loop mechanics)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1,
      loanAmount: 1200,
      monthlyRate: 0,
      monthlyPayment: 100,
    });
    expect(result.months).toBe(12);
    expect(result.totalInterest).toBe(0);
    expect(result.monthlyData).toHaveLength(12);
    expect(result.monthlyData[11].balance).toBe(0);
  });

  it('pays off the loan early via a large contribution (break path), pushing the pre-override balance', () => {
    const result = calculateLoanWithOffset({
      contributions: [{ startMonth: 1, recurrence: 'none', amount: 200000 }],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 1000,
    });
    expect(result.months).toBe(1);
    expect(result.monthlyData).toHaveLength(1);
    // The month-1 snapshot is pushed BEFORE the post-break balance=0 override,
    // so it should reflect the balance after the regular payment, not 0.
    expect(result.monthlyData[0].balance).toBe(99000);
    expect(result.monthlyData[0].offset).toBe(100000);
  });

  it('hits the maxMonths cap when the loan never pays off', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1,
      loanAmount: 100000,
      monthlyRate: 0.05,
      monthlyPayment: 100,
      maxMonths: 12,
    });
    expect(result.months).toBe(12);
    expect(result.monthlyData).toHaveLength(12);
    expect(result.years).toBe(1);
  });

  it('clamps the net monthly deposit to 0 when an exceptional expense exceeds the surplus', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [{ startMonth: 1, recurrence: 'none', amount: 1000 }],
      monthlyToOffset: 500,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 600,
      maxMonths: 1,
    });
    expect(result.monthlyData[0].offset).toBe(0);
  });

  it('applies a "monthly" recurring expense only within the inclusive start/end month range', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [{ startMonth: 3, recurrence: 'monthly', endMonth: 5, amount: 400 }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000, // large enough that effectiveOffset is never capped by balance
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 6,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // Months 1-2 (before range): full $1000 deposit. Months 3-5 (inclusive): $600 net.
    // Month 6 (after range): back to full $1000.
    expect(offsets).toEqual([1000, 2000, 2600, 3200, 3800, 4800]);
  });

  it('applies an open-ended ("Forever") recurring expense in every month, including far into the future', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [{ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 300 }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 300,
    });
    expect(result.monthlyData[0].offset).toBe(700);
    expect(result.monthlyData[299].offset).toBe(700 * 300);
  });

  it('subtracts a one-time personal expense only on its exact month (TODO-85: former "Other Expenses" categories merged in)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [{ startMonth: 2, recurrence: 'none', amount: 200 }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([1000, 1800, 2800]);
  });

  it('applies scheduled contributions by exact month regardless of array order', () => {
    const result = calculateLoanWithOffset({
      contributions: [
        { startMonth: 5, recurrence: 'none', amount: 2000 },
        { startMonth: 2, recurrence: 'none', amount: 1000 },
      ],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 6,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([0, 1000, 1000, 1000, 3000, 3000]);
  });

  it('applies a recurring "quarterly" contribution every 3rd month, not just once', () => {
    const result = calculateLoanWithOffset({
      contributions: [{ startMonth: 1, recurrence: 'quarterly', endMonth: MAX_MONTH, amount: 500 }],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // $500 in months 1 and 4 (every 3rd month from month 1), nothing in between.
    expect(offsets).toEqual([500, 500, 500, 1000]);
  });

  it('stops a bounded recurring contribution after its endMonth (inclusive)', () => {
    const result = calculateLoanWithOffset({
      contributions: [{ startMonth: 1, recurrence: 'monthly', endMonth: 3, amount: 200 }],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([200, 400, 600, 600]);
  });

  it('sums a one-time and a recurring contribution together in the same month', () => {
    const result = calculateLoanWithOffset({
      contributions: [
        { startMonth: 1, recurrence: 'none', amount: 5000 },
        { startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 200 },
      ],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([5200, 5400]);
  });

  // Regression guard for the bug where the "Interest Amount (monthly)" panel used
  // (loanAmount - month1Offset) * monthlyRate, silently ignoring the recurring
  // monthly surplus that this loop deposits into the offset in month 1. That made
  // the panel disagree with the Timeline Explorer's own month-1 figure.
  it('subtracts the recurring monthly surplus from month 1 interest, not just the lump sum', () => {
    const loanAmount = 250000;
    const monthlyRate = 0.005;
    const monthlyToOffset = 4000;
    const contributions = [{ startMonth: 1, recurrence: 'none', amount: 20000 }];

    const result = calculateLoanWithOffset({
      contributions,
      personalExpenseItems: [],
      monthlyToOffset,
      loanAmount,
      monthlyRate,
      monthlyPayment: 1400,
    });

    const lumpSumOnlyInterest = (loanAmount - 20000) * monthlyRate;
    const expected = (loanAmount - 20000 - monthlyToOffset) * monthlyRate;

    expect(result.monthlyData[0].monthlyInterestPaid).toBe(Math.round(expected));
    expect(result.monthlyData[0].monthlyInterestPaid).toBeLessThan(Math.round(lumpSumOnlyInterest));
    // The month-1 offset the UI reports must include both parts.
    expect(result.monthlyData[0].offset).toBe(20000 + monthlyToOffset);
  });

  it('reports a month-1 offset even with no lump sum, when there is a monthly surplus', () => {
    // With the app's defaults there are no contributions at all, yet the loop
    // still deposits the surplus - so the panel's "(offset applied)" badge must
    // key off this value, not off a month-1 lump sum.
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 4084,
      loanAmount: 250000,
      monthlyRate: 0.004483333333333333,
      monthlyPayment: 1400.71,
    });

    expect(result.monthlyData[0].offset).toBe(4084);
  });

  it('adds a tenant\'s rent (as an incomeSources entry) only within its [startMonth, endMonth] range', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Tenants', amount: 300, isShared: false, startMonth: 3, recurrence: 'monthly', endMonth: 5 }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000, // large enough that effectiveOffset is never capped by balance
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 6,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // $300/week -> $1,300/month, deposited only in months 3-5 (inclusive).
    expect(offsets).toEqual([0, 0, 1300, 2600, 3900, 3900]);
  });

  it('adds an open-ended tenant\'s rent from startMonth onward, with no end', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Tenants', amount: 300, isShared: false, startMonth: 3, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 5,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // Nothing in months 1-2, then $1,300/month indefinitely from month 3 on.
    expect(offsets).toEqual([0, 0, 1300, 2600, 3900]);
  });

  it('adds a tenant with no date range every month, matching the previous always-on behavior', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Tenants', amount: 300, isShared: false, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([1300, 2600, 3900]);
  });

  it('sums rent from multiple tenants, some ranged and some not, per month', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Tenants', amount: 300, isShared: false, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }, // always active
        { id: 2, name: 'Tenants', amount: 300, isShared: false, startMonth: 2, recurrence: 'monthly', endMonth: 3 },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // Month 1 & 4: only the always-on tenant ($1,300). Months 2-3: both ($2,600).
    expect(offsets).toEqual([1300, 3900, 6500, 7800]);
  });

  it('adds a one-time income source only on its exact month', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Bonus', amount: 300, startMonth: 3, recurrence: 'none' }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // $300/week -> $1,300/month, deposited only in month 3.
    expect(offsets).toEqual([0, 0, 1300, 1300]);
  });

  it('adds an open-ended ("Forever") monthly income source every month', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([1300, 2600, 3900]);
  });

  it('adds a bounded monthly income source only within its inclusive range', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Freelance', amount: 300, startMonth: 3, recurrence: 'monthly', endMonth: 5 },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 6,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([0, 0, 1300, 2600, 3900, 3900]);
  });

  it('adds a quarterly income source only every 3rd month', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Bonus', amount: 300, startMonth: 1, recurrence: 'quarterly', endMonth: MAX_MONTH },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // $300/week -> $1,300/month, only in months 1 and 4 (every 3rd month from month 1).
    expect(offsets).toEqual([1300, 1300, 1300, 2600]);
  });

  it('sums income sources and tenant rent together per month', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Tenants', amount: 300, isShared: false, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 2, name: 'Salary', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // $300/week rent + $300/week income -> $2,600/month.
    expect(offsets).toEqual([2600, 5200]);
  });

  it('does not take the sentinel shortcut when an income source is present, even if the base surplus is <= 0', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary', amount: 0, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    expect(result.monthlyData.length).toBeGreaterThan(0);
  });

  it('ignores expenseFields entirely when omitted, matching the pre-TODO-19 behavior', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 900,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([900, 1800]);
  });

  it('subtracts a flat expenseFields base every month when there is no scheduled change', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: { base: 400, changes: [] }, // quarterly -> $100/month
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([900, 1800]);
  });

  it('switches to the scheduled expense change starting on its startMonth', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        // quarterly -> $100/month until month 3, then $800/quarter -> $200/month
        councilRates: { base: 400, changes: [{ startMonth: 3, amount: 800 }] },
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([900, 1800, 2600, 3400]);
  });

  it('subtracts maintenance (monthly), water rates (quarterly) and land tax (yearly) every month', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: emptyField,
        insurance: emptyField,
        maintenance: { base: 100, changes: [] }, // $100/month
        waterRates: { base: 200, changes: [] }, // quarterly -> $50/month
        landTax: { base: 2400, changes: [] }, // yearly -> $200/month
        propertyManagement: { base: 150, changes: [] }, // $150/month
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    // $1000 surplus - ($100 + $50 + $200 + $150) = $500/month net.
    expect(offsets).toEqual([500, 1000]);
  });

  it('subtracts miscPropertyExpense every month when present (TODO-82)', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: emptyField,
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
        miscPropertyExpense: { base: 80, changes: [] },
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([920, 1840]);
  });

  it('defaults miscPropertyExpense to 0 when the key is absent from expenseFields (TODO-82)', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: emptyField,
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 1,
    });
    expect(result.monthlyData[0].offset).toBe(1000);
  });
});

describe('scheduled/variable interest rate changes (interestRateField, TODO-57)', () => {
  it('behaves identically to the fixed-rate call when the field has no scheduled changes', () => {
    const loanAmount = 100000;
    const rate = 6;
    const monthlyRate = calculateMonthlyRate(rate);
    const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyRate, 12);
    const shared = {
      contributions: [{ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 200 }],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount,
      monthlyRate,
      monthlyPayment,
      maxMonths: 12,
    };

    const withField = calculateLoanWithOffset({ ...shared, interestRateField: { base: rate, changes: [] } });
    const withoutField = calculateLoanWithOffset(shared);

    expect(withField).toEqual(withoutField);
  });

  it('re-amortizes the remaining balance over the remaining term on a rate change, still paying off exactly by term end', () => {
    // No offset activity at all (monthlyToOffset stays clamped to 0 the whole
    // way, see the netMonthlyDeposit assertion below) - isolates plain
    // amortization so a rate hike's effect on the payoff schedule is
    // unambiguous. Needs a 0-amount income source to skip the "nothing to
    // offset" sentinel shortcut, same trick as the tests above.
    const loanAmount = 100000;
    const initialRate = 6;
    const initialMonthlyRate = calculateMonthlyRate(initialRate);
    const initialMonthlyPayment = calculateMonthlyPayment(loanAmount, initialMonthlyRate, 12);

    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary', amount: 0, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount,
      monthlyRate: initialMonthlyRate,
      monthlyPayment: initialMonthlyPayment,
      interestRateField: { base: initialRate, changes: [{ startMonth: 6, amount: 9 }] },
      maxMonths: 12,
    });

    // A rate rise mid-term, re-amortized over the remaining term, still
    // reaches a fully paid-off balance right at month 12 - simply swapping
    // the interest/principal split at the stale 6%-based installment
    // (the pre-TODO-57 behavior) would undershoot this, since that
    // installment doesn't fully cover a 9% loan's amortization schedule.
    expect(result.monthlyData).toHaveLength(12);
    expect(result.monthlyData[11].balance).toBe(0);
  });

  it('reduces the reported surplus starting exactly on the change\'s startMonth, not before or after (delta correction)', () => {
    // monthlyToOffset (5000) is a caller-supplied constant with the ORIGINAL
    // month-1 payment already baked in (App.jsx's baseMonthlySurplus
    // convention) - large enough here that nothing ever clamps to 0, so the
    // net deposit is observable every month.
    const loanAmount = 250000;
    const initialRate = 5.38;
    const initialMonthlyRate = calculateMonthlyRate(initialRate);
    const initialMonthlyPayment = calculateMonthlyPayment(loanAmount, initialMonthlyRate, 360);

    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 5000,
      loanAmount,
      monthlyRate: initialMonthlyRate,
      monthlyPayment: initialMonthlyPayment,
      interestRateField: { base: initialRate, changes: [{ startMonth: 13, amount: 6.38 }] },
      maxMonths: 360,
    });

    // `offset` is a running total that's re-rounded to the nearest dollar
    // EVERY month, so consecutive differences carry ±$1 of rounding jitter
    // even when the true underlying deposit is perfectly constant - a
    // "spread stays tiny" check, not an exact-equality one.
    const netDeposit = (i) => result.monthlyData[i].offset - (i === 0 ? 0 : result.monthlyData[i - 1].offset);
    const spread = (arr) => Math.max(...arr) - Math.min(...arr);
    const beforeChange = Array.from({ length: 12 }, (_, i) => netDeposit(i)); // months 1-12
    const afterChange = Array.from({ length: 12 }, (_, i) => netDeposit(12 + i)); // months 13-24

    // Flat before the change (still just the original monthlyToOffset)...
    expect(spread(beforeChange)).toBeLessThanOrEqual(1);
    // ...flat again after it, at a new (lower) level once the higher-rate
    // installment is correctly reflected...
    expect(spread(afterChange)).toBeLessThanOrEqual(1);
    // ...and a rate RISE re-amortized over the remaining term raises the
    // installment, which must show up as a SMALLER net surplus - not a
    // stale one still reflecting the original 5.38% payment.
    expect(afterChange[0]).toBeLessThan(beforeChange[0] - 1);
  });
});

// TODO-136 deleted the ongoing offset-vs-savings split (offsetAllocationPct).
// Surplus now goes to the offset and the ETF only; `initialSavingsBalance` is
// a settlement-time cash position that compounds on its own and never
// receives monthly deposits.
describe('surplus goes to the offset, never to an ongoing savings pool (TODO-136)', () => {
  it('sends 100% of the surplus to the offset, leaving savings untouched', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual([1000, 2000, 3000]);
    expect(result.monthlyData.map(d => d.savings)).toEqual([0, 0, 0]);
  });

  it('leaves an initialSavingsBalance completely flat with no interest rate - no surplus ever lands in it', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      initialSavingsBalance: 5000,
      maxMonths: 3,
    });
    // Every dollar of surplus reaches the offset; the starting cash just sits.
    expect(result.monthlyData.map(d => d.offset)).toEqual([1000, 2000, 3000]);
    expect(result.monthlyData.map(d => d.savings)).toEqual([5000, 5000, 5000]);
  });
});

describe('savings interest accrual (savingsInterestRate, TODO-50)', () => {
  it('passing savingsInterestRate: 0 explicitly matches omitting it entirely', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      initialSavingsBalance: 5000,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, savingsInterestRate: 0 });
    expect(withExplicitZero).toEqual(withDefault);
  });

  it('compounds monthly on the running balance before adding that month\'s deposit', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      initialSavingsBalance: 10000,
      savingsInterestRate: 12, // -> exactly 1%/month via calculateMonthlyRate
      maxMonths: 3,
    });
    // No deposits ever reach savings (TODO-136) - growth is pure interest:
    // 10000 -> 10100 -> 10201 -> 10303.01 (rounded to 10303).
    expect(result.monthlyData.map(d => d.savings)).toEqual([10100, 10201, 10303]);
    expect(result.totalSavingsInterest).toBeCloseTo(303.01, 2);
  });

  it('still compounds the initial savings balance even with zero ongoing surplus/income/contributions', () => {
    // Without the TODO-50 early-out fix, this would hit the "nothing to
    // offset" sentinel and return monthlyData: [] - dropping the fact that
    // a lump sum sitting in savings keeps earning interest regardless of
    // whether anything else is happening this month.
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      initialSavingsBalance: 10000,
      savingsInterestRate: 12,
      maxMonths: 3,
    });
    expect(result.monthlyData).not.toEqual([]);
    expect(result.monthlyData.map(d => d.savings)).toEqual([10100, 10201, 10303]);
  });
});

describe('property value over time (propertyPrice/propertyGrowthRate, TODO-89)', () => {
  it('defaults to a flat propertyValue equal to propertyPrice when propertyGrowthRate is omitted/0', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      propertyPrice: 850000,
      maxMonths: 3,
    });
    expect(result.monthlyData.map(d => d.propertyValue)).toEqual([850000, 850000, 850000]);
  });

  it('is 0 when propertyPrice is omitted, matching every existing caller/test that never set it', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 1,
    });
    expect(result.monthlyData[0].propertyValue).toBe(0);
  });

  it('compounds monthly at 1%/month (12% p.a.), matching calculateCompoundedValue directly', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      propertyPrice: 850000,
      propertyGrowthRate: 12,
      maxMonths: 3,
    });
    expect(result.monthlyData.map(d => d.propertyValue)).toEqual([
      Math.round(calculateCompoundedValue(850000, 12, 1)),
      Math.round(calculateCompoundedValue(850000, 12, 2)),
      Math.round(calculateCompoundedValue(850000, 12, 3)),
    ]);
  });

  it('shrinks propertyValue under negative growth', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      propertyPrice: 850000,
      propertyGrowthRate: -5,
      maxMonths: 12,
    });
    expect(result.monthlyData[11].propertyValue).toBeLessThan(850000);
  });
});

describe('Salary/Wages income growth (salaryGrowthRate, TODO-90)', () => {
  it('matches getActiveAmount exactly (no growth) when salaryGrowthRate is 0/omitted', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary/Wages', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, salaryGrowthRate: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    // 300/week -> 1300/month (calculateMonthlyFromWeekly), cumulative into the offset.
    expect(withDefault.monthlyData.map(d => d.offset)).toEqual([1300, 2600, 3900]);
  });

  it('grows Salary/Wages income monthly at salaryGrowthRate, leaving other income categories untouched', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Salary/Wages', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 2, name: 'Dividends', amount: 100, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      salaryGrowthRate: 12, // -> exactly 1%/month via calculateMonthlyRate
      maxMonths: 3,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2, 3].map((month) => {
      const grownSalary = calculateCompoundedValue(300, 12, month);
      cumulative += calculateMonthlyFromWeekly(grownSalary + 100); // Dividends stays flat at 100
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });
});

describe('rental income growth (rentGrowthRate, TODO-91)', () => {
  it('matches getActiveAmount exactly (no growth) when rentGrowthRate is 0/omitted', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, rentGrowthRate: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    expect(withDefault.monthlyData.map(d => d.offset)).toEqual([1300, 2600, 3900]);
  });

  it('grows House Rent and Room Rent income independently of salaryGrowthRate and other income', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Salary/Wages', amount: 200, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 2, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 3, name: 'Room Rent', amount: 50, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 4, name: 'Dividends', amount: 100, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      salaryGrowthRate: 0,
      rentGrowthRate: 12, // -> exactly 1%/month via calculateMonthlyRate
      maxMonths: 3,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2, 3].map((month) => {
      const grownRent = calculateCompoundedValue(300 + 50, 12, month);
      cumulative += calculateMonthlyFromWeekly(200 + grownRent + 100); // Salary/Dividends stay flat
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });
});

describe('expense growth (expenseGrowthRate, TODO-92)', () => {
  it('matches the plain path exactly when expenseGrowthRate is 0/omitted', () => {
    const emptyField = { base: 0, changes: [] };
    const shared = {
      contributions: [],
      personalExpenseItems: [{ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 50 }],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: { base: 400, changes: [] }, // quarterly -> $100/month
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 2,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, expenseGrowthRate: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    expect(withDefault.monthlyData.map(d => d.offset)).toEqual([850, 1700]);
  });

  it('grows property expenses monthly at expenseGrowthRate, on top of a scheduled base value', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: { base: 400, changes: [] }, // quarterly -> $100/month
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      expenseGrowthRate: 12, // -> exactly 1%/month via calculateMonthlyRate
      maxMonths: 2,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2].map((month) => {
      const grownPropertyExpense = calculateCompoundedValue(100, 12, month);
      cumulative += 1000 - grownPropertyExpense;
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });

  it('grows personal expenses monthly at expenseGrowthRate', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [{ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 300 }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      expenseGrowthRate: 12,
      maxMonths: 2,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2].map((month) => {
      const grownPersonalExpense = calculateCompoundedValue(300, 12, month);
      cumulative += 1000 - grownPersonalExpense;
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });
});

describe('rental vacancy (vacancyWeeksPerYear, TODO-95)', () => {
  it('matches the plain path exactly when vacancyWeeksPerYear is 0/omitted', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, vacancyWeeksPerYear: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    expect(withDefault.monthlyData.map(d => d.offset)).toEqual([1300, 2600, 3900]);
  });

  it('applies a flat deterministic haircut to rental income only, leaving other income untouched', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Salary/Wages', amount: 200, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 2, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      vacancyWeeksPerYear: 2, // -> 1 - 2/52 ≈ 0.96154
      maxMonths: 2,
    });
    const vacancyFactor = 1 - (2 / 52);
    let cumulative = 0;
    const expectedOffsets = [1, 2].map(() => {
      cumulative += calculateMonthlyFromWeekly(200 + 300 * vacancyFactor);
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });

  // TODO-150: the engine is the tie-breaker for what rental income "is", so
  // these two pin the relationship between it and App.jsx's Day-1 figure
  // directly - one for the part that must agree, one for the part that
  // deliberately doesn't. `monthlyData` carries no per-month income field, so
  // both read month 1's income through `offset` with monthlyToOffset at 0 and
  // no expenses, the same technique the cases above use.
  describe('agreement with App.jsx\'s Day-1 rental figure (TODO-150)', () => {
    const monthOneParams = (overrides) => ({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 600, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 0,
      vacancyWeeksPerYear: 4,
      maxMonths: 1,
      ...overrides,
    });

    it('equals App.jsx\'s Day-1 expression once rent growth is out of the way', () => {
      const result = calculateLoanWithOffset(monthOneParams({ rentGrowthRate: 0 }));
      // App.jsx:622-625's own expression, via the same shared helper it calls.
      const appDay1 = calculateMonthlyFromWeekly(600 * calculateVacancyFactor(4));
      expect(result.monthlyData[0].offset).toBe(Math.round(appDay1));
    });

    // Pinned as deliberate, not left as a comment an audit would re-report as a
    // bug: the engine's month 1 means "end of the first month" and so carries
    // one month of growth, while App's Day 1 means "today, before any growth".
    // The same offset exists on salary and expenses, so chasing it for rent
    // alone would create a new inconsistency INSIDE the Day-1 snapshot.
    it('runs exactly one month of rent growth ahead of Day-1 when growth is on', () => {
      const result = calculateLoanWithOffset(monthOneParams({ rentGrowthRate: 6 }));
      const appDay1 = calculateMonthlyFromWeekly(600 * calculateVacancyFactor(4));
      expect(result.monthlyData[0].offset).toBe(Math.round(appDay1 * (1 + 0.06 / 12)));
    });
  });

  it('is a full 52-week vacancy edge case that zeroes out rental income entirely', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      vacancyWeeksPerYear: 52,
      maxMonths: 1,
    });
    // Rental income fully offset by vacancy - only the base surplus reaches the offset.
    expect(result.monthlyData[0].offset).toBe(1000);
  });

  it('composes correctly with rentGrowthRate (grow first, then apply the vacancy haircut)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      rentGrowthRate: 12,
      vacancyWeeksPerYear: 2,
      maxMonths: 2,
    });
    const vacancyFactor = 1 - (2 / 52);
    let cumulative = 0;
    const expectedOffsets = [1, 2].map((month) => {
      const grownRent = calculateCompoundedValue(300, 12, month);
      cumulative += calculateMonthlyFromWeekly(grownRent * vacancyFactor);
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });
});

describe('gross income tax conversion (effectiveTaxRate, TODO-94)', () => {
  it('matches the plain path exactly when effectiveTaxRate is 0/omitted, even with isGross items', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary/Wages', amount: 300, isGross: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, effectiveTaxRate: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    expect(withDefault.monthlyData.map(d => d.offset)).toEqual([1300, 2600, 3900]);
  });

  it('shrinks a Gross salary item by the tax rate while a non-Gross item in the same simulation is untouched', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [
        { id: 1, name: 'Salary/Wages', amount: 300, isGross: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
        { id: 2, name: 'Dividends', amount: 100, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH },
      ],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      effectiveTaxRate: 20,
      maxMonths: 2,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2].map(() => {
      cumulative += calculateMonthlyFromWeekly(300 * 0.8 + 100); // salary net'd, Dividends untouched
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });

  it('composes correctly with a Gross rental item, rentGrowthRate, and vacancyWeeksPerYear together', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, isGross: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      rentGrowthRate: 12,
      vacancyWeeksPerYear: 2,
      effectiveTaxRate: 25,
      maxMonths: 2,
    });
    const vacancyFactor = 1 - (2 / 52);
    let cumulative = 0;
    const expectedOffsets = [1, 2].map((month) => {
      const grownNetRent = calculateCompoundedValue(300 * 0.75, 12, month);
      cumulative += calculateMonthlyFromWeekly(grownNetRent * vacancyFactor);
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });

  it('converts a Gross item in the catch-all "other" income bucket too', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Dividends', amount: 400, isGross: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      effectiveTaxRate: 30,
      maxMonths: 1,
    });
    expect(result.monthlyData[0].offset).toBe(Math.round(calculateMonthlyFromWeekly(400 * 0.7)));
  });
});

describe('ETF investing (etfAllocationPct/expectedEtfReturn, TODO-96)', () => {
  it('matches the plain path exactly when etfAllocationPct/expectedEtfReturn are 0/omitted', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, etfAllocationPct: 0, expectedEtfReturn: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    expect(withDefault.monthlyData.map(d => d.etf)).toEqual([0, 0, 0]);
  });

  it('splits the whole surplus directly between ETF and offset, with nothing going to savings (TODO-136)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 40,
      initialSavingsBalance: 5000,
      maxMonths: 2,
    });
    // 40% of the FULL 1000 surplus goes to ETF, the other 60% to the offset -
    // no intermediate offset-vs-savings step. The starting cash is inert.
    expect(result.monthlyData.map(d => d.etf)).toEqual([400, 800]);
    expect(result.monthlyData.map(d => d.offset)).toEqual([600, 1200]);
    expect(result.monthlyData.map(d => d.savings)).toEqual([5000, 5000]);
  });

  it("grows the ETF balance at expectedEtfReturn net of HALF effectiveTaxRate (TODO-131: AU 50% CGT discount), compounding on the running balance before each month's deposit", () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100, // the entire surplus goes to ETF instead of the offset
      expectedEtfReturn: 24,
      effectiveTaxRate: 50, // net rate: 24 * (1 - 0.5*0.5) = 18% p.a. -> exactly 1.5%/month
      maxMonths: 3,
    });
    expect(result.monthlyData.map(d => d.etf)).toEqual([1000, 2015, 3045]);
    expect(result.monthlyData.map(d => d.offset)).toEqual([0, 0, 0]);
  });

  it('applies the full pre-tax rate when effectiveTaxRate is 0/omitted - the calc layer does not block this, the UI gates it', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      expectedEtfReturn: 12, // effectiveTaxRate omitted -> full 12% p.a. -> 1%/month
      maxMonths: 2,
    });
    expect(result.monthlyData.map(d => d.etf)).toEqual([1000, 2010]);
  });

  it('conserves the surplus - offset + etf sums back to exactly what came in (TODO-136)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 25,
      maxMonths: 1,
    });
    // Two destinations now, not three: 25% to ETF, the remaining 75% to the
    // offset, and nothing lost to a savings pool in between.
    const { offset, savings, etf } = result.monthlyData[0];
    expect(etf).toBe(250);
    expect(offset).toBe(750);
    expect(savings).toBe(0);
    expect(offset + etf).toBe(1000);
  });
});

describe('ETF switch trigger (switchThresholdPct, TODO-98)', () => {
  it('matches the plain path exactly when switchThresholdPct is 0/omitted - no regression to TODO-96', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      expectedEtfReturn: 24,
      effectiveTaxRate: 50,
      maxMonths: 3,
    };
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, switchThresholdPct: 0 });
    expect(withExplicitZero).toEqual(withDefault);
    // Same numbers as the TODO-96/131 "grows the ETF balance" test - a 0%
    // threshold triggers immediately, exactly like having no threshold at all.
    expect(withDefault.monthlyData.map(d => d.etf)).toEqual([1000, 2015, 3045]);
  });

  it('holds the ETF share at 0 until offsetBalance crosses switchThresholdPct of the remaining balance, then switches on for good', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      switchThresholdPct: 10,
      maxMonths: 3,
    });
    // Month 1: offsetBalance (0) / balance (10000) = 0% < 10% -> not yet
    // triggered, the full $1000 offsetShare goes to the offset.
    // Month 2: ratio is now checked against last month's offsetBalance
    // (1000) / balance (9900) ~= 10.10% >= 10% -> triggers this month, so
    // the entire offsetShare (1000) reroutes to ETF instead, freezing
    // offset at 1000 for the rest of the simulation.
    // Month 3: ratio (1000/9800) is still >= 10% - stays triggered
    // (monotonic, no un-triggering).
    expect(result.monthlyData.map(d => d.offset)).toEqual([1000, 1000, 1000]);
    expect(result.monthlyData.map(d => d.etf)).toEqual([0, 1000, 2000]);
    expect(result.monthlyData.map(d => d.balance)).toEqual([9900, 9800, 9700]);
  });

  it('stays at etf:0 for the entire simulation when switchThresholdPct is never crossed within maxMonths', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 100, // tiny surplus relative to loanAmount - the ratio barely moves
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      switchThresholdPct: 90, // effectively unreachable in 3 months at this scale
      maxMonths: 3,
    });
    expect(result.monthlyData.map(d => d.etf)).toEqual([0, 0, 0]);
    expect(result.monthlyData.map(d => d.offset)).toEqual([100, 200, 300]);
  });

  // TODO-136: the old version of this test slowed the offset's climb with
  // offsetAllocationPct. That knob is gone, so a smaller surplus is now the
  // only way to delay the crossing - which is the same underlying property:
  // the threshold tracks how fast the offset actually accumulates.
  it('a smaller surplus accumulates the offset more slowly and delays when the threshold is crossed', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      loanAmount: 10_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      switchThresholdPct: 10,
      maxMonths: 2,
    };
    // At 1000/mo the threshold is already crossed by month 2 (see the test
    // above this one). Halving the surplus keeps the ratio under 10% there.
    const bigSurplus = calculateLoanWithOffset({ ...shared, monthlyToOffset: 1000 });
    const smallSurplus = calculateLoanWithOffset({ ...shared, monthlyToOffset: 500 });
    expect(bigSurplus.monthlyData[1].etf).toBeGreaterThan(0);
    expect(smallSurplus.monthlyData[1].etf).toBe(0);
  });
});

describe('additional interestRateField scenarios (TODO-57)', () => {
  it('re-amortizes correctly on a rate DECREASE too, still paying off exactly by term end', () => {
    const loanAmount = 100000;
    const initialRate = 9;
    const initialMonthlyRate = calculateMonthlyRate(initialRate);
    const initialMonthlyPayment = calculateMonthlyPayment(loanAmount, initialMonthlyRate, 12);

    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary', amount: 0, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount,
      monthlyRate: initialMonthlyRate,
      monthlyPayment: initialMonthlyPayment,
      interestRateField: { base: initialRate, changes: [{ startMonth: 6, amount: 2 }] },
      maxMonths: 12,
    });

    expect(result.monthlyData).toHaveLength(12);
    expect(result.monthlyData[11].balance).toBe(0);
  });

  it('re-amortizes correctly through two or more scheduled changes in sequence', () => {
    const loanAmount = 100000;
    const initialRate = 6;
    const initialMonthlyRate = calculateMonthlyRate(initialRate);
    const initialMonthlyPayment = calculateMonthlyPayment(loanAmount, initialMonthlyRate, 12);

    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary', amount: 0, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount,
      monthlyRate: initialMonthlyRate,
      monthlyPayment: initialMonthlyPayment,
      interestRateField: { base: initialRate, changes: [{ startMonth: 4, amount: 9 }, { startMonth: 8, amount: 5 }] },
      maxMonths: 12,
    });

    expect(result.monthlyData).toHaveLength(12);
    expect(result.monthlyData[11].balance).toBe(0);
  });

  // TODO-136: this used to prove the correction term was split across
  // offset/savings rather than special-cased into the offset. With savings
  // gone, the equivalent property is that it's split with the ETF like any
  // other surplus dollar - not routed straight to the offset.
  it('feeds the delta-correction term through the normal ETF/offset split, not straight into the offset', () => {
    const loanAmount = 100000;
    const initialRate = 9;
    const initialMonthlyRate = calculateMonthlyRate(initialRate);
    const initialMonthlyPayment = calculateMonthlyPayment(loanAmount, initialMonthlyRate, 12);

    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary', amount: 0, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount,
      monthlyRate: initialMonthlyRate,
      monthlyPayment: initialMonthlyPayment,
      // A steep rate DROP so the correction (initial payment - new, lower
      // payment) is unambiguously positive from month 6 on.
      interestRateField: { base: initialRate, changes: [{ startMonth: 6, amount: 2 }] },
      etfAllocationPct: 50,
      maxMonths: 12,
    });

    // Before the change, there's no surplus at all (no monthlyToOffset, no
    // income) - offset and etf both stay at 0 through month 5.
    expect(result.monthlyData[4].offset).toBe(0);
    expect(result.monthlyData[4].etf).toBe(0);
    // From month 6, the ONLY surplus is the correction term itself - if it
    // were special-cased straight to the offset, etf would stay at 0.
    // Instead it splits evenly, same as any other surplus dollar.
    const month6 = result.monthlyData[5];
    expect(month6.etf).toBeGreaterThan(0);
    expect(Math.abs(month6.offset - month6.etf)).toBeLessThanOrEqual(1);
  });
});

describe('sentinel early-out boundary conditions', () => {
  it('still hits the sentinel when only initialSavingsBalance is nonzero (savingsInterestRate stays 0)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
      initialSavingsBalance: 5000,
    });
    expect(result.monthlyData).toEqual([]);
  });

  it('still hits the sentinel when only savingsInterestRate is nonzero (initialSavingsBalance stays 0)', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
      savingsInterestRate: 5,
    });
    expect(result.monthlyData).toEqual([]);
  });

  it('returns cleanly with an empty timeline when maxMonths is 0, even with a real surplus', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
      maxMonths: 0,
    });
    expect(result.months).toBe(0);
    expect(result.monthlyData).toEqual([]);
    expect(result.totalInterest).toBe(0);
  });

  it('documents that offsetting contributions summing to a net 0 total take the sentinel shortcut, despite real per-month timing', () => {
    // The sentinel gate checks the SUM of contributions, not whether any
    // individual month has real activity - a net-zero total (however it's
    // composed) is treated identically to "no contributions at all". Flagged
    // separately as a candidate TODO, not fixed here.
    const result = calculateLoanWithOffset({
      contributions: [
        { startMonth: 1, recurrence: 'none', amount: 500 },
        { startMonth: 2, recurrence: 'none', amount: -500 },
      ],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
    });
    expect(result.monthlyData).toEqual([]);
  });
});

describe('additional Salary/rental growth interactions', () => {
  it('composes correctly with a Gross salary item, salaryGrowthRate, and effectiveTaxRate together', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary/Wages', amount: 300, isGross: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      salaryGrowthRate: 12,
      effectiveTaxRate: 25,
      maxMonths: 2,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2].map((month) => {
      const grownNetSalary = calculateCompoundedValue(300 * 0.75, 12, month);
      cumulative += calculateMonthlyFromWeekly(grownNetSalary);
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });

  it('shrinks Salary/Wages income under a negative salaryGrowthRate, unlike a flat 0% rate', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary/Wages', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 12,
    };
    const flat = calculateLoanWithOffset(shared);
    const declining = calculateLoanWithOffset({ ...shared, salaryGrowthRate: -5 });
    expect(declining.monthlyData[11].offset).toBeLessThan(flat.monthlyData[11].offset);
  });

  it('shrinks House Rent income under a negative rentGrowthRate, unlike a flat 0% rate', () => {
    const shared = {
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 12,
    };
    const flat = calculateLoanWithOffset(shared);
    const declining = calculateLoanWithOffset({ ...shared, rentGrowthRate: -5 });
    expect(declining.monthlyData[11].offset).toBeLessThan(flat.monthlyData[11].offset);
  });
});

describe('property and personal expense growth combined (expenseGrowthRate, TODO-92)', () => {
  it('grows property expenses and personal expenses together in the same call, not just in isolation', () => {
    const emptyField = { base: 0, changes: [] };
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [{ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 100 }],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: { base: 400, changes: [] }, // quarterly -> $100/month
        insurance: emptyField,
        maintenance: emptyField,
        waterRates: emptyField,
        landTax: emptyField,
        propertyManagement: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      expenseGrowthRate: 12,
      maxMonths: 2,
    });
    let cumulative = 0;
    const expectedOffsets = [1, 2].map((month) => {
      const grownPropertyExpense = calculateCompoundedValue(100, 12, month);
      const grownPersonalExpense = calculateCompoundedValue(100, 12, month);
      cumulative += 1000 - grownPropertyExpense - grownPersonalExpense;
      return Math.round(cumulative);
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual(expectedOffsets);
  });
});

describe('vacancy weeks beyond a full year (vacancyWeeksPerYear > 52)', () => {
  it('documents the current unclamped behavior - vacancyFactor goes negative and REDUCES the surplus rather than zeroing rental income out', () => {
    // Not a validated design choice - flagged separately as a candidate TODO
    // rather than fixed here (fixing would change simulation output).
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 300, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      vacancyWeeksPerYear: 60, // > 52 weeks/year
      maxMonths: 1,
    });
    const vacancyFactor = 1 - (60 / 52);
    expect(vacancyFactor).toBeLessThan(0);
    const grownRent = calculateMonthlyFromWeekly(300 * vacancyFactor);
    expect(result.monthlyData[0].offset).toBe(Math.round(1000 + grownRent));
    expect(result.monthlyData[0].offset).toBeLessThan(1000);
  });
});

describe('ETF losses (negative expectedEtfReturn)', () => {
  it('shrinks the ETF balance under a negative expectedEtfReturn (a loss scenario), unlike a flat/positive return', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      expectedEtfReturn: -12, // -1%/month via calculateMonthlyRate
      maxMonths: 3,
    });
    // etfBalance grows by the (negative) monthly return BEFORE this month's
    // deposit lands, so each month is at most a flat $1000/month
    // accumulation would give (month 1 ties, since there's no prior balance
    // yet for the negative rate to act on) and strictly less from month 2 on.
    const naive = [1000, 2000, 3000];
    result.monthlyData.forEach((d, i) => expect(d.etf).toBeLessThanOrEqual(naive[i]));
    expect(result.monthlyData[2].etf).toBeLessThan(naive[2]);
  });
});

describe('negative gearing tax benefit (isInvestmentProperty, TODO-129)', () => {
  // Shared loss-making setup for several tests below: rental income
  // ($433.33/mo) is well under property expenses ($1000/mo) + interest
  // ($500/mo in month 1), so the property is cash-flow negative every month.
  const lossMakingShared = {
    contributions: [],
    personalExpenseItems: [],
    incomeSources: [{ id: 1, name: 'House Rent', amount: 100, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
    expenseFields: {
      strataFees: { base: 0, changes: [] },
      utilities: { base: 1000, changes: [] },
      councilRates: { base: 0, changes: [] },
      insurance: { base: 0, changes: [] },
      maintenance: { base: 0, changes: [] },
      waterRates: { base: 0, changes: [] },
      landTax: { base: 0, changes: [] },
      propertyManagement: { base: 0, changes: [] },
    },
    monthlyToOffset: 0,
    loanAmount: 100_000,
    monthlyRate: 0.005,
    monthlyPayment: 100,
    effectiveTaxRate: 30,
    maxMonths: 2,
  };

  it('matches the plain path exactly when isInvestmentProperty is false/omitted, even with a real loss', () => {
    const withDefault = calculateLoanWithOffset(lossMakingShared);
    const withExplicitFalse = calculateLoanWithOffset({ ...lossMakingShared, isInvestmentProperty: false });
    expect(withExplicitFalse).toEqual(withDefault);
    // Confirms this scenario really is loss-making - the offset never grows
    // on its own, isolating isInvestmentProperty as the only thing that
    // could add to it.
    expect(withDefault.monthlyData.map(d => d.offset)).toEqual([0, 0]);
    expect(withDefault.totalNegativeGearingBenefit).toBe(0);
  });

  // TODO-136 changed this one. It used to assert the month-1 credit was still
  // sitting in the offset at month 2 (~320), which was only true because a
  // deficit month was silently floored to zero. Now the same deficit that
  // caused the loss also consumes the credit it earned - the honest result:
  // a tax benefit softens a loss-making property, it doesn't fund it.
  it('lets an ongoing cash deficit consume the gearing credit it earned, surfacing the rest as a shortfall', () => {
    const result = calculateLoanWithOffset({ ...lossMakingShared, isInvestmentProperty: true });
    // Every month: rent 433.33 - utilities 1000 = -566.67 cash flow.
    // Month 1: nothing in the offset to draw on -> the full 566.67 is short.
    //   Then gearing credits ~320 (loss of 1066.67 incl. 500 interest, x30%).
    // Month 2: the 566.67 deficit drains that ~320 to zero, leaving ~247 short.
    expect(result.monthlyData.map(d => d.offset)).toEqual([0, 0]);
    expect(result.monthlyData[0].cashShortfall).toBeCloseTo(567, 0);
    expect(result.monthlyData[1].cashShortfall).toBeCloseTo(247, 0);
    expect(result.totalNegativeGearingBenefit).toBeGreaterThan(0);
  });

  // The one-month lag TODO-129 established is still real - it's just only
  // observable when the household can actually cover the property's deficit,
  // which is the realistic negative-gearing case (salary funds the shortfall).
  it('still applies the credit a month late when the household covers the property deficit', () => {
    const covered = { ...lossMakingShared, monthlyToOffset: 2000, maxMonths: 3 };
    const geared = calculateLoanWithOffset({ ...covered, isInvestmentProperty: true });
    const plain = calculateLoanWithOffset(covered);

    expect(geared.totalCashShortfall).toBe(0);
    // Month 1 is identical - the credit lands after that month's offset is
    // already fixed. Only month 2 onward diverges.
    expect(geared.monthlyData[0].offset).toBe(plain.monthlyData[0].offset);
    expect(geared.monthlyData[1].offset).toBeGreaterThan(plain.monthlyData[1].offset);
  });

  it('applies no benefit when the property is cash-flow POSITIVE that month', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'House Rent', amount: 1000, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      expenseFields: {
        strataFees: { base: 0, changes: [] },
        utilities: { base: 100, changes: [] },
        councilRates: { base: 0, changes: [] },
        insurance: { base: 0, changes: [] },
        maintenance: { base: 0, changes: [] },
        waterRates: { base: 0, changes: [] },
        landTax: { base: 0, changes: [] },
        propertyManagement: { base: 0, changes: [] },
      },
      monthlyToOffset: 0,
      loanAmount: 10_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      effectiveTaxRate: 30,
      isInvestmentProperty: true,
      maxMonths: 1,
    });
    expect(result.totalNegativeGearingBenefit).toBe(0);
  });

  it('yields exactly zero benefit when effectiveTaxRate is 0, even with a real loss', () => {
    const result = calculateLoanWithOffset({ ...lossMakingShared, effectiveTaxRate: 0, isInvestmentProperty: true });
    expect(result.totalNegativeGearingBenefit).toBe(0);
    expect(result.monthlyData.map(d => d.offset)).toEqual([0, 0]);
  });
});

// TODO-136: a deficit month used to be wrapped in Math.max(0, ...) and simply
// vanish. It now draws down the offset and, once that's empty, is reported.
describe('cash shortfall on deficit months (TODO-136)', () => {
  // Surplus of +1000/mo for 2 months, then a one-time 3000 expense in month 3
  // -> a 2000 deficit against a 2000 offset balance, draining it to exactly 0.
  const deficitShared = {
    contributions: [],
    personalExpenseItems: [{ id: 1, name: 'Custom', amount: 3000, startMonth: 3, recurrence: 'none', endMonth: 3 }],
    monthlyToOffset: 1000,
    loanAmount: 10_000_000,
    monthlyRate: 0,
    monthlyPayment: 100,
    maxMonths: 3,
  };

  it('reports no shortfall at all when every month is in surplus', () => {
    const result = calculateLoanWithOffset({ ...deficitShared, personalExpenseItems: [] });
    expect(result.totalCashShortfall).toBe(0);
    expect(result.monthsWithShortfall).toBe(0);
    expect(result.monthlyData.map(d => d.cashShortfall)).toEqual([0, 0, 0]);
  });

  it('absorbs a deficit out of the offset without reporting a shortfall while the offset covers it', () => {
    const result = calculateLoanWithOffset(deficitShared);
    // Offset reaches 2000 by month 2, then the 2000 net deficit empties it.
    expect(result.monthlyData.map(d => d.offset)).toEqual([1000, 2000, 0]);
    expect(result.totalCashShortfall).toBe(0);
    expect(result.monthsWithShortfall).toBe(0);
  });

  it('reports the remainder once the deficit outlives the offset', () => {
    const result = calculateLoanWithOffset({
      ...deficitShared,
      personalExpenseItems: [{ id: 1, name: 'Custom', amount: 5000, startMonth: 3, recurrence: 'none', endMonth: 3 }],
    });
    // Month 3: 1000 income - 5000 expense = -4000, against a 2000 offset.
    expect(result.monthlyData.map(d => d.offset)).toEqual([1000, 2000, 0]);
    expect(result.monthlyData.map(d => d.cashShortfall)).toEqual([0, 0, 2000]);
    expect(result.totalCashShortfall).toBe(2000);
    expect(result.monthsWithShortfall).toBe(1);
  });

  it('never drives the offset negative, however large the deficit', () => {
    const result = calculateLoanWithOffset({
      ...deficitShared,
      personalExpenseItems: [{ id: 1, name: 'Custom', amount: 500_000, startMonth: 3, recurrence: 'none', endMonth: 3 }],
    });
    // The floor is load-bearing, not defensive: a negative offset would make
    // effectiveBalance exceed the real balance and inflate interest, breaking
    // the re-amortization guarantee that a loan pays off exactly at term end
    // (the two multi-rate-change tests above are the regression canary).
    result.monthlyData.forEach((d) => {
      expect(d.offset).toBeGreaterThanOrEqual(0);
      expect(d.effectiveBalance).toBeGreaterThanOrEqual(0);
    });
    expect(result.monthlyData[2].offset).toBe(0);
    // Month 3 net = 1000 income - 500000 expense = -499000, minus the 2000
    // the offset could cover.
    expect(result.monthlyData[2].cashShortfall).toBe(497_000);
  });

  it('makes no ETF contribution in a deficit month - you cannot invest money you do not have', () => {
    const result = calculateLoanWithOffset({
      ...deficitShared,
      etfAllocationPct: 50,
    });
    // Months 1-2 split 1000 evenly; month 3's deficit adds nothing to ETF.
    expect(result.monthlyData.map(d => d.etf)).toEqual([500, 1000, 1000]);
  });
});

describe('every knob combined at once (regression safety net)', () => {
  it('composes effectiveTaxRate + etfAllocationPct + switchThresholdPct all together without crashing or producing garbage', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      incomeSources: [{ id: 1, name: 'Salary/Wages', amount: 300, isGross: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH }],
      monthlyToOffset: 1000,
      loanAmount: 10_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 50,
      expectedEtfReturn: 12,
      effectiveTaxRate: 20,
      switchThresholdPct: 5,
      maxMonths: 6,
    });
    expect(result.monthlyData).toHaveLength(6);
    result.monthlyData.forEach((d) => {
      expect(Number.isFinite(d.offset)).toBe(true);
      expect(Number.isFinite(d.savings)).toBe(true);
      expect(Number.isFinite(d.etf)).toBe(true);
      expect(d.offset).toBeGreaterThanOrEqual(0);
      expect(d.savings).toBeGreaterThanOrEqual(0);
      expect(d.etf).toBeGreaterThanOrEqual(0);
    });
    // No withdrawals are modeled anywhere in this loop - savings and etf can
    // only ever grow across months in this setup.
    for (let i = 1; i < result.monthlyData.length; i++) {
      expect(result.monthlyData[i].savings).toBeGreaterThanOrEqual(result.monthlyData[i - 1].savings);
      expect(result.monthlyData[i].etf).toBeGreaterThanOrEqual(result.monthlyData[i - 1].etf);
    }
  });
});

describe('ETF delayed start (etfStartMonth, TODO-144a)', () => {
  const shared = {
    contributions: [],
    personalExpenseItems: [],
    monthlyToOffset: 1000,
    loanAmount: 10_000_000,
    monthlyRate: 0,
    monthlyPayment: 100,
    etfAllocationPct: 100,
    maxMonths: 5,
  };

  it('matches the plain path exactly when omitted or set to 1 - no regression', () => {
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitOne = calculateLoanWithOffset({ ...shared, etfStartMonth: 1 });
    expect(withExplicitOne).toEqual(withDefault);
    // Every month's surplus reaches the ETF from month 1.
    expect(withDefault.monthlyData.map(d => d.etf)).toEqual([1000, 2000, 3000, 4000, 5000]);
  });

  it('sends the whole surplus to the offset until the start month, then to the ETF', () => {
    const result = calculateLoanWithOffset({ ...shared, etfStartMonth: 3 });
    // Months 1-2 invest nothing; month 3 onward invests the full surplus.
    expect(result.monthlyData.map(d => d.etf)).toEqual([0, 0, 1000, 2000, 3000]);
    // The two skipped months' surplus went to the offset instead - nothing lost.
    expect(result.monthlyData[1].offset).toBe(2000);
  });

  // Unlike the ratio and reserve gates, a month counter is genuinely monotonic:
  // once reached it can never un-trigger.
  it('never un-triggers once the start month is reached', () => {
    const result = calculateLoanWithOffset({ ...shared, etfStartMonth: 2, maxMonths: 6 });
    const etfDeltas = result.monthlyData.slice(1).map((d, i) => d.etf - result.monthlyData[i].etf);
    // Month 2 onward every delta is positive; only the first is 0.
    expect(etfDeltas.every(delta => delta > 0)).toBe(true);
    expect(result.monthlyData[0].etf).toBe(0);
  });

  it('invests nothing at all when the start month is past the simulation end', () => {
    const result = calculateLoanWithOffset({ ...shared, etfStartMonth: 99 });
    expect(result.monthlyData.every(d => d.etf === 0)).toBe(true);
  });
});

describe('ETF reserve-gated start (etfReserveMonths, TODO-144b)', () => {
  const shared = {
    contributions: [],
    personalExpenseItems: [],
    monthlyToOffset: 1000,
    loanAmount: 10_000_000,
    monthlyRate: 0,
    monthlyPayment: 100,
    etfAllocationPct: 100,
    maxMonths: 6,
  };

  it('matches the plain path exactly when omitted or set to 0 - no regression', () => {
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, etfReserveMonths: 0 });
    expect(withExplicitZero).toEqual(withDefault);
  });

  // One month of outgoings here is just the $100 installment (no property or
  // personal expenses in this fixture), so a 5-month reserve is $500.
  //
  // The gate reads the offset balance BEFORE this month's surplus lands (same
  // convention the ratio gate already used), so month 1 always sees an empty
  // offset and can never satisfy a non-zero reserve - the delay is at least one
  // month by construction.
  it('holds the ETF share at 0 for month 1 whatever the reserve, since the offset starts empty', () => {
    const result = calculateLoanWithOffset({ ...shared, etfReserveMonths: 5 });
    expect(result.monthlyData[0].etf).toBe(0);
    // Month 1's whole surplus went to the offset, which now clears the $500
    // reserve, so month 2 invests.
    expect(result.monthlyData[1].etf).toBe(1000);
  });

  it('delays further while the reserve is larger than one month of surplus', () => {
    // A 25-month reserve is $2,500 of outgoings; at $1,000/month of surplus the
    // offset only clears it after three months have accumulated.
    const result = calculateLoanWithOffset({ ...shared, etfReserveMonths: 25 });
    expect(result.monthlyData.slice(0, 3).map(d => d.etf)).toEqual([0, 0, 0]);
    // Month 4's gate sees $3,000 banked, past the $2,500 reserve.
    expect(result.monthlyData[3].etf).toBeGreaterThan(0);
  });

  it('uses the Emergency Buffer definition of a month - installment plus property AND personal expenses', () => {
    // Adding a $400/month personal expense raises one month of outgoings from
    // $100 to $500, so the same etfReserveMonths demands an 8x bigger offset
    // ($800 -> $4,000) AND leaves less surplus to build it with - both push the
    // ETF start later. If the denominator ignored personal expenses these two
    // runs would start in the same month.
    const withoutExpense = calculateLoanWithOffset({ ...shared, etfReserveMonths: 8, maxMonths: 12 });
    const withExpense = calculateLoanWithOffset({
      ...shared,
      etfReserveMonths: 8,
      maxMonths: 12,
      personalExpenseItems: [{ id: 1, name: 'Groceries', amount: 400, startMonth: 1, recurrence: 'monthly', endMonth: 360 }],
    });
    const firstInvestingMonth = (r) => r.monthlyData.findIndex(d => d.etf > 0);
    expect(firstInvestingMonth(withoutExpense)).toBe(1);
    expect(firstInvestingMonth(withExpense)).toBe(7);
  });

  // The reserve is deliberately re-evaluated every month rather than latching:
  // if the offset falls back below the reserve, pausing new contributions until
  // it recovers is the behaviour a reserve is for.
  it('pauses investing again if the offset falls back below the reserve', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      // A big one-off expense in month 3 drains the offset back down.
      personalExpenseItems: [{ id: 1, name: 'Car repair', amount: 2500, startMonth: 3, recurrence: 'none' }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      etfAllocationPct: 100,
      etfReserveMonths: 5,
      maxMonths: 4,
    });
    const etfDeltas = result.monthlyData.slice(1).map((d, i) => d.etf - result.monthlyData[i].etf);
    // At least one month after the first contributed nothing - the gate closed
    // again rather than staying latched open.
    expect(etfDeltas.some(delta => delta === 0)).toBe(true);
  });
});

describe('ETF market-drop stress test (etfCrashMonth/etfCrashPct, TODO-145)', () => {
  const shared = {
    contributions: [],
    personalExpenseItems: [],
    monthlyToOffset: 1000,
    loanAmount: 10_000_000,
    monthlyRate: 0,
    monthlyPayment: 100,
    etfAllocationPct: 100,
    maxMonths: 6,
  };

  it('matches the plain path exactly when omitted or when etfCrashMonth is 0', () => {
    const withDefault = calculateLoanWithOffset(shared);
    const withExplicitZero = calculateLoanWithOffset({ ...shared, etfCrashMonth: 0, etfCrashPct: 30 });
    expect(withExplicitZero).toEqual(withDefault);
  });

  it('drops the standing ETF balance by the crash percentage in that month', () => {
    const noCrash = calculateLoanWithOffset(shared);
    const crashed = calculateLoanWithOffset({ ...shared, etfCrashMonth: 3, etfCrashPct: 30 });
    // Months 1-2 are untouched.
    expect(crashed.monthlyData[0].etf).toBe(noCrash.monthlyData[0].etf);
    expect(crashed.monthlyData[1].etf).toBe(noCrash.monthlyData[1].etf);
    // Month 3: the $2,000 standing balance drops 30% to $1,400, then that
    // month's own $1,000 contribution lands on top - so $2,400, not $2,100.
    expect(noCrash.monthlyData[2].etf).toBe(3000);
    expect(crashed.monthlyData[2].etf).toBe(2400);
  });

  // The documented ordering choice: a crash hits standing holdings, not money
  // contributed in the crash month itself.
  it('leaves the crash month\'s own contribution intact', () => {
    const crashed = calculateLoanWithOffset({ ...shared, etfCrashMonth: 3, etfCrashPct: 100 });
    // A total wipeout of the standing balance still leaves that month's $1,000.
    expect(crashed.monthlyData[2].etf).toBe(1000);
  });

  // THE invariant the whole feature rests on, and the thing most likely to
  // break silently if anyone later adds ETF liquidation.
  it('cannot change payoff time, total interest, or the reported cash shortfall', () => {
    const params = {
      contributions: [],
      // A deficit month, so totalCashShortfall is genuinely exercised.
      personalExpenseItems: [{ id: 1, name: 'Car repair', amount: 9000, startMonth: 4, recurrence: 'none' }],
      monthlyToOffset: 1000,
      loanAmount: 500_000,
      monthlyRate: 0.005,
      monthlyPayment: 3000,
      etfAllocationPct: 100,
      expectedEtfReturn: 8,
      maxMonths: 24,
    };
    const noCrash = calculateLoanWithOffset(params);
    const crashed = calculateLoanWithOffset({ ...params, etfCrashMonth: 2, etfCrashPct: 40 });

    expect(crashed.months).toBe(noCrash.months);
    expect(crashed.totalInterest).toBe(noCrash.totalInterest);
    expect(crashed.totalCashShortfall).toBe(noCrash.totalCashShortfall);
    expect(crashed.monthsWithShortfall).toBe(noCrash.monthsWithShortfall);
    // The ETF balance IS lower - so the crash did fire, it just can't reach the
    // loan side. Without this the assertions above would pass trivially.
    expect(crashed.monthlyData.at(-1).etf).toBeLessThan(noCrash.monthlyData.at(-1).etf);
  });

  it('never fires when the crash month is past the end of the simulation', () => {
    const noCrash = calculateLoanWithOffset(shared);
    const crashed = calculateLoanWithOffset({ ...shared, etfCrashMonth: 99, etfCrashPct: 50 });
    expect(crashed).toEqual(noCrash);
  });

  // A one-off shock, not a permanent state change.
  it('is a single event - the balance regrows from later contributions', () => {
    const crashed = calculateLoanWithOffset({ ...shared, etfCrashMonth: 2, etfCrashPct: 100 });
    // Month 2 is wiped to just its own contribution, then months 3+ add more.
    expect(crashed.monthlyData[1].etf).toBe(1000);
    expect(crashed.monthlyData[2].etf).toBe(2000);
    expect(crashed.monthlyData[3].etf).toBe(3000);
  });
});
