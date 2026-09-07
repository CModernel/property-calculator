import { describe, it, expect } from 'vitest';
import {
  runStrategyScenarios,
  runReturnScenarios,
  summariseStrategy,
  getComparisonMonths,
  buildComparisonRows,
  getComparisonMetric,
  hasUsableData,
  OFFSET_ONLY,
  CUSTOM,
  ALL_ETF,
  CONSERVATIVE,
  CENTRAL,
  FAVOURABLE,
  COMPARISON_METRICS,
  runCrashScenarios,
  NO_CRASH,
  CRASH_SEVERITIES,
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
    // frozen figure, because getTimelineSnapshot clamps to its final row rather
    // than returning undefined.
    //
    // TODO-168 rewrote what this comment used to claim. It said the figure
    // "stopped changing because its loan was covered" and that "a loan is 'paid
    // off' once the offset covers the balance, so that final figure is the
    // offset's size, not zero" - a rationalisation of two separate defects. The
    // engine now retires the loan inside that month's own row, and being frozen
    // is a limit of the simulation (the loop broke), not a fact about the
    // strategy: with no installment left its surplus would really keep growing.
    // buildComparisonRows therefore flags these cells so the table can say so
    // instead of printing a stale figure.
    const settled = rows.filter(r => r.month >= offsetOnlyPayoff)
      .map(r => r.values.find(v => v.key === OFFSET_ONLY).value);
    expect(settled.length).toBeGreaterThan(1);
    expect(new Set(settled).size).toBe(1);
    expect(settled[0]).toBe(runs[0].simulation.monthlyData.at(-1).offset);
  });

  // TODO-168: the defect this entry is named for. The offset-only strategy pays
  // the loan off fastest, and the table reported it as still owing the balance
  // the offset had extinguished for every month after its payoff - so the
  // FASTEST strategy showed the highest loan balance and the lowest property
  // equity at the horizon, the exact inverse of the truth, in the panel whose
  // whole purpose is that comparison.
  describe('the fastest-paying strategy is not reported as the most indebted (TODO-168)', () => {
    it('shows it with the lowest loan balance at the final month', () => {
      const runs = runStrategyScenarios(BASE_PARAMS, 100);
      const rows = buildComparisonRows(runs, 'balance', SNAPSHOT_CONTEXT);
      expect(runs[0].simulation.months).toBeLessThan(Math.max(...runs.map(r => r.simulation.months)));

      const final = rows.at(-1).values;
      const fastest = final.find(v => v.key === OFFSET_ONLY).value;
      const slowest = final.find(v => v.key === ALL_ETF).value;
      expect(fastest).toBe(0);
      expect(fastest).toBeLessThanOrEqual(slowest);
    });

    // TODO-168's verification asked for the fastest strategy to also show the
    // HIGHEST property equity here. It cannot, and the reason is worth writing
    // down: propertyEquity is `propertyValue - balance`, and the clamp freezes
    // BOTH terms. Zeroing the balance removes the phantom debt, but the fast
    // strategy's propertyValue is still stuck at its payoff month while the
    // slow one's keeps compounding at 5%/yr to the horizon - which dominates.
    // Measured on this fixture: 796,562 vs 1,588,483. Cross-strategy
    // comparison past a payoff is not meaningful at all, which is exactly what
    // the settledAtMonth flag exists to say.
    it('credits it with its full property value, no phantom debt subtracted', () => {
      const runs = runStrategyScenarios(BASE_PARAMS, 100);
      const rows = buildComparisonRows(runs, 'propertyEquity', SNAPSHOT_CONTEXT);
      const fastestFinalRow = runs[0].simulation.monthlyData.at(-1);
      const fastest = rows.at(-1).values.find(v => v.key === OFFSET_ONLY).value;

      // Equity is the whole property value now: nothing is still owed against
      // it. Before the fix this was short by the balance the offset had
      // already extinguished.
      expect(fastestFinalRow.balance).toBe(0);
      expect(fastest).toBe(fastestFinalRow.propertyValue);
    });

    it('flags a finished strategy\'s cells with the month it settled, and leaves a live one unflagged', () => {
      const runs = runStrategyScenarios(BASE_PARAMS, 100);
      const rows = buildComparisonRows(runs, 'offset', SNAPSHOT_CONTEXT);
      const offsetOnlyPayoff = runs[0].simulation.months;

      const past = rows.filter(r => r.month > offsetOnlyPayoff);
      expect(past.length).toBeGreaterThan(0);
      past.forEach((r) => {
        expect(r.values.find(v => v.key === OFFSET_ONLY).settledAtMonth).toBe(offsetOnlyPayoff);
        // The slowest strategy defines the axis, so it is never past its own end.
        expect(r.values.find(v => v.key === ALL_ETF).settledAtMonth).toBeNull();
      });
      // At or before its payoff the figures are live, so nothing is flagged.
      rows.filter(r => r.month <= offsetOnlyPayoff).forEach((r) => {
        expect(r.values.find(v => v.key === OFFSET_ONLY).settledAtMonth).toBeNull();
      });
    });
  });

  it('tracks the selected metric', () => {
    const runs = runStrategyScenarios(BASE_PARAMS, 50);
    const etfRows = buildComparisonRows(runs, 'etf', SNAPSHOT_CONTEXT);
    // Offset-only never invests; All-to-ETF always does.
    expect(etfRows.at(-1).values.find(v => v.key === OFFSET_ONLY).value).toBe(0);
    expect(etfRows.at(-1).values.find(v => v.key === ALL_ETF).value).toBeGreaterThan(0);
  });
});

