import { describe, it, expect } from 'vitest';
import {
  findBreakEvenEtfReturn,
  BREAK_EVEN_FOUND,
  BREAK_EVEN_NEVER_CATCHES_UP,
  BREAK_EVEN_ALREADY_AHEAD,
  BREAK_EVEN_MAX_RETURN,
} from './etfBreakEven';
import { calculateLoanWithOffset } from './offsetSimulation';
import { getTimelineSnapshot } from './timelineSnapshot';
import { getComparisonMetric } from './strategyScenarios';

const BASE_PARAMS = {
  contributions: [],
  personalExpenseItems: [],
  monthlyToOffset: 1500,
  loanAmount: 300_000,
  monthlyRate: 0.005,
  monthlyPayment: 2000,
  initialSavingsBalance: 20_000,
  savingsInterestRate: 3,
  propertyPrice: 500_000,
  propertyGrowthRate: 5,
  effectiveTaxRate: 30,
  maxMonths: 360,
};

const SNAPSHOT_CONTEXT = {
  loanAmount: 300_000,
  monthZeroInterest: 1500,
  initialSavingsBalance: 20_000,
  initialPropertyValue: 500_000,
};

function netWorthAt(simulation, month) {
  const snapshot = getTimelineSnapshot(
    month, simulation.monthlyData, SNAPSHOT_CONTEXT.loanAmount, SNAPSHOT_CONTEXT.monthZeroInterest,
    SNAPSHOT_CONTEXT.initialSavingsBalance, SNAPSHOT_CONTEXT.initialPropertyValue
  );
  return getComparisonMetric('netWorth').from(snapshot);
}

