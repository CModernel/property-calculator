import { describe, it, expect } from 'vitest';
import {
  runStrategyScenarios,
  summariseStrategy,
  getComparisonMonths,
  buildComparisonRows,
  getComparisonMetric,
  hasUsableData,
  OFFSET_ONLY,
  CUSTOM,
  ALL_ETF,
  COMPARISON_METRICS,
} from './strategyScenarios';

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
  expectedEtfReturn: 8,
  effectiveTaxRate: 30,
  maxMonths: 360,
};

const SNAPSHOT_CONTEXT = {
  loanAmount: 300_000,
  monthZeroInterest: 1500,
  initialSavingsBalance: 20_000,
  initialPropertyValue: 500_000,
};

describe('runStrategyScenarios', () => {
  it('returns the three strategies in ascending ETF exposure', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 40);
    expect(runs.map(r => r.key)).toEqual([OFFSET_ONLY, CUSTOM, ALL_ETF]);
    expect(runs.map(r => r.etfAllocationPct)).toEqual([0, 40, 100]);
  });

  it('varies only etfAllocationPct - a 0% custom is byte-identical to Offset only', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 0);
    expect(runs[1].simulation).toEqual(runs[0].simulation);
  });

  it('a 100% custom is byte-identical to All to ETF', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 100);
    expect(runs[1].simulation).toEqual(runs[2].simulation);
  });

  it('diverting to an ETF slows the payoff and costs more interest than offset only', () => {
    const [offsetOnly, , allEtf] = runStrategyScenarios(BASE_PARAMS, 50);
    expect(allEtf.simulation.months).toBeGreaterThan(offsetOnly.simulation.months);
    expect(allEtf.simulation.totalInterest).toBeGreaterThan(offsetOnly.simulation.totalInterest);
    expect(offsetOnly.simulation.monthlyData.at(-1).etf).toBe(0);
  });

  it('honours switchThresholdPct from baseParams rather than assuming 0', () => {
    const gated = runStrategyScenarios({ ...BASE_PARAMS, switchThresholdPct: 100 }, 100);
    // A threshold the offset can never reach keeps every dollar in the offset,
    // making even the "All to ETF" run identical to offset-only.
    expect(gated[2].simulation.monthlyData.at(-1).etf).toBe(0);
  });
});

describe('hasUsableData', () => {
  it('is false when a run hit the sentinel early-out (no monthlyData)', () => {
    const runs = runStrategyScenarios(
      { ...BASE_PARAMS, monthlyToOffset: 0, initialSavingsBalance: 0, savingsInterestRate: 0 },
      50
    );
    expect(runs[0].simulation.monthlyData).toHaveLength(0);
    expect(hasUsableData(runs)).toBe(false);
  });

  it('is true for a normal projection', () => {
    expect(hasUsableData(runStrategyScenarios(BASE_PARAMS, 50))).toBe(true);
  });
});

describe('summariseStrategy', () => {
  it('reports accessible cash as offset + savings, deliberately excluding the ETF balance', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const summary = summariseStrategy(runs[1], SNAPSHOT_CONTEXT);
    const last = runs[1].simulation.monthlyData.at(-1);

    expect(summary.accessibleCash).toBe(last.offset + last.savings);
    expect(last.etf).toBeGreaterThan(0);
    expect(summary.accessibleCash).not.toBe(last.offset + last.savings + last.etf);
  });

  it('uses the same net worth and equity expressions as the Timeline Explorer', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const summary = summariseStrategy(runs[1], SNAPSHOT_CONTEXT);
    const l = runs[1].simulation.monthlyData.at(-1);

    expect(summary.netWorth).toBe(l.propertyValue - l.balance + l.offset + l.savings + l.etf);
    expect(summary.propertyEquity).toBe(l.propertyValue - l.balance);
  });

  it('carries the cash-shortfall signal through', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const summary = summariseStrategy(runs[0], SNAPSHOT_CONTEXT);
    expect(summary.totalCashShortfall).toBe(0);
    expect(summary.monthsWithShortfall).toBe(0);
  });
});

describe('getComparisonMonths', () => {
  it('steps yearly and always ends on the longest strategy\'s final month', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const months = getComparisonMonths(runs);
    const longest = Math.max(...runs.map(r => r.simulation.months));

    expect(months.at(-1)).toBe(longest);
    expect(months[0]).toBe(12);
    // Every entry but the last sits on a 12-month boundary.
    months.slice(0, -1).forEach(m => expect(m % 12).toBe(0));
  });

  it('falls back to monthly rows for a short projection, so a sub-2-year loan is not a 1-row table', () => {
    const runs = runStrategyScenarios({ ...BASE_PARAMS, maxMonths: 18 }, 50);
    const months = getComparisonMonths(runs);
    expect(months.length).toBeGreaterThan(2);
    expect(months.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('returns no rows when nothing was simulated', () => {
    expect(getComparisonMonths([{ simulation: { months: 0 } }])).toEqual([]);
  });
});

describe('buildComparisonRows', () => {
  it('produces one value per strategy per row, keyed by strategy', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const rows = buildComparisonRows(runs, 'netWorth', SNAPSHOT_CONTEXT);

    expect(rows).toHaveLength(getComparisonMonths(runs).length);
    rows.forEach((row) => {
      expect(row.values.map(v => v.key)).toEqual([OFFSET_ONLY, CUSTOM, ALL_ETF]);
      row.values.forEach(v => expect(Number.isFinite(v.value)).toBe(true));
    });
  });

  it('clamps a strategy that already paid off to its final state instead of dropping it', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 100);
    const rows = buildComparisonRows(runs, 'offset', SNAPSHOT_CONTEXT);
    const offsetOnlyPayoff = runs[0].simulation.months;
    const longest = Math.max(...runs.map(r => r.simulation.months));
    expect(offsetOnlyPayoff).toBeLessThan(longest);

    // Every row at or past the offset-only run's payoff month reports the same
    // frozen figure - it stopped changing because its loan was covered, and
    // getTimelineSnapshot clamps rather than returning undefined. Note the
    // simulation's own convention: a loan is "paid off" once the offset covers
    // the balance, so that final figure is the offset's size, not zero.
    const settled = rows.filter(r => r.month >= offsetOnlyPayoff)
      .map(r => r.values.find(v => v.key === OFFSET_ONLY).value);
    expect(settled.length).toBeGreaterThan(1);
    expect(new Set(settled).size).toBe(1);
    expect(settled[0]).toBe(runs[0].simulation.monthlyData.at(-1).offset);
  });

  it('tracks the selected metric', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const etfRows = buildComparisonRows(runs, 'etf', SNAPSHOT_CONTEXT);
    // Offset-only never invests; All-to-ETF always does.
    expect(etfRows.at(-1).values.find(v => v.key === OFFSET_ONLY).value).toBe(0);
    expect(etfRows.at(-1).values.find(v => v.key === ALL_ETF).value).toBeGreaterThan(0);
  });
});

describe('getComparisonMetric', () => {
  it('resolves every declared metric key', () => {
    COMPARISON_METRICS.forEach(m => expect(getComparisonMetric(m.key).key).toBe(m.key));
  });

  it('falls back to the first metric for an unknown key rather than returning undefined', () => {
    expect(getComparisonMetric('nope')).toBe(COMPARISON_METRICS[0]);
  });
});
