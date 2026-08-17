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

// TODO-138: keys for the return-sensitivity trio (see runReturnScenarios).
export const CONSERVATIVE = 'conservative';
export const CENTRAL = 'central';
export const FAVOURABLE = 'favourable';

// TODO-145: the crash severities the stress test runs, plus the no-crash
// baseline it compares against. The baseline is the user's OWN current
// projection rather than an invented reference, so the "vs no crash" figures
// answer "what would this cost me" rather than "how do I compare to some
// other strategy".
export const NO_CRASH = 'noCrash';
export const CRASH_SEVERITIES = [20, 30, 40];

// How far either side of the user's own Expected ETF Return the low/high
// scenarios sit. Deliberately a band around THEIR assumption rather than
// absolute figures this app declares "conservative" - the point is to show
// how sensitive the outcome is to a number nobody can know, not to assert
// what that number should be.
export const RETURN_SCENARIO_SPREAD = 3;

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

// TODO-138: the same three-run shape as runStrategyScenarios above, but
// holding the allocation fixed and varying the EXPECTED RETURN instead -
// "how much does this bet depend on my guess about the market?".
//
// Sibling rather than a parameter on runStrategyScenarios: that function's
// exact 3-element shape and 2-arg signature are pinned by its own tests, and
// every downstream helper here (hasUsableData/summariseStrategy/
// getComparisonMonths/buildComparisonRows) is already agnostic about WHICH
// knob varied, so a second factory costs nothing.
//
// Worth knowing for etfBreakEven.js: expectedEtfReturn cannot change the
// payoff month. etfBalance is written in only three places in
// offsetSimulation.js and never read by the loan side, so a different return
// moves the ETF balance and nothing else - all three runs here finish in the
// same month, which is what makes them directly comparable (and what makes
// bisection over the return valid).
export function runReturnScenarios(baseParams, etfAllocationPct, centralReturn, spread = RETURN_SCENARIO_SPREAD) {
  const run = (expectedEtfReturn) => calculateLoanWithOffset({ ...baseParams, etfAllocationPct, expectedEtfReturn });
  // Clamped at 0: a central assumption below the spread would otherwise
  // produce a negative "conservative" return, which models something quite
  // different (a permanent decline) than "lower than you hoped".
  const low = Math.max(0, centralReturn - spread);
  const high = centralReturn + spread;
  return [
    { key: CONSERVATIVE, label: `Conservative (${low}%)`, etfAllocationPct, expectedEtfReturn: low, simulation: run(low) },
    { key: CENTRAL, label: `Your assumption (${centralReturn}%)`, etfAllocationPct, expectedEtfReturn: centralReturn, simulation: run(centralReturn) },
    { key: FAVOURABLE, label: `Favourable (${high}%)`, etfAllocationPct, expectedEtfReturn: high, simulation: run(high) },
  ];
}

// TODO-145: the same sibling-factory shape again, this time holding everything
// fixed and varying only a one-off market drop - "how much does this bet
// actually put at risk?". Consumed by the identical downstream helpers, for the
// same reason runReturnScenarios spelled out above.
//
// The invariant that makes these runs comparable is the same one that makes
// runReturnScenarios' bisection valid, and here it's even stronger: a crash
// only ever touches etfBalance (offsetSimulation.js's single `etfBalance *=`
// line), and the loan side never reads etfBalance, so EVERY run below finishes
// in the same month with the same totalInterest. That's not a limitation of the
// stress test - it's the finding it exists to report, and the UI states it.
export function runCrashScenarios(baseParams, etfAllocationPct, etfCrashMonth, severities = CRASH_SEVERITIES) {
  const run = (etfCrashPct) => calculateLoanWithOffset({
    ...baseParams, etfAllocationPct, etfCrashMonth, etfCrashPct,
  });
  return [
    // etfCrashPct 0 would be equally inert, but going through etfCrashMonth: 0
    // exercises the same "no crash at all" path a caller who omits the params
    // entirely would take.
    { key: NO_CRASH, label: 'No crash', etfAllocationPct, etfCrashPct: 0, simulation: calculateLoanWithOffset({ ...baseParams, etfAllocationPct, etfCrashMonth: 0, etfCrashPct: 0 }) },
    ...severities.map((pct) => ({
      key: `crash${pct}`,
      label: `-${pct}%`,
      etfAllocationPct,
      etfCrashPct: pct,
      simulation: run(pct),
    })),
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
