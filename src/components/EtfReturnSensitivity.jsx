import InfoTooltip from './InfoTooltip';
import {
  BREAK_EVEN_FOUND,
  BREAK_EVEN_NEVER_CATCHES_UP,
  BREAK_EVEN_ALREADY_AHEAD,
} from '../calculations/etfBreakEven';

// Same class strings the Pareto table and StrategyScenarioComparison already
// use - that repetition is the established convention here, and following it
// is lower-risk than extracting a shared styles module in this change.
const TH = 'pr-2 pb-1 font-medium whitespace-nowrap';
const TD = 'pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200';

const money = (v) => `$${Math.round(v).toLocaleString()}`;
const signedMoney = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(Math.round(v)).toLocaleString()}`;

// TODO-138: how much does this bet depend on a number nobody can know?
//
// Deliberately has NO metric-over-time selector, unlike the sibling
// StrategyScenarioComparison panel. Partly because a single end-state table
// per return level is the right shape for a sensitivity question, and partly
// because that panel's <select> uses a fixed DOM id - a second one would
// collide with it and break label-based queries.
const EtfReturnSensitivity = ({ summaries, offsetOnlySummary, breakEven, allocationPct }) => {
  const gapVsOffset = (s) => s.netWorth - offsetOnlySummary.netWorth;

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1 mb-1">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">🎚️ How much does the return assumption matter?</h4>
        <InfoTooltip label="How should I read this sensitivity view?">
          <p>The same {allocationPct}% ETF split, run at three different assumed returns - your own figure, and three percentage points either side of it. The band is around YOUR assumption rather than figures this calculator declares "conservative".</p>
          <p className="mt-2">Nobody knows the real number. The point is to see how much of the answer rests on that guess: if the outcome barely moves across the band, the assumption isn't doing much work; if it swings wildly, treat any single projection with care.</p>
        </InfoTooltip>
      </div>

      {breakEven && (
        <div className="mb-3 p-2 rounded bg-white/70 dark:bg-black/20 border border-gray-200 dark:border-gray-700">
          {breakEven.outcome === BREAK_EVEN_FOUND && (
            <>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Break-even return: <span className="text-indigo-700 dark:text-indigo-400">{breakEven.rate.toFixed(1)}% a year</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Below that, sending everything to the offset would have left you better off. This is an illustrative threshold from your own inputs, not a forecast or advice - and clearing it is not guaranteed by anything.
              </p>
            </>
          )}
          {breakEven.outcome === BREAK_EVEN_NEVER_CATCHES_UP && (
            <p className="text-sm text-gray-700 dark:text-gray-200">
              At this loan rate, no plausible ETF return catches up with sending your surplus to the offset over the same period. The interest the offset avoids is simply worth more.
            </p>
          )}
          {breakEven.outcome === BREAK_EVEN_ALREADY_AHEAD && (
            <p className="text-sm text-gray-700 dark:text-gray-200">
              There's no threshold to clear here - your loan interest is low enough that this split matches the offset-only path even if the ETF earned nothing at all.
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Measured at month {breakEven.horizon}, when the offset-only path would have cleared the loan - the last date both paths are genuinely running, so neither is flattered.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">Outcome at three assumed ETF returns</caption>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className={TH}>If the ETF returns</th>
              {summaries.map((s) => <th key={s.key} className={TH}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>ETF balance</td>
              {summaries.map((s) => <td key={s.key} className={TD}>{money(s.etf)}</td>)}
            </tr>
            <tr>
              <td className={TD}>Estimated net worth</td>
              {summaries.map((s) => <td key={s.key} className={`${TD} font-semibold`}>{money(s.netWorth)}</td>)}
            </tr>
            <tr>
              <td className={TD}>
                <span className="flex items-center gap-1">
                  vs. offset only
                  <InfoTooltip label="What is this compared against?">
                    <p>The difference in estimated net worth against sending every surplus dollar to the offset instead, measured on the same date.</p>
                    <p className="mt-2">A negative figure means that assumed return would have left you behind the simpler, more predictable path.</p>
                  </InfoTooltip>
                </span>
              </td>
              {summaries.map((s) => {
                const gap = gapVsOffset(s);
                return (
                  <td
                    key={s.key}
                    className={gap >= 0
                      ? 'pr-2 py-1 whitespace-nowrap font-medium text-green-600 dark:text-green-400'
                      : 'pr-2 py-1 whitespace-nowrap font-medium text-red-600 dark:text-red-400'}
                  >
                    {signedMoney(gap)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EtfReturnSensitivity;
