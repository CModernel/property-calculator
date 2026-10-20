import { calculateLoanWithOffset } from './offsetSimulation';
import { hasUsableProjection } from './usableProjection';
import { classifyByBands } from './purchaseHealthCheck';
import { getComparisonMetric } from './strategyScenarios';

// TODO-180: every cell is compared on ONE date, the term end, by net worth -
// the same expression the side-by-side table and Timeline use.
const netWorthOf = getComparisonMetric('netWorth').from;

// TODO-98: the grid this session's own analysis settled on - 5% steps
// (21 values each way = 441 combinations), not the ~2,100 a second
// opinion suggested. Plenty smooth for an illustrative tool; finer
// resolution is a cheap dial to turn up later if ever needed.
const GRID_STEP = 5;
const GRID_VALUES = Array.from({ length: 100 / GRID_STEP + 1 }, (_, i) => i * GRID_STEP);

// Runs calculateLoanWithOffset once per (switchThresholdPct, etfAllocationPct)
// grid cell, holding every other input (baseParams) fixed. Only the last
// monthlyData entry and totalInterest are kept per cell - no need to retain
// 441 full monthlyData arrays just to read their final values.
// TODO-177: App.jsx re-runs this on every render while the panel is open
// (e.g. every Timeline slider step), and each cell now simulates the full
// term. The function is pure, so a single-entry cache on the serialized
// params skips the 441 runs whenever the inputs haven't changed. Callers must
// treat the returned array as read-only (they do: filter/find/copy-then-sort).
let cachedGridKey = null;
let cachedGridResults = null;

export function runStrategyGrid(baseParams) {
  const key = JSON.stringify(baseParams);
  if (key === cachedGridKey) return cachedGridResults;
  const results = [];
  for (const switchThresholdPct of GRID_VALUES) {
    for (const etfAllocationPct of GRID_VALUES) {
      const result = calculateLoanWithOffset({ ...baseParams, switchThresholdPct, etfAllocationPct });
      // TODO-180: every cell is read at the TERM END (it used to be its own
      // payoff month, so cells were compared on different dates and a fast
      // payer got no credit for what it did with the freed-up repayment).
      // That reading collapsed the front in TODO-177 because idle offset cash
      // earned 0% and the objective ignored it; now that cash earns the savings
      // rate after tax (offsetSimulation.js) and the objective is net worth.
      // Empty monthlyData (sentinel, or a loan of a cent) reads as all zeros.
      const last = result.monthlyData.at(-1);
      const etfBalance = last ? last.etf : 0;
      const offsetBalance = last ? last.offset : 0;
      const savingsBalance = last ? last.savings : 0;
      // The returned shortfall totals freeze at payoff (TODO-177), so they
      // would miss a deficit after it - recounted here to the term end, the
      // same window net worth is read on.
      let totalCashShortfall = 0;
      let monthsWithShortfall = 0;
      for (const row of result.monthlyData) {
        if (row.cashShortfall > 0) {
          totalCashShortfall += row.cashShortfall;
          monthsWithShortfall++;
        }
      }
      // A shortfall is money the plan never had - the deficit was simply not
      // paid. Deducted so a cell that ran short (keeping its ETF intact, since
      // the ETF never covers a deficit) can't out-rank one that stayed funded.
      const netWorth = last ? netWorthOf(last) - totalCashShortfall : 0;
      const liquidWealth = etfBalance + offsetBalance + savingsBalance;
      // ETF share of liquid wealth at the term end. Unrounded for dominance
      // and ordering; riskScore is the rounded copy for display.
      const risk = liquidWealth > 0 ? (100 * etfBalance) / liquidWealth : 0;
      results.push({
        switchThresholdPct,
        etfAllocationPct,
        // TODO-167: monthlyData is dropped here (441 arrays is the whole point
        // of this shape), so the row has to carry the verdict itself or no
        // caller can tell a sentinelled cell from a real one. Every cell
        // agrees, since the grid's two axes are not part of the early-out's
        // condition - but say it per row rather than making callers assume.
        hasUsableProjection: hasUsableProjection(result),
        totalInterestPaid: Math.round(result.totalInterest),
        etfBalance,
        offsetBalance,
        netWorth,
        // 0-100 read of realized exposure (cash = 0, ETF = 100), one of the
        // two Pareto axes (TODO-180).
        risk,
        riskScore: Math.round(risk),
        // TODO-143: since TODO-136, a deficit month can drain the offset
        // instead of being silently floored to zero - so a low offsetBalance
        // (and therefore a high riskScore above) doesn't necessarily mean a
        // deliberate high ETF allocation. Surfacing these lets the UI flag a
        // cell that only looks attractive because it ran out of cash.
        // TODO-180: to the term end (see above), not the frozen payoff totals.
        totalCashShortfall,
        monthsWithShortfall,
      });
    }
  }
  cachedGridKey = key;
  cachedGridResults = results;
  return results;
}

