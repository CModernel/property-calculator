import { describe, it, expect } from 'vitest';
import { calculateLoanWithOffset } from './offsetSimulation';
import { calculateMonthlyRate, calculateMonthlyPayment, calculateMonthlyFromWeekly } from './loan';
import { MAX_MONTH } from './recurringAmount';
import { calculateCompoundedValue } from './growthRate';

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
    expect(result).toEqual({ years: 999, months: 360, totalInterest: 999999, totalSavingsInterest: 0, monthlyData: [] });
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

describe('offset vs. savings split (offsetAllocationPct/initialSavingsBalance, TODO-49)', () => {
  it('defaults to sending 100% of the surplus to the offset, savings stays at 0', () => {
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

  it('splits the monthly surplus between offset and savings by offsetAllocationPct', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      offsetAllocationPct: 70,
      maxMonths: 3,
    });
    expect(result.monthlyData.map(d => d.offset)).toEqual([700, 1400, 2100]);
    expect(result.monthlyData.map(d => d.savings)).toEqual([300, 600, 900]);
  });

  it('seeds the running savings balance from initialSavingsBalance and accumulates on top', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      offsetAllocationPct: 0,
      initialSavingsBalance: 5000,
      maxMonths: 3,
    });
    // Every dollar of surplus goes to savings, none to the offset.
    expect(result.monthlyData.map(d => d.offset)).toEqual([0, 0, 0]);
    expect(result.monthlyData.map(d => d.savings)).toEqual([6000, 7000, 8000]);
  });

  it('passing offsetAllocationPct: 100 explicitly matches omitting it entirely', () => {
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
    const withExplicit100 = calculateLoanWithOffset({ ...shared, offsetAllocationPct: 100, initialSavingsBalance: 0 });
    expect(withExplicit100).toEqual(withDefault);
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
      offsetAllocationPct: 70,
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
      offsetAllocationPct: 100, // every dollar of surplus goes to offset, none to savings
      initialSavingsBalance: 10000,
      savingsInterestRate: 12, // -> exactly 1%/month via calculateMonthlyRate
      maxMonths: 3,
    });
    // No deposits reach savings (offsetAllocationPct: 100) - growth is pure
    // interest: 10000 -> 10100 -> 10201 -> 10303.01 (rounded to 10303).
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
