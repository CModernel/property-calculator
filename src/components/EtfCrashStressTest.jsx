import InfoTooltip from './InfoTooltip';

// Same class strings as EtfReturnSensitivity and the Pareto table - that
// repetition is the established convention here.
const TH = 'pr-2 pb-1 font-medium whitespace-nowrap';
const TD = 'pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200';

const money = (v) => `$${Math.round(v).toLocaleString()}`;
const signedMoney = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(Math.round(v)).toLocaleString()}`;

// TODO-145: what does this bet actually put at risk?
//
// The honest headline is at the bottom rather than buried: because this model
// never sells ETF units to service the mortgage, a crash cannot change payoff
// time or total interest. That's the finding, not a caveat - it tells the reader
// the ETF balance is not their safety net, which is precisely the offset-vs-ETF
// trade-off this whole family of panels exists to surface.
//
// Deliberately does NOT reuse ETF_CRASH_BANDS: those are already in live use in
// the Pareto table's "Crash Test" column, where "survived %" answers a different
// question (did the final ETF balance still beat the offset-only baseline), and
// their 50/30/10 thresholds are calibrated to that search. This panel reports
// dollars, so it needs no band at all.
const EtfCrashStressTest = ({ summaries, crashMonth }) => {
  const [baseline, ...crashed] = summaries;

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1 mb-1">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">📉 What if the market drops?</h4>
        <InfoTooltip label="How should I read this stress test?">
          <p>One single, one-off fall in your ETF balance at month {crashMonth}, then the balance carries on compounding at your same assumed return. Not a forecast, and not a model of how markets actually behave - a deliberately simple "what would this cost me" check.</p>
          <p className="mt-2">A LATER crash generally costs more, not less: your balance keeps growing from ongoing contributions, so a later drop takes a percentage of a much bigger number, and that outweighs the compounding the earlier loss would have missed out on. Move the crash month to see it for your own figures.</p>
          <p className="mt-2">A crash after your loan is paid off shows no effect at all, because this projection stops there.</p>
        </InfoTooltip>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">Outcome after a one-off ETF market drop at month {crashMonth}</caption>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className={TH}>If the ETF falls</th>
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
                  vs. no crash
                  <InfoTooltip label="What is this compared against?">
                    <p>The difference in estimated net worth against your own current projection with no crash at all - the leftmost column.</p>
                  </InfoTooltip>
                </span>
              </td>
              <td className={TD}>—</td>
              {crashed.map((s) => {
                const gap = s.netWorth - baseline.netWorth;
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

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Time to pay off and total interest are identical in every column: this model never sells ETF units to service the mortgage, so a crash cannot change the loan itself. That is worth knowing on its own - the ETF balance is not an emergency buffer.
      </p>
    </div>
  );
};

export default EtfCrashStressTest;
