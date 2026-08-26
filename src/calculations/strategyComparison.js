import { calculateLoanWithOffset } from './offsetSimulation';
import { hasUsableProjection } from './usableProjection';
import { classifyByBands } from './purchaseHealthCheck';

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
export function runStrategyGrid(baseParams) {
  const results = [];
  for (const switchThresholdPct of GRID_VALUES) {
    for (const etfAllocationPct of GRID_VALUES) {
      const result = calculateLoanWithOffset({ ...baseParams, switchThresholdPct, etfAllocationPct });
      const last = result.monthlyData[result.monthlyData.length - 1];
      const etfBalance = last ? last.etf : 0;
      const offsetBalance = last ? last.offset : 0;
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
        // Purely descriptive 0-100 read of realized exposure
        // (Offset=0/ETF=100) - never fed back into the search itself.
        riskScore: etfBalance + offsetBalance === 0 ? 0 : Math.round((100 * etfBalance) / (etfBalance + offsetBalance)),
        // TODO-143: since TODO-136, a deficit month can drain the offset
        // instead of being silently floored to zero - so a low offsetBalance
        // (and therefore a high riskScore above) doesn't necessarily mean a
        // deliberate high ETF allocation. Surfacing these lets the UI flag a
        // cell that only looks attractive because it ran out of cash.
        totalCashShortfall: Math.round(result.totalCashShortfall),
        monthsWithShortfall: result.monthsWithShortfall,
      });
    }
  }
  return results;
}

// A strategy is non-dominated if no other strategy has both a lower (or
// equal) totalInterestPaid AND a higher (or equal) etfBalance, with at
// least one strictly better - the classic Pareto-front definition.
// Explicitly no weighted "Overall Score" and no single "best" - two
// independent second opinions and this session's own analysis all
// rejected that (see TODO-52's write-up).
export function selectParetoFront(results) {
  const nonDominated = results.filter((row) =>
    !results.some((other) => {
      if (other === row) return false;
      const notWorse = other.totalInterestPaid <= row.totalInterestPaid && other.etfBalance >= row.etfBalance;
      const strictlyBetter = other.totalInterestPaid < row.totalInterestPaid || other.etfBalance > row.etfBalance;
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
    const key = `${row.totalInterestPaid}-${row.etfBalance}-${row.totalCashShortfall > 0}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  const deduped = [...seen.values()].sort((a, b) => a.etfBalance - b.etfBalance);

  if (deduped.length <= 5) return deduped;

  // Show the spread, not a "winner" - 5 evenly-spaced points across the
  // front by risk (etfBalance), from lowest-risk to highest-risk.
  const sampleCount = 5;
  const indices = Array.from({ length: sampleCount }, (_, i) =>
    Math.round((i * (deduped.length - 1)) / (sampleCount - 1))
  );
  return [...new Set(indices)].map((i) => deduped[i]);
}

// TODO-98: "what if ETFs fall 30%?" - mirrors purchaseHealthCheck.js's own
// Interest Rate Stress Test pattern exactly (descending-severity ladder,
// classifyByBands). "Survived" means this strategy's ETF balance, even
// after the crash, still covers the extra interest it cost to divert
// money away from the offset in the first place - i.e. did it still beat
// the offset-only baseline.
export const ETF_CRASH_BANDS = [
  { min: 50, label: 'Very resilient', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Still ahead of the offset-only baseline even after a 50% crash.' },
  { min: 30, label: 'Resilient', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Still ahead of the offset-only baseline after a 30% crash.' },
  { min: 10, label: 'Fragile', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'A larger crash would put you behind where the offset-only baseline would have left you.' },
  { min: -Infinity, label: 'Already behind', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true, action: 'Even without a crash, this strategy is behind the offset-only baseline.' },
];

export function calculateEtfCrashSurvivedPct(etfBalance, extraInterestPaidForEtf) {
  for (const crash of [50, 30, 10]) {
    if (etfBalance * (1 - crash / 100) >= extraInterestPaidForEtf) return crash;
  }
  return 0;
}

export function classifyEtfCrash(survivedPct) {
  return classifyByBands(survivedPct, ETF_CRASH_BANDS);
}
