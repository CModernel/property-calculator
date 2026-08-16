import { calculateLoanWithOffset } from './offsetSimulation';
import { getTimelineSnapshot } from './timelineSnapshot';

// TODO-137: three named strategies compared side by side against IDENTICAL
// inputs, so the only thing that differs is where the monthly surplus goes.
// Deliberately not a "which is best" ranking - 100% ETF is a boundary marker
// for the comparison, never a recommendation (see TODO-138's out-of-scope
// list and strategyComparison.js's own "show the spread, not a winner" note).
//
// Distinct from strategyComparison.js, which grid-searches 441
// (switchThresholdPct x etfAllocationPct) pairs for a Pareto front. This
// module answers the narrower, more legible question: given the allocation
// you have actually chosen, how does it sit between the two extremes?
export const OFFSET_ONLY = 'offsetOnly';
export const CUSTOM = 'custom';
export const ALL_ETF = 'allEtf';

// Rows every 12 months once the projection is long enough for that to
// produce a useful number of them. TODO-137's own edge case: a loan with a
// year or two left would otherwise render a table with 0 or 1 row.
export const YEARLY_STEP_MIN_MONTHS = 24;

// Metrics the year-by-year table can plot. `accessibleCash` deliberately
// excludes the ETF balance - money you can reach without selling an
// investment is exactly the distinction this whole comparison exists to
// show. See summariseStrategy below for the same reasoning.
export const COMPARISON_METRICS = [
  { key: 'netWorth', label: 'Net worth', from: (s) => s.propertyValue - s.balance + s.offset + s.savings + s.etf },
  { key: 'offset', label: 'Offset balance', from: (s) => s.offset },
  { key: 'etf', label: 'ETF balance', from: (s) => s.etf },
  { key: 'accessibleCash', label: 'Accessible cash', from: (s) => s.offset + s.savings },
  { key: 'balance', label: 'Loan balance', from: (s) => s.balance },
  { key: 'totalInterestPaid', label: 'Interest paid so far', from: (s) => s.totalInterestPaid },
  { key: 'propertyEquity', label: 'Property equity', from: (s) => s.propertyValue - s.balance },
];

export function getComparisonMetric(key) {
  return COMPARISON_METRICS.find((m) => m.key === key) ?? COMPARISON_METRICS[0];
}

// `baseParams` is the same bundle App.jsx already builds for the Pareto grid -
// everything except the two strategy knobs. Only etfAllocationPct varies here;
// switchThresholdPct rides along from baseParams so the comparison reflects
// the user's actual configured trigger rather than silently assuming 0.
export function runStrategyScenarios(baseParams, customEtfAllocationPct) {
  const run = (etfAllocationPct) => calculateLoanWithOffset({ ...baseParams, etfAllocationPct });
  return [
    {
      key: OFFSET_ONLY,
      label: 'Offset only',
      etfAllocationPct: 0,
      description: 'Every surplus dollar reduces the loan. The predictable reference.',
      simulation: run(0),
    },
    {
      key: CUSTOM,
      label: 'Your split',
      etfAllocationPct: customEtfAllocationPct,
      description: 'Your configured ETF allocation.',
      simulation: run(customEtfAllocationPct),
    },
    {
      key: ALL_ETF,
      label: 'All to ETF',
      etfAllocationPct: 100,
      description: 'A comparison boundary, not a recommendation.',
      simulation: run(100),
    },
  ];
}

// A run that hit offsetSimulation.js's sentinel early-out has no monthlyData
// at all. The Timeline Explorer short-circuits on the same condition; every
// consumer here has to, or getTimelineSnapshot returns undefined.
export function hasUsableData(runs) {
  return runs.every((r) => r.simulation.monthlyData.length > 0);
}

// End-state figures, one column per strategy. Reuses the same expressions the
// Timeline Explorer renders (net worth, property equity) so the two panels
// cannot drift apart.
export function summariseStrategy(run, { loanAmount, monthZeroInterest, initialSavingsBalance, initialPropertyValue }) {
  const { simulation } = run;
  const last = getTimelineSnapshot(
    simulation.months, simulation.monthlyData, loanAmount, monthZeroInterest, initialSavingsBalance, initialPropertyValue
  );
  return {
    key: run.key,
    label: run.label,
    etfAllocationPct: run.etfAllocationPct,
    payoffMonths: simulation.months,
    totalInterest: Math.round(simulation.totalInterest),
    offset: last.offset,
    etf: last.etf,
    // Money reachable without selling an investment. The ETF balance is
    // excluded on purpose - its illiquidity is the trade-off being compared.
    accessibleCash: last.offset + last.savings,
    netWorth: last.propertyValue - last.balance + last.offset + last.savings + last.etf,
    propertyEquity: last.propertyValue - last.balance,
    totalCashShortfall: Math.round(simulation.totalCashShortfall),
    monthsWithShortfall: simulation.monthsWithShortfall,
  };
}

// The month axis is driven by the LONGEST-running strategy: diverting surplus
// to an ETF slows the payoff, so the strategies finish at different times and
// a shared axis has to cover the slowest. getTimelineSnapshot clamps a
// finished strategy to its final month, which is the correct reading - it
// stopped changing because the loan was gone.
export function getComparisonMonths(runs) {
  const maxMonths = Math.max(...runs.map((r) => r.simulation.months));
  if (maxMonths <= 0) return [];
  const step = maxMonths <= YEARLY_STEP_MIN_MONTHS ? 1 : 12;
  const months = [];
  for (let m = step; m < maxMonths; m += step) months.push(m);
  months.push(maxMonths);
  return months;
}

// Rows for the year-by-year table: one row per month on the shared axis, one
// value per strategy.
export function buildComparisonRows(runs, metricKey, snapshotContext) {
  const metric = getComparisonMetric(metricKey);
  const { loanAmount, monthZeroInterest, initialSavingsBalance, initialPropertyValue } = snapshotContext;
  return getComparisonMonths(runs).map((month) => ({
    month,
    values: runs.map((run) => {
      const snapshot = getTimelineSnapshot(
        month, run.simulation.monthlyData, loanAmount, monthZeroInterest, initialSavingsBalance, initialPropertyValue
      );
      return { key: run.key, value: Math.round(metric.from(snapshot)) };
    }),
  }));
}