// A strategy is non-dominated if no other strategy has both a higher (or
// equal) net worth AND a lower (or equal) risk, with at least one strictly
// better - the classic Pareto-front definition. TODO-180: these axes replaced
// interest paid vs ETF balance; interest paid is already inside net worth.
// Explicitly no weighted "Overall Score" and no single "best" - two
// independent second opinions and this session's own analysis all
// rejected that (see TODO-52's write-up).
export function selectParetoFront(results) {
  const nonDominated = results.filter((row) =>
    !results.some((other) => {
      if (other === row) return false;
      const notWorse = other.netWorth >= row.netWorth && other.risk <= row.risk;
      const strictlyBetter = other.netWorth > row.netWorth || other.risk < row.risk;
      return notWorse && strictlyBetter;
    })
  );

  // Every etfAllocationPct: 0 cell produces an identical outcome
  // regardless of switchThresholdPct (there's nothing to switch on) -
  // dedupe to the simplest (lowest switchThresholdPct, then lowest
  // etfAllocationPct) representative.
  // TODO-143: the key includes shortfall status so a cell that only matches
  // another on interest/ETF balance because it ran out of cash never
  // silently replaces (or gets replaced by) a healthy one - the two are
  // treated as genuinely different outcomes, not duplicates.
  const seen = new Map();
  const sorted = [...nonDominated].sort(
    (a, b) => a.switchThresholdPct - b.switchThresholdPct || a.etfAllocationPct - b.etfAllocationPct
  );
  for (const row of sorted) {
    const key = `${row.netWorth}-${row.risk}-${row.totalCashShortfall > 0}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  const deduped = [...seen.values()].sort((a, b) => a.risk - b.risk);

  if (deduped.length <= 5) return deduped;

  // Show the spread, not a "winner" - 5 evenly-spaced points across the
  // front by risk, from lowest-risk to highest-risk.
  const sampleCount = 5;
  const indices = Array.from({ length: sampleCount }, (_, i) =>
    Math.round((i * (deduped.length - 1)) / (sampleCount - 1))
  );
  return [...new Set(indices)].map((i) => deduped[i]);
}

// TODO-98: "what if ETFs fall 30%?" - mirrors purchaseHealthCheck.js's own
// Interest Rate Stress Test pattern exactly (descending-severity ladder,
// classifyByBands). TODO-180: "survived" means this strategy's net worth at
// the term end, with its ETF cut by the crash, is still at or above Offset
// only's - it used to compare the ETF balance against the extra interest paid,
// on each strategy's own payoff date.
export const ETF_CRASH_BANDS = [
  { min: 50, label: 'Very resilient', symbol: '🟢', textClass: 'text-green-700 dark:text-green-400', critical: false, action: 'Still ahead of Offset only even after a 50% crash.' },
  { min: 30, label: 'Resilient', symbol: '🟢', textClass: 'text-green-700 dark:text-green-400', critical: false, action: 'Still ahead of Offset only after a 30% crash.' },
  // TODO-180: from 0, not 10 - a strategy that is ahead but would fall behind
  // after a 10% crash is fragile, not "already behind" as it used to read.
  { min: 0, label: 'Fragile', symbol: '🟠', textClass: 'text-orange-700 dark:text-orange-400', critical: false, action: 'A larger crash would leave you behind where Offset only would have left you.' },
  { min: -Infinity, label: 'Already behind', symbol: '🔴', textClass: 'text-red-700 dark:text-red-400', critical: true, action: 'Even without a crash, this strategy ends behind Offset only.' },
];

// netWorthLead = this strategy's term-end net worth minus Offset only's.
// Returns the largest crash survived (50/30/10), 0 when ahead but a 10% crash
// would put it behind, -1 when already behind, and null with no ETF at all
// (nothing to crash - Offset only itself).
export function calculateEtfCrashSurvivedPct(etfBalance, netWorthLead) {
  if (!(etfBalance > 0)) return null;
  if (netWorthLead < 0) return -1;
  for (const crash of [50, 30, 10]) {
    if (etfBalance * (crash / 100) <= netWorthLead) return crash;
  }
  return 0;
}

export function classifyEtfCrash(survivedPct) {
  return classifyByBands(survivedPct, ETF_CRASH_BANDS);
}