// TODO-138: the sibling factory that holds the allocation fixed and varies
// the expected return instead.
describe('runReturnScenarios', () => {
  it('returns the three return levels in ascending order around the central assumption', () => {
    const runs = runReturnScenarios(BASE_PARAMS, 50, 8);
    expect(runs.map(r => r.key)).toEqual([CONSERVATIVE, CENTRAL, FAVOURABLE]);
    expect(runs.map(r => r.expectedEtfReturn)).toEqual([5, 8, 11]);
  });

  it('holds the allocation fixed across all three - only the return varies', () => {
    const runs = runReturnScenarios(BASE_PARAMS, 40, 8);
    runs.forEach(r => expect(r.etfAllocationPct).toBe(40));
  });

  it('clamps the conservative case at 0 rather than modelling a permanent decline', () => {
    const runs = runReturnScenarios(BASE_PARAMS, 50, 2);
    expect(runs.map(r => r.expectedEtfReturn)).toEqual([0, 2, 5]);
  });

  it('accepts a custom spread', () => {
    const runs = runReturnScenarios(BASE_PARAMS, 50, 8, 5);
    expect(runs.map(r => r.expectedEtfReturn)).toEqual([3, 8, 13]);
  });

  it('a higher assumed return produces a strictly larger ETF balance', () => {
    const [low, mid, high] = runReturnScenarios(BASE_PARAMS, 50, 8)
      .map(r => r.simulation.monthlyData.at(-1).etf);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  // This is the property that makes etfBreakEven.js's bisection valid: the
  // expected return moves the ETF balance and nothing else, so it cannot
  // shift the payoff month or the comparison horizon. Pinned here so a future
  // engine change breaks a test instead of silently invalidating the solver.
  it('cannot change the payoff month - the return never feeds back into the loan', () => {
    const months = runReturnScenarios(BASE_PARAMS, 50, 8, 8).map(r => r.simulation.months);
    expect(new Set(months).size).toBe(1);
  });

  it('works with the existing generic helpers, which do not care which knob varied', () => {
    const runs = runReturnScenarios(BASE_PARAMS, 50, 8);
    expect(hasUsableData(runs)).toBe(true);

    const rows = buildComparisonRows(runs, 'etf', SNAPSHOT_CONTEXT);
    expect(rows.length).toBe(getComparisonMonths(runs).length);
    // Same month, same contributions, three different growth rates.
    const lastRow = rows.at(-1).values.map(v => v.value);
    expect(lastRow[2]).toBeGreaterThan(lastRow[1]);
    expect(lastRow[1]).toBeGreaterThan(lastRow[0]);
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

describe('runCrashScenarios (TODO-145)', () => {
  it('returns a no-crash baseline plus one run per severity', () => {
    const runs = runCrashScenarios(BASE_PARAMS, 50, 60);
    expect(runs.map(r => r.key)).toEqual([NO_CRASH, 'crash20', 'crash30', 'crash40']);
    expect(runs.map(r => r.label)).toEqual(['No crash', '-20%', '-30%', '-40%']);
    expect(runs.map(r => r.etfCrashPct)).toEqual([0, ...CRASH_SEVERITIES]);
  });

  // The invariant that makes the columns directly comparable, and the finding
  // the whole feature reports: a crash cannot reach the loan side.
  it('every run finishes in the same month with the same total interest', () => {
    const runs = runCrashScenarios(BASE_PARAMS, 50, 60);
    const first = runs[0].simulation;
    for (const run of runs.slice(1)) {
      expect(run.simulation.months).toBe(first.months);
      expect(run.simulation.totalInterest).toBe(first.totalInterest);
    }
  });

  it('a worse crash leaves a strictly smaller ETF balance', () => {
    const runs = runCrashScenarios(BASE_PARAMS, 50, 60);
    const finalEtf = runs.map(r => r.simulation.monthlyData.at(-1).etf);
    for (let i = 1; i < finalEtf.length; i++) {
      expect(finalEtf[i]).toBeLessThan(finalEtf[i - 1]);
    }
  });

  // Measured, not assumed: with ongoing contributions the balance grows faster
  // than the lost compounding time costs, so a LATER crash takes a percentage of
  // a much bigger number and ends up costing more. (An earlier version of this
  // test asserted the opposite and passed for a spurious reason - it compared
  // against month 240, which is past this scenario's payoff month, so that run
  // had no crash at all. See the past-payoff case below.)
  it('a later crash costs more than an earlier one, while the loan is still running', () => {
    const finalEtfAfterWorstCrash = (crashMonth) =>
      runCrashScenarios(BASE_PARAMS, 50, crashMonth).at(-1).simulation.monthlyData.at(-1).etf;
    const early = finalEtfAfterWorstCrash(12);
    const mid = finalEtfAfterWorstCrash(48);
    const late = finalEtfAfterWorstCrash(120);
    expect(late).toBeLessThan(mid);
    expect(mid).toBeLessThan(early);
  });

  it('a crash after the loan is paid off never fires - the projection has already ended', () => {
    const runs = runCrashScenarios(BASE_PARAMS, 50, 300);
    const payoffMonths = runs[0].simulation.months;
    expect(payoffMonths).toBeLessThan(300);
    const baselineEtf = runs[0].simulation.monthlyData.at(-1).etf;
    for (const run of runs.slice(1)) {
      expect(run.simulation.monthlyData.at(-1).etf).toBe(baselineEtf);
    }
  });

  it('feeds the same downstream helpers unchanged', () => {
    const runs = runCrashScenarios(BASE_PARAMS, 50, 60);
    expect(hasUsableData(runs)).toBe(true);
    const summary = summariseStrategy(runs[0], {
      loanAmount: BASE_PARAMS.loanAmount,
      monthZeroInterest: 1500,
      initialSavingsBalance: BASE_PARAMS.initialSavingsBalance,
      initialPropertyValue: BASE_PARAMS.propertyPrice,
    });
    expect(summary.netWorth).toBeGreaterThan(0);
    expect(getComparisonMonths(runs).length).toBeGreaterThan(0);
  });

  it('a crash month of 0 makes the whole set identical to the baseline', () => {
    const runs = runCrashScenarios(BASE_PARAMS, 50, 0);
    const baselineEtf = runs[0].simulation.monthlyData.at(-1).etf;
    for (const run of runs.slice(1)) {
      expect(run.simulation.monthlyData.at(-1).etf).toBe(baselineEtf);
    }
  });
});

// A narrower guard for the same class of bug the App-level consistency tests
// cover: a scenario factory must pass every gate through to each run, or a
// panel silently simulates a different strategy than the projection above it.
describe('scenario factories pass the start-timing gates through', () => {
  const GATED = { ...BASE_PARAMS, etfStartMonth: 120 };

  it('runReturnScenarios honours etfStartMonth in every run', () => {
    const ungated = runReturnScenarios(BASE_PARAMS, 50, 8);
    const gated = runReturnScenarios(GATED, 50, 8);
    for (let i = 0; i < gated.length; i++) {
      expect(gated[i].simulation.monthlyData.at(-1).etf)
        .toBeLessThan(ungated[i].simulation.monthlyData.at(-1).etf);
    }
  });

  it('runStrategyScenarios honours etfStartMonth in every run that invests', () => {
    const ungated = runStrategyScenarios(BASE_PARAMS, 50);
    const gated = runStrategyScenarios(GATED, 50);
    // The offset-only arm invests nothing either way, so only the two investing
    // arms can differ - checking all three would pass trivially on the first.
    for (const key of [CUSTOM, ALL_ETF]) {
      const before = ungated.find(r => r.key === key).simulation.monthlyData.at(-1).etf;
      const after = gated.find(r => r.key === key).simulation.monthlyData.at(-1).etf;
      expect(after).toBeLessThan(before);
    }
  });

  it('runCrashScenarios honours etfStartMonth in every run', () => {
    const ungated = runCrashScenarios(BASE_PARAMS, 50, 60);
    const gated = runCrashScenarios(GATED, 50, 60);
    for (let i = 0; i < gated.length; i++) {
      expect(gated[i].simulation.monthlyData.at(-1).etf)
        .toBeLessThan(ungated[i].simulation.monthlyData.at(-1).etf);
    }
  });
});
