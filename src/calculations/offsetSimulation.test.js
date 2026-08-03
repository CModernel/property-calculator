import { describe, it, expect } from 'vitest';
import { calculateLoanWithOffset } from './offsetSimulation';
import { getMonth1Offset, calculateInitialPrincipal, calculateInitialMonthlyInterest } from './loan';

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
    expect(result).toEqual({ years: 999, totalInterest: 999999, monthlyData: [] });
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
      exceptExpenses: [{ type: 'one-time', month: 1, amount: 1000 }],
      monthlyToOffset: 500,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 600,
      maxMonths: 1,
    });
    expect(result.monthlyData[0].offset).toBe(0);
  });

  it('applies a "period" recurring expense only within the inclusive start/end month range', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      exceptExpenses: [{ type: 'recurring', recurrence: 'period', startMonth: 3, endMonth: 5, amount: 400 }],
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

  it('applies a "forever" recurring expense in every month, including far into the future', () => {
    const result = calculateLoanWithOffset({
      contributions: [],
      exceptExpenses: [{ type: 'recurring', recurrence: 'forever', amount: 300 }],
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

  it('agrees with the standalone initialMonthlyInterest calculation when there is no ongoing surplus (month 1)', () => {
    // These two computations (loan.js's initialMonthlyInterest, used for the
    // Timeline Explorer's month-0 display, vs. this loop's own month-1 entry)
    // are separate code paths that happen to agree here. If monthlyToOffset
    // were nonzero, this month's extra deposit would push the loop's number
    // below the standalone one - that's a known, accepted difference, not a
    // bug, but this test acts as a tripwire in case the formulas drift apart
    // unintentionally in the zero-surplus case.
    const loanAmount = 100000;
    const monthlyRate = 0.005;
    const contributions = [{ month: 1, amount: 20000 }];

    const month1Offset = getMonth1Offset(contributions);
    const initialPrincipal = calculateInitialPrincipal(loanAmount, month1Offset);
    const initialMonthlyInterest = calculateInitialMonthlyInterest(initialPrincipal, monthlyRate);

    const result = calculateLoanWithOffset({
      contributions,
      exceptExpenses: [],
      monthlyToOffset: 0,
      loanAmount,
      monthlyRate,
      monthlyPayment: 600,
    });

    expect(result.monthlyData[0].monthlyInterestPaid).toBe(Math.round(initialMonthlyInterest));
  });
});
