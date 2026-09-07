import InfoTooltip from './InfoTooltip';
import { COMPARISON_METRICS, CUSTOM } from '../calculations/strategyScenarios';

const TH = 'pr-2 pb-1 font-medium whitespace-nowrap';
const TD = 'pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200';

const money = (v) => `$${Math.round(v).toLocaleString()}`;

// The simulation reports payoff in months; show both so a 112 and a 113 are
// distinguishable without mental arithmetic.
//
// TODO-167: there used to be a `if (months >= 999 * 12) return 'never'` guard
// here, and it never fired once. It was written against the sentinel's
// `years: 999` but applied to `months`, which the early-out sets to maxMonths
// (360) - never 11988. Removed rather than corrected: App.jsx already refuses
// to render this panel unless hasUsableData passes, so every `months` reaching
// here is a real payoff month.
function payoff(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
}

// TODO-137: a deliberately non-ranking comparison. Two tables answering two
// different questions - "where does each strategy end up" and "when does one
// overtake another" - rather than one ~21-column grid, and never a single
// "best" verdict (same principle as strategyComparison.js's Pareto front).
const StrategyScenarioComparison = ({ summaries, rows, metricKey, onMetricChange, monthlyStepping }) => {
  const anyShortfall = summaries.some((s) => s.totalCashShortfall > 0);
  const metricLabel = COMPARISON_METRICS.find((m) => m.key === metricKey)?.label ?? '';

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1 mb-1">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">⚖️ Offset vs ETF, side by side</h4>
        <InfoTooltip label="How should I read this comparison?">
          <p>The same inputs run three ways, changing only where your monthly surplus goes. "All to ETF" is a boundary to compare against, not a recommendation.</p>
          <p className="mt-2">The offset column is the predictable one: reducing loan interest is a known, effectively tax-free saving. Every ETF figure is a projection built on the Expected ETF Return you set - it is not a forecast, and a real market can do far worse.</p>
        </InfoTooltip>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Strategies finish at different times, so the table runs to whichever takes longest. One that already finished stops changing.
      </p>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">Where each strategy ends up</caption>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className={TH}>Where you end up</th>
              {summaries.map((s) => (
                <th key={s.key} className={TH}>
                  {s.label}
                  {s.key === CUSTOM && <span className="font-normal"> ({s.etfAllocationPct}% ETF)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>Time to pay off</td>
              {summaries.map((s) => <td key={s.key} className={TD}>{payoff(s.payoffMonths)}</td>)}
            </tr>
            <tr>
              <td className={TD}>Total interest paid</td>
              {summaries.map((s) => <td key={s.key} className={TD}>{money(s.totalInterest)}</td>)}
            </tr>
            <tr>
              <td className={TD}>Offset balance</td>
              {summaries.map((s) => <td key={s.key} className={TD}>{money(s.offset)}</td>)}
            </tr>
            <tr>
              <td className={TD}>ETF balance</td>
              {summaries.map((s) => <td key={s.key} className={TD}>{money(s.etf)}</td>)}
            </tr>
            <tr>
              <td className={TD}>
                <span className="flex items-center gap-1">
                  Accessible cash
                  <InfoTooltip label="What counts as accessible cash?">
                    <p>Your offset balance plus leftover settlement savings - money you could reach without selling an investment.</p>
                    <p className="mt-2">The ETF balance is deliberately excluded. Needing to sell units, possibly at a loss and with tax to settle, is exactly the trade-off this comparison exists to show.</p>
                  </InfoTooltip>
                </span>
              </td>
              {summaries.map((s) => <td key={s.key} className={TD}>{money(s.accessibleCash)}</td>)}
            </tr>
            <tr>
              <td className={TD}>Property equity</td>
              {summaries.map((s) => <td key={s.key} className={TD}>{money(s.propertyEquity)}</td>)}
            </tr>
            <tr>
              <td className={TD}>Estimated net worth</td>
              {summaries.map((s) => <td key={s.key} className={`${TD} font-semibold`}>{money(s.netWorth)}</td>)}
            </tr>
            {anyShortfall && (
              <tr>
                <td className={TD}>Cash shortfall</td>
                {summaries.map((s) => (
                  <td
                    key={s.key}
                    className={s.totalCashShortfall > 0
                      ? 'pr-2 py-1 whitespace-nowrap font-medium text-red-600 dark:text-red-400'
                      : TD}
                  >
                    {s.totalCashShortfall > 0
                      ? `⚠️ ${money(s.totalCashShortfall)} over ${s.monthsWithShortfall} mo`
                      : 'None'}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {anyShortfall && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-3">
          ⚠️ A strategy above runs out of cash in some months - its expenses exceed its income once the offset is empty. Those figures assume money you don't have, so treat them as not actually achievable rather than as a better outcome.
        </p>
      )}

      <div className="flex items-center gap-2 mb-2">
        <label htmlFor="comparison-metric" className="text-xs font-medium text-gray-700 dark:text-gray-200">Track over time:</label>
        <select
          id="comparison-metric"
          value={metricKey}
          onChange={(e) => onMetricChange(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          {COMPARISON_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">{metricLabel} for each strategy over time</caption>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className={TH}>{monthlyStepping ? 'Month' : 'Year'}</th>
              {summaries.map((s) => <th key={s.key} className={TH}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td className={TD}>{monthlyStepping ? row.month : (row.month / 12).toFixed(row.month % 12 === 0 ? 0 : 1)}</td>
                {row.values.map((v) => (
                  <td
                    key={v.key}
                    className={v.settledAtMonth ? 'pr-2 py-1 whitespace-nowrap text-gray-400 dark:text-gray-500 italic' : TD}
                  >
                    {/* TODO-168: a finished strategy is not simulated past its
                        payoff, so its figures are frozen at that month. Saying
                        so beats printing a stale dollar amount that reads as a
                        live one - which is how the fastest-paying strategy came
                        to look like the worst at year 30. */}
                    {v.settledAtMonth ? `✓ paid off m${v.settledAtMonth}` : money(v.value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StrategyScenarioComparison;
