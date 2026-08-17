import InfoTooltip from './InfoTooltip';

// One row of the Purchase Health Check panel (TODO-68/69/70) - reused across
// all 10 indicators so each one is just a `classification` object (from
// src/calculations/purchaseHealthCheck.js's classify* functions) plus a
// label/value/tooltip, rather than repeating this markup 10 times.
// secondaryValueDisplay (TODO-134): a pre-formatted "stabilizes to..."
// annotation for the handful of indicators that also project a future
// reading. Omitted entirely for indicators that don't get the treatment.
const HealthCheckIndicator = ({ label, tooltipLabel, children, valueDisplay, secondaryValueDisplay, classification }) => (
  <div className="py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <div className="flex justify-between items-center gap-2">
      <span className="text-gray-700 dark:text-gray-200 flex items-center">
        {label}
        {children && <InfoTooltip label={tooltipLabel}>{children}</InfoTooltip>}
      </span>
      <span className={`font-semibold whitespace-nowrap ${classification.textClass}`}>
        {classification.symbol} {valueDisplay}
      </span>
    </div>
    {secondaryValueDisplay && (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 text-right">{secondaryValueDisplay}</p>
    )}
    {classification.action && (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{classification.action}</p>
    )}
  </div>
);

export default HealthCheckIndicator;
