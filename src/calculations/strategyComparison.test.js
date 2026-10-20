import { describe, it, expect } from 'vitest';
import { calculateLoanWithOffset } from './offsetSimulation';
import { runStrategyGrid, selectParetoFront, calculateEtfCrashSurvivedPct, classifyEtfCrash, ETF_CRASH_BANDS } from './strategyComparison';
import { getComparisonMetric } from './strategyScenarios';

const BASE_PARAMS = {
  contributions: [],
  personalExpenseItems: [],
  monthlyToOffset: 1000,
  loanAmount: 500_000,
  monthlyRate: 0.005,
  monthlyPayment: 3000,
  expectedEtfReturn: 8,
  effectiveTaxRate: 30,
  maxMonths: 24,
};

describe('runStrategyGrid', () => {
  it('runs the full 21x21 (5% step) grid', () => {
    const results = runStrategyGrid(BASE_PARAMS);
    expect(results).toHaveLength(441);
  });

  it('each row carries the grid coordinates plus the computed outcome fields', () => {
    const results = runStrategyGrid(BASE_PARAMS);
    for (const row of results) {
      expect(row).toMatchObject({
        switchThresholdPct: expect.any(Number),
        etfAllocationPct: expect.any(Number),
        totalInterestPaid: expect.any(Number),
        etfBalance: expect.any(Number),
        offsetBalance: expect.any(Number),
        netWorth: expect.any(Number),
        risk: expect.any(Number),
        riskScore: expect.any(Number),
        totalCashShortfall: expect.any(Number),
        monthsWithShortfall: expect.any(Number),
      });
      expect(row.riskScore).toBeGreaterThanOrEqual(0);
      expect(row.riskScore).toBeLessThanOrEqual(100);
      expect(row.totalCashShortfall).toBeGreaterThanOrEqual(0);
      expect(row.monthsWithShortfall).toBeGreaterThanOrEqual(0);
    }
  });

  it('the etfAllocationPct: 0 cells all produce the same (baseline) outcome regardless of switchThresholdPct', () => {
    const results = runStrategyGrid(BASE_PARAMS);
    const zeroAllocationRows = results.filter((r) => r.etfAllocationPct === 0);
    const [first, ...rest] = zeroAllocationRows;
    for (const row of rest) {
      expect(row.totalInterestPaid).toBe(first.totalInterestPaid);
      expect(row.etfBalance).toBe(first.etfBalance);
      expect(row.etfBalance).toBe(0);
      expect(row.riskScore).toBe(0);
    }
  });
});

describe('selectParetoFront', () => {
  it('returns a non-dominated set, capped at 5 rows', () => {
    const front = selectParetoFront(runStrategyGrid(BASE_PARAMS));
    expect(front.length).toBeGreaterThan(0);
    expect(front.length).toBeLessThanOrEqual(5);
    for (const row of front) {
      // TODO-180: net worth (higher) vs risk (lower).
      const dominatedBy = front.find(
        (other) =>
          other !== row &&
          other.netWorth >= row.netWorth &&
          other.risk <= row.risk &&
          (other.netWorth > row.netWorth || other.risk < row.risk)
      );
      expect(dominatedBy).toBeUndefined();
    }
  });

  it('always includes the etfAllocationPct: 0 baseline as the lowest-risk anchor', () => {
    const front = selectParetoFront(runStrategyGrid(BASE_PARAMS));
    const lowestRisk = front[0];
    expect(lowestRisk.etfAllocationPct).toBe(0);
    expect(lowestRisk.etfBalance).toBe(0);
  });

  it('is sorted ascending by risk (lowest-risk to highest-risk)', () => {
    const front = selectParetoFront(runStrategyGrid(BASE_PARAMS));
    for (let i = 1; i < front.length; i++) {
      expect(front[i].risk).toBeGreaterThanOrEqual(front[i - 1].risk);
    }
  });

  it('deduplicates identical outcomes down to a small explicit example', () => {
    const results = [
      { switchThresholdPct: 0, etfAllocationPct: 0, netWorth: 500, risk: 0, riskScore: 0, totalCashShortfall: 0 },
      { switchThresholdPct: 50, etfAllocationPct: 0, netWorth: 500, risk: 0, riskScore: 0, totalCashShortfall: 0 },
      { switchThresholdPct: 0, etfAllocationPct: 50, netWorth: 520, risk: 40, riskScore: 40, totalCashShortfall: 0 },
    ];
    const front = selectParetoFront(results);
    expect(front).toHaveLength(2);
    expect(front[0]).toMatchObject({ switchThresholdPct: 0, etfAllocationPct: 0 });
  });

  // TODO-143: two cells sharing interest/ETF balance used to collapse into
  // one via the dedupe key - if one of them only got there by running out of
  // cash, the dedupe could silently keep the unhealthy one and drop the
  // healthy one (or vice versa). The key now treats shortfall status as part
  // of what makes an outcome distinct.
  it('does not dedupe a shortfall-affected cell into an otherwise-identical healthy one', () => {
    const results = [
      { switchThresholdPct: 0, etfAllocationPct: 30, netWorth: 500, risk: 40, riskScore: 40, totalCashShortfall: 0 },
      { switchThresholdPct: 50, etfAllocationPct: 30, netWorth: 500, risk: 40, riskScore: 40, totalCashShortfall: 500 },
    ];
    const front = selectParetoFront(results);
    expect(front).toHaveLength(2);
    expect(front.map(r => r.totalCashShortfall).sort()).toEqual([0, 500]);
  });
});

