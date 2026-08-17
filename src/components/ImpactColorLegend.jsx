// TODO-139: explains the slider color/icon scheme once, near the top of the
// page, rather than repeating it per card - a footnote, not a feature.
// Static reference panel, same convention as RiskToleranceProfiles.jsx: no
// state, no calculation, nothing here writes into any slider.
const IMPACT_LEGEND = [
  { icon: '⬇', textClass: 'text-orange-600 dark:text-orange-400', label: 'Costs you more', hint: 'higher = worse outcome' },
  { icon: '⬆', textClass: 'text-green-600 dark:text-green-400', label: 'Helps you', hint: 'higher = better outcome' },
  { icon: '↔', textClass: 'text-violet-600 dark:text-violet-400', label: 'Mixed / depends', hint: 'no single clear direction' },
];

const ImpactColorLegend = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
    <span className="font-medium text-gray-700 dark:text-gray-200">Slider colors:</span>
    {IMPACT_LEGEND.map((item) => (
      <span key={item.label}>
        <span aria-hidden="true" className={item.textClass}>{item.icon}</span> {item.label} <span className="text-gray-400 dark:text-gray-500">({item.hint})</span>
      </span>
    ))}
    <span className="text-gray-400 dark:text-gray-500">Some sliders (e.g. growth-rate assumptions, your age) are left uncolored - they don't move these three outcomes.</span>
  </div>
);

export default ImpactColorLegend;
