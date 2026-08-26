// TODO-142: a deliberately STATIC reference panel - no calculation, no state,
// no button that touches the ETF Allocation slider above. The whole ETF
// comparison family (TODO-137/138/144/145) already draws the same line: no
// optimizer, no personalized advice. This panel just has to stay inside it.
//
// Ranges are illustrative on purpose, never a single precise percentage -
// "investors who describe themselves as X typically consider a range around
// Y", never "you should do Y".
//
// TODO-156: the buffer wording is the Health Check panel's own, not a local
// re-implementation. This file used to carry a third inline copy that guarded
// only Number.isFinite, so it kept rendering "-0.3 months" after TODO-149 had
// fixed the other two sites. Still no calculation here - bufferDisplay is
// presentation only.
import { bufferDisplay } from '../calculations/healthCheckDisplay';

const PROFILES = [
  {
    label: 'Conservative',
    range: '~10-30%',
    rationale: 'Short time horizon, low tolerance for a market drop, or a variable-rate mortgage you\'d rather pay down first.',
    bgClass: 'bg-blue-50 dark:bg-blue-950',
    borderClass: 'border-blue-100 dark:border-blue-800',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Moderate',
    range: '~30-60%',
    rationale: 'Medium-to-long horizon, steady income, comfortable riding out a downturn without needing to sell.',
    bgClass: 'bg-purple-50 dark:bg-purple-950',
    borderClass: 'border-purple-100 dark:border-purple-800',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  {
    label: 'Aggressive',
    range: '~60-90%',
    rationale: 'Long horizon (10+ years), high tolerance for volatility, income secure enough that the offset isn\'t your main safety net.',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950',
    borderClass: 'border-indigo-100 dark:border-indigo-800',
    textClass: 'text-indigo-600 dark:text-indigo-400',
  },
];

const RiskToleranceProfiles = ({ emergencyBufferMonths, emergencyBufferClassification, liquidSavings }) => {
  const bufferText = bufferDisplay(emergencyBufferMonths, liquidSavings);

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm space-y-3">
      <p className="font-semibold text-gray-700 dark:text-gray-200">🧭 Risk-tolerance reference points</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PROFILES.map((profile) => (
          <div key={profile.label} className={`p-4 rounded-lg border text-center ${profile.bgClass} ${profile.borderClass}`}>
            <p className={`text-xs font-bold uppercase mb-1 ${profile.textClass}`}>{profile.label}</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{profile.range}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{profile.rationale}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-300">
        Regardless of profile, many planners suggest keeping your Emergency Buffer - money in the Offset covering essential expenses - funded before directing any surplus to ETFs. Your Emergency Buffer right now:{' '}
        <span className={`font-semibold ${emergencyBufferClassification.textClass}`}>
          {emergencyBufferClassification.symbol} {bufferText} ({emergencyBufferClassification.label})
        </span>.
      </p>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <p className="text-xs text-amber-800 dark:text-amber-400">
          ⚠️ Illustrative starting points from general financial-planning practice, not personal advice. Your ETF Allocation slider above is unaffected by anything here - there's no button that applies these.
        </p>
      </div>
    </div>
  );
};

export default RiskToleranceProfiles;