// TODO-180: "survived" now means the strategy's net worth, with its ETF cut
// by the crash, is still at or above Offset only's net worth at the term end.
// The second argument is that lead (netWorth - Offset only's netWorth).
describe('calculateEtfCrashSurvivedPct', () => {
  it('survives a smaller crash but not a larger one', () => {
    // A 30% crash costs 300 <= 400 lead; a 50% crash costs 500 > 400.
    expect(calculateEtfCrashSurvivedPct(1000, 400)).toBe(30);
  });

  it('returns 0 when the strategy is ahead but a 10% crash would put it behind', () => {
    // The pre-TODO-180 version called this "Already behind", which was false.
    expect(calculateEtfCrashSurvivedPct(1000, 50)).toBe(0);
    expect(calculateEtfCrashSurvivedPct(1000, 0)).toBe(0);
  });

  it('returns -1 when the strategy is behind before any crash', () => {
    expect(calculateEtfCrashSurvivedPct(1000, -1)).toBe(-1);
  });

  it('returns null for a strategy holding no ETF - there is nothing to crash', () => {
    expect(calculateEtfCrashSurvivedPct(0, 0)).toBeNull();
  });
});

describe('classifyEtfCrash', () => {
  it('matches the ETF_CRASH_BANDS thresholds', () => {
    expect(classifyEtfCrash(50)).toBe(ETF_CRASH_BANDS[0]);
    expect(classifyEtfCrash(30)).toBe(ETF_CRASH_BANDS[1]);
    expect(classifyEtfCrash(10)).toBe(ETF_CRASH_BANDS[2]);
    // TODO-180: ahead, but under a 10% crash's worth - Fragile, not behind.
    expect(classifyEtfCrash(0)).toBe(ETF_CRASH_BANDS[2]);
    expect(classifyEtfCrash(-1)).toBe(ETF_CRASH_BANDS[3]);
  });

  it('classifies an intermediate (non-boundary) value into the correct band', () => {
    expect(classifyEtfCrash(40)).toBe(ETF_CRASH_BANDS[1]); // between 30 and 50 -> "Resilient"
    expect(classifyEtfCrash(75)).toBe(ETF_CRASH_BANDS[0]); // > 50 -> "Very resilient"
  });
});

describe('runStrategyGrid - offset-sim sentinel path', () => {
  it('defaults etfBalance/offsetBalance to 0 without throwing when every grid cell hits the sentinel (empty monthlyData)', () => {
    const results = runStrategyGrid({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
      expectedEtfReturn: 8,
      effectiveTaxRate: 30,
      maxMonths: 24,
    });
    expect(results).toHaveLength(441);
    for (const row of results) {
      expect(row.etfBalance).toBe(0);
      expect(row.offsetBalance).toBe(0);
      expect(row.netWorth).toBe(0);
      expect(row.totalInterestPaid).toBe(999999);
      expect(row.riskScore).toBe(0);
      expect(row.totalCashShortfall).toBe(0);
      expect(row.monthsWithShortfall).toBe(0);
    }
  });

  // TODO-143: end-to-end proof the shortfall fields actually flow from the
  // simulation through the grid, not just a discard-then-add of zeros.
  it('surfaces a real cash shortfall through to the grid row', () => {
    const results = runStrategyGrid({
      contributions: [],
      personalExpenseItems: [
        { id: 1, name: 'Custom', amount: 50_000, startMonth: 6, recurrence: 'none', endMonth: 6 },
      ],
      monthlyToOffset: 1000,
      loanAmount: 500_000,
      monthlyRate: 0.005,
      monthlyPayment: 3000,
      expectedEtfReturn: 8,
      effectiveTaxRate: 30,
      maxMonths: 24,
    });
    const shortfallRows = results.filter((r) => r.totalCashShortfall > 0);
    expect(shortfallRows.length).toBeGreaterThan(0);
    shortfallRows.forEach((row) => expect(row.monthsWithShortfall).toBeGreaterThan(0));
  });
});