describe('findBreakEvenEtfReturn', () => {
  it('returns null when nothing is allocated to the ETF - there is no bet to break even on', () => {
    expect(findBreakEvenEtfReturn(BASE_PARAMS, 0, SNAPSHOT_CONTEXT)).toBeNull();
  });

  // The check that would actually catch a wrong answer: take the rate the
  // solver reports, run a genuinely fresh simulation at exactly that rate,
  // and confirm it really does land on parity with offset-only.
  it('round-trips - simulating at the reported rate reproduces net-worth parity', () => {
    const result = findBreakEvenEtfReturn(BASE_PARAMS, 50, SNAPSHOT_CONTEXT);
    expect(result.outcome).toBe(BREAK_EVEN_FOUND);

    const atBreakEven = calculateLoanWithOffset({
      ...BASE_PARAMS, etfAllocationPct: 50, expectedEtfReturn: result.rate,
    });
    const achieved = netWorthAt(atBreakEven, result.horizon);
    // Within a dollar of the offset-only arm it was solving against.
    expect(Math.abs(achieved - result.target)).toBeLessThan(1);
  });

  it('reports a rate that is genuinely a threshold - just below it loses, just above it wins', () => {
    const result = findBreakEvenEtfReturn(BASE_PARAMS, 50, SNAPSHOT_CONTEXT);
    const at = (r) => netWorthAt(
      calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 50, expectedEtfReturn: r }), result.horizon
    );
    expect(at(result.rate - 0.5)).toBeLessThan(result.target);
    expect(at(result.rate + 0.5)).toBeGreaterThan(result.target);
  });

  it('compares both arms at the EARLIER payoff month, where both are still live', () => {
    const result = findBreakEvenEtfReturn(BASE_PARAMS, 50, SNAPSHOT_CONTEXT);
    const offsetOnly = calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 0 });
    const diverted = calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 50, expectedEtfReturn: 8 });
    // Diverting surplus delays the payoff, so offset-only finishes first.
    expect(diverted.months).toBeGreaterThan(offsetOnly.months);
    expect(result.horizon).toBe(offsetOnly.months);
  });

  // The trap this design avoids. Past its payoff a run has no more monthlyData,
  // so a snapshot clamps to its final row - freezing its PROPERTY VALUE along
  // with everything else, even though the property appreciates regardless of
  // which strategy you picked. Comparing at the later month would credit the
  // still-running arm with growth the finished arm silently forfeits.
  it('would be distorted by a frozen property value if it compared at the later month', () => {
    const offsetOnly = calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 0 });
    const diverted = calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 50, expectedEtfReturn: 0 });
    const later = diverted.months;

    const frozenPropertyValue = getTimelineSnapshot(
      later, offsetOnly.monthlyData, SNAPSHOT_CONTEXT.loanAmount, SNAPSHOT_CONTEXT.monthZeroInterest,
      SNAPSHOT_CONTEXT.initialSavingsBalance, SNAPSHOT_CONTEXT.initialPropertyValue
    ).propertyValue;
    const livePropertyValue = getTimelineSnapshot(
      later, diverted.monthlyData, SNAPSHOT_CONTEXT.loanAmount, SNAPSHOT_CONTEXT.monthZeroInterest,
      SNAPSHOT_CONTEXT.initialSavingsBalance, SNAPSHOT_CONTEXT.initialPropertyValue
    ).propertyValue;

    // Same property, same date, same growth rate - the gap is pure artifact.
    expect(livePropertyValue).toBeGreaterThan(frozenPropertyValue);
  });

  // Why bisection is sound at all: a different expected return moves the ETF
  // balance and NOTHING else. If this ever fails, the solver's assumptions are
  // broken and it must be revisited, not just re-tuned.
  it('confirms the return cannot change the payoff month (the property the solver relies on)', () => {
    const months = [0, 5, 12, 30].map((expectedEtfReturn) =>
      calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 50, expectedEtfReturn }).months
    );
    expect(new Set(months).size).toBe(1);
  });

  it('is monotonic - a higher return never produces a lower net worth', () => {
    const horizon = calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 50 }).months;
    const worths = [0, 4, 8, 16, 32].map((r) =>
      netWorthAt(calculateLoanWithOffset({ ...BASE_PARAMS, etfAllocationPct: 50, expectedEtfReturn: r }), horizon)
    );
    for (let i = 1; i < worths.length; i++) {
      expect(worths[i]).toBeGreaterThan(worths[i - 1]);
    }
  });

  it('reports "never catches up" rather than a fake rate when even an implausible return falls short', () => {
    // A 5%-a-month mortgage (deliberately absurd) makes the interest the
    // offset avoids worth more than anything inside the search bracket can
    // earn back over the same window.
    const result = findBreakEvenEtfReturn(
      { ...BASE_PARAMS, monthlyRate: 0.05, monthlyPayment: 16_000 },
      100,
      SNAPSHOT_CONTEXT
    );
    expect(result.outcome).toBe(BREAK_EVEN_NEVER_CATCHES_UP);
    expect(result.rate).toBeNull();
  });

  it('reports "already ahead" rather than 0% when the ETF wins even earning nothing', () => {
    // With no loan interest at all the offset saves nothing, so there is no
    // threshold to clear - quoting "0%" would imply one exists.
    const result = findBreakEvenEtfReturn(
      { ...BASE_PARAMS, monthlyRate: 0 },
      50,
      SNAPSHOT_CONTEXT
    );
    expect(result.outcome).toBe(BREAK_EVEN_ALREADY_AHEAD);
    expect(result.rate).toBe(0);
  });

  // Sanity anchor: the default-ish fixture should land on a rate a real
  // person could plausibly discuss, not an absurd one. If a refactor ever
  // makes this wildly implausible, something is wrong even if the pure
  // round-trip still passes.
  it('produces a plausible figure for an ordinary scenario', () => {
    const result = findBreakEvenEtfReturn(BASE_PARAMS, 50, SNAPSHOT_CONTEXT);
    expect(result.rate).toBeGreaterThan(3);
    expect(result.rate).toBeLessThan(15);
  });

  it('returns null on the sentinel path, where there is no projection to compare', () => {
    const result = findBreakEvenEtfReturn(
      { ...BASE_PARAMS, monthlyToOffset: 0, initialSavingsBalance: 0, savingsInterestRate: 0 },
      50,
      { ...SNAPSHOT_CONTEXT, initialSavingsBalance: 0 }
    );
    expect(result).toBeNull();
  });

  it('never reports a rate outside the searched bracket', () => {
    const result = findBreakEvenEtfReturn(BASE_PARAMS, 25, SNAPSHOT_CONTEXT);
    expect(result.rate).toBeGreaterThanOrEqual(0);
    expect(result.rate).toBeLessThanOrEqual(BREAK_EVEN_MAX_RETURN);
  });
});
