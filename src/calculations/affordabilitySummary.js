// TODO-135: the single "where do I stand" line at the top of Simple mode.
//
// Deliberately NOT a new judgment, and deliberately not a yes/no verdict - the
// entry that asked for this warns in the same breath against "a falsely precise
// yes/no verdict", and the app's house rule (see RiskToleranceProfiles.jsx) is
// no optimizer and no personalized advice. So this invents no threshold of its
// own: it picks whichever signal is already binding, out of figures and
// classifications Simple displays directly underneath it. Every branch below is
// something the user can independently verify on the same screen.
//
// Shape matches purchaseHealthCheck.js's classify* output ({symbol, textClass,
// label}) plus a headline, so HealthCheckIndicator can consume it unchanged.

// The band tables use these emoji as their severity marker; ranking them here
// avoids re-stating any band's numeric thresholds in this module.
const SYMBOL_SEVERITY = { '🟢': 0, '🟡': 1, '🟠': 2, '🔴': 3 };

// Ordered hardest-constraint-first. A purchase you cannot settle isn't made
// affordable by a comfortable monthly surplus, and a monthly shortfall isn't
// made fine by a healthy buffer - so these two outrank the band classifications
// rather than being averaged with them.
export function summariseAffordability({
  cashRemaining,
  monthlyNetBalance,
  emergencyBufferClass,
  housingCostRatioClass,
  stressTestClass,
}) {
  if (cashRemaining < 0) {
    return {
      label: 'Settlement not covered',
      symbol: '🔴',
      textClass: 'text-red-600 dark:text-red-400',
      headline: "Your savings don't cover the deposit and upfront costs.",
      bindingConstraint: 'cashRemaining',
    };
  }

  if (monthlyNetBalance < 0) {
    return {
      label: 'Monthly shortfall',
      symbol: '🔴',
      textClass: 'text-red-600 dark:text-red-400',
      headline: 'Your monthly costs exceed your monthly income.',
      bindingConstraint: 'monthlyNetBalance',
    };
  }

  // Neither hard constraint binds, so the binding signal is whichever of the
  // Health Check indicators Simple already shows reads worse. `critical` then
  // `symbol` is enough to order them without duplicating any band table's own
  // thresholds here.
  //
  // All THREE indicators Simple renders, not two. Leaving the Stress Test out
  // meant a scenario that is positive today but fails at +1% - a 🔴 critical
  // reading - could still roll up to "Funded ... with room in the indicators
  // below", directly above its own red row. That contradicts this module's
  // whole premise: every branch here is supposed to be something the user can
  // independently verify on the same screen. Ordered as Simple renders them.
  //
  // Carried as [class, name] pairs because the name can no longer be recovered
  // from a two-way identity check on the winner.
  const CANDIDATES = [
    [housingCostRatioClass, 'housingCostRatio'],
    [stressTestClass, 'stressTest'],
    [emergencyBufferClass, 'emergencyBuffer'],
  ];

  const worst = CANDIDATES
    .filter(([classification]) => Boolean(classification))
    .reduce((worstSoFar, candidate) => {
      if (!worstSoFar) return candidate;
      const [c] = candidate;
      const [w] = worstSoFar;
      if (c.critical && !w.critical) return candidate;
      if (w.critical && !c.critical) return worstSoFar;
      return SYMBOL_SEVERITY[c.symbol] > SYMBOL_SEVERITY[w.symbol] ? candidate : worstSoFar;
    }, null);

  if (worst && (worst[0].critical || SYMBOL_SEVERITY[worst[0].symbol] >= SYMBOL_SEVERITY['🟠'])) {
    const [classification, name] = worst;
    return {
      label: 'Tight but funded',
      symbol: classification.symbol,
      textClass: classification.textClass,
      headline: 'Settlement and monthly costs are covered, but one indicator below needs attention.',
      bindingConstraint: name,
    };
  }

  return {
    label: 'Funded',
    symbol: '🟢',
    textClass: 'text-green-600 dark:text-green-400',
    headline: 'Settlement and monthly costs are covered, with room in the indicators below.',
    bindingConstraint: null,
  };
}