describe('selectParetoFront - additional boundary/dominance cases', () => {
  it('returns an empty array when given no results', () => {
    expect(selectParetoFront([])).toEqual([]);
  });

  it('excludes a row that is strictly dominated by another (same net worth, more risk)', () => {
    const results = [
      { switchThresholdPct: 0, etfAllocationPct: 0, netWorth: 500, risk: 20, riskScore: 20, totalCashShortfall: 0 },
      { switchThresholdPct: 50, etfAllocationPct: 50, netWorth: 500, risk: 25, riskScore: 25, totalCashShortfall: 0 },
    ];
    const front = selectParetoFront(results);
    expect(front).toHaveLength(1);
    expect(front[0].risk).toBe(20);
  });

  // Rounded riskScore is for display only: two cells sharing a rounded score
  // must not let the richer one dominate a genuinely less risky one.
  it('decides dominance on the unrounded risk, not the displayed score', () => {
    const results = [
      { switchThresholdPct: 0, etfAllocationPct: 40, netWorth: 500, risk: 40.2, riskScore: 40, totalCashShortfall: 0 },
      { switchThresholdPct: 0, etfAllocationPct: 45, netWorth: 510, risk: 40.4, riskScore: 40, totalCashShortfall: 0 },
    ];
    expect(selectParetoFront(results)).toHaveLength(2);
  });

  it('returns all 5 points unchanged (no sampling) when there are exactly 5 distinct pareto points', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      switchThresholdPct: 0,
      etfAllocationPct: i * 25,
      netWorth: 500 + i * 10,
      etfBalance: i * 25,
      risk: i * 25,
      riskScore: i * 25,
      totalCashShortfall: 0,
    }));
    const front = selectParetoFront(results);
    expect(front).toHaveLength(5);
    expect(front.map(r => r.etfBalance)).toEqual([0, 25, 50, 75, 100]);
  });

  it('returns exactly 5 evenly-spaced points, at the specific sampled indices, when there are 6 distinct pareto points', () => {
    const results = Array.from({ length: 6 }, (_, i) => ({
      switchThresholdPct: 0,
      etfAllocationPct: i * 20,
      netWorth: 500 + i * 10,
      etfBalance: i * 20,
      risk: i * 20,
      riskScore: i * 20,
      totalCashShortfall: 0,
    }));
    const front = selectParetoFront(results);
    expect(front).toHaveLength(5);
    // Indices 0,1,3,4,5 (Math.round(i*5/4) for i=0..4) - index 2 (etf:40) is
    // the one point dropped by the evenly-spaced sampling.
    expect(front.map(r => r.etfBalance)).toEqual([0, 20, 60, 80, 100]);
  });
});

describe('calculateEtfCrashSurvivedPct - additional boundary cases', () => {
  it('treats a crash that lands exactly on Offset only as surviving (<=, not <)', () => {
    // A 50% crash costs exactly the 500 lead -> level with Offset only.
    expect(calculateEtfCrashSurvivedPct(1000, 500)).toBe(50);
  });
});

