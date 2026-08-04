import { describe, it, expect } from 'vitest';
import { calculateLoanWithOffset } from './offsetSimulation';
import { MAX_MONTH } from './recurringAmount';

describe('calculateLoanWithOffset', () => {
  it('returns the sentinel result when there is no surplus and no contributions', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      exceptExpenses: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
    });
    expect(result).toEqual({ years: 999, months: 360, totalInterest: 999999, monthlyData: [] });
  });

  it('always reports a numeric months, on the sentinel path too', () => {
    // The timeline reads `months` for its slider bounds. When the sentinel
    // omitted the key the UI rendered "Middle (NaN)" and "End (undefined)".
    const sentinel = calculateLoanWithOffset({
      contributions: [],
      exceptExpenses: [],
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
      contributions: [{ month: 1, amount: 1000 }],
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      contributions: [{ month: 1, amount: 200000 }],
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [{ startMonth: 1, recurrence: 'none', amount: 1000 }],
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
      exceptExpenses: [{ startMonth: 3, recurrence: 'monthly', endMonth: 5, amount: 400 }],
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
      exceptExpenses: [{ startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH, amount: 300 }],
      monthlyToOffset: 1000,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 300,
    });
    expect(result.monthlyData[0].offset).toBe(700);
    expect(result.monthlyData[299].offset).toBe(700 * 300);
  });

  it('applies scheduled contributions by exact month regardless of array order', () => {
    const result = calculateLoanWithOffset({
      contributions: [{ month: 5, amount: 2000 }, { month: 2, amount: 1000 }],
      exceptExpenses: [],
      monthlyToOffset: 0,
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 6,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([0, 1000, 1000, 1000, 3000, 3000]);
  });

  // Regression guard for the bug where the "Interest Amount (monthly)" panel used
  // (loanAmount - month1Offset) * monthlyRate, silently ignoring the recurring
  // monthly surplus that this loop deposits into the offset in month 1. That made
  // the panel disagree with the Timeline Explorer's own month-1 figure.
  it('subtracts the recurring monthly surplus from month 1 interest, not just the lump sum', () => {
    const loanAmount = 250000;
    const monthlyRate = 0.005;
    const monthlyToOffset = 4000;
    const contributions = [{ month: 1, amount: 20000 }];

    const result = calculateLoanWithOffset({
      contributions,
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
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
      exceptExpenses: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        councilRates: { base: 400, changes: [] }, // quarterly -> $100/month
        insurance: emptyField,
        foodExpenses: emptyField,
        transportExpenses: emptyField,
        otherExpenses: emptyField,
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
      exceptExpenses: [],
      monthlyToOffset: 1000,
      expenseFields: {
        strataFees: emptyField,
        utilities: emptyField,
        // quarterly -> $100/month until month 3, then $800/quarter -> $200/month
        councilRates: { base: 400, changes: [{ startMonth: 3, amount: 800 }] },
        insurance: emptyField,
        foodExpenses: emptyField,
        transportExpenses: emptyField,
        otherExpenses: emptyField,
      },
      loanAmount: 10_000_000,
      monthlyRate: 0,
      monthlyPayment: 100,
      maxMonths: 4,
    });
    const offsets = result.monthlyData.map(d => d.offset);
    expect(offsets).toEqual([900, 1800, 2600, 3400]);
  });
});