// TODO-177/180: the engine simulates past payoff and the grid reads EVERY cell
// at the term end (TODO-180 - it used to read each at its own payoff month),
// and caches its last result because App re-runs it every render.
describe('runStrategyGrid after TODO-177', () => {
  const PAYS_OFF = {
    contributions: [],
    personalExpenseItems: [],
    monthlyToOffset: 3000,
    loanAmount: 100_000,
    monthlyRate: 0.005,
    monthlyPayment: 1000,
    expectedEtfReturn: 8,
    effectiveTaxRate: 30,
    maxMonths: 360,
  };

  it('reads every cell at the term end, with the net worth the side-by-side table uses', () => {
    const results = runStrategyGrid(PAYS_OFF);
    for (const cell of [results[0], results[220], results[440]]) {
      const sim = calculateLoanWithOffset({ ...PAYS_OFF, switchThresholdPct: cell.switchThresholdPct, etfAllocationPct: cell.etfAllocationPct });
      expect(sim.months).toBeLessThan(360);
      const termEnd = sim.monthlyData.at(-1);
      expect(termEnd.month).toBe(360);
      expect(cell.etfBalance).toBe(termEnd.etf);
      expect(cell.offsetBalance).toBe(termEnd.offset);
      // No shortfall here, so net worth is exactly COMPARISON_METRICS' figure.
      expect(cell.netWorth).toBe(getComparisonMetric('netWorth').from(termEnd));
      // Risk is the exact ETF share of liquid wealth - rounded only for display.
      const share = (100 * termEnd.etf) / (termEnd.etf + termEnd.offset + termEnd.savings);
      expect(cell.risk).toBe(share);
      expect(cell.riskScore).toBe(Math.round(share));
    }
    // At least one sampled cell has a fractional share, or the check above is vacuous.
    expect([results[220], results[440]].some((c) => !Number.isInteger(c.risk))).toBe(true);
  });

  it('counts savings as cash in the risk denominator', () => {
    const cell = (params) => runStrategyGrid(params).find((r) => r.etfAllocationPct === 100 && r.switchThresholdPct === 0);
    const withSavings = cell({ ...PAYS_OFF, initialSavingsBalance: 200_000 });
    const sim = calculateLoanWithOffset({ ...PAYS_OFF, initialSavingsBalance: 200_000, switchThresholdPct: 0, etfAllocationPct: 100 });
    const end = sim.monthlyData.at(-1);
    expect(end.savings).toBeGreaterThan(0);
    expect(withSavings.risk).toBe((100 * end.etf) / (end.etf + end.offset + end.savings));
  });

  // A loan of a cent or less simulates no months, so its all-zero term-end
  // row ("Net Worth $0") must never reach the table: hasUsableProjection
  // requires rows, and App hides the grid on it.
  it('marks a loan with nothing to repay as unusable, so its $0 net worth is never shown', () => {
    const rows = runStrategyGrid({ ...PAYS_OFF, loanAmount: 0, monthlyPayment: 0 });
    expect(rows.every((r) => !r.hasUsableProjection && r.netWorth === 0)).toBe(true);
  });

  it('keeps Offset only at zero ETF and zero risk to the term end - it never invests', () => {
    const offsetOnly = runStrategyGrid(PAYS_OFF).filter((r) => r.etfAllocationPct === 0);
    for (const row of offsetOnly) {
      expect(row.etfBalance).toBe(0);
      expect(row.risk).toBe(0);
    }
  });

  it('earns the savings rate on Offset only\'s idle cash, so it is no longer a 0% straw man', () => {
    const idle = runStrategyGrid(PAYS_OFF).find((r) => r.etfAllocationPct === 0).netWorth;
    const earning = runStrategyGrid({ ...PAYS_OFF, savingsInterestRate: 4 }).find((r) => r.etfAllocationPct === 0).netWorth;
    expect(earning).toBeGreaterThan(idle);
  });

  // The returned totals freeze at payoff (TODO-177), but the grid reads the
  // term end - so a shortfall AFTER a cell's payoff must still count, and
  // come off its net worth: money the plan never had (Opus plan review).
  it('counts a shortfall after payoff and deducts it from net worth', () => {
    const lateExpense = { ...PAYS_OFF, personalExpenseItems: [{ id: 1, name: 'Custom', amount: 2_000_000, startMonth: 300, recurrence: 'none', endMonth: 300 }] };
    const cell = runStrategyGrid(lateExpense).find((r) => r.etfAllocationPct === 50 && r.switchThresholdPct === 0);
    const sim = calculateLoanWithOffset({ ...lateExpense, switchThresholdPct: 0, etfAllocationPct: 50 });
    expect(sim.totalCashShortfall).toBe(0); // frozen at payoff, before month 300
    const shortfall = sim.monthlyData.reduce((sum, row) => sum + row.cashShortfall, 0);
    expect(shortfall).toBeGreaterThan(0);
    expect(cell.totalCashShortfall).toBe(shortfall);
    expect(cell.monthsWithShortfall).toBeGreaterThan(0);
    expect(cell.netWorth).toBe(getComparisonMetric('netWorth').from(sim.monthlyData.at(-1)) - shortfall);
  });

  it('returns the cached result for identical params and recomputes when they change', () => {
    const first = runStrategyGrid(PAYS_OFF);
    expect(runStrategyGrid({ ...PAYS_OFF })).toBe(first);
    const changed = runStrategyGrid({ ...PAYS_OFF, monthlyToOffset: 2000 });
    expect(changed).not.toBe(first);
    expect(changed[0].totalInterestPaid).not.toBe(first[0].totalInterestPaid);
  });
});
