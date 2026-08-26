// TODO-156: the display wording for Health Check indicators, extracted so the
// three places that render them share ONE implementation.
//
// Each indicator can appear in the Advanced panel (App.jsx), Simple mode
// (SimpleModeView.jsx) and the risk-tolerance reference panel
// (RiskToleranceProfiles.jsx), and each had its own inline copy of these
// one-liners. That is not a style problem, it is how two shipped fixes ended
// up applying to some sites and not others:
//   - TODO-148 taught the Advanced panel to say "Already in deficit" instead of
//     "Fails at +1%", but Simple mode kept its own pre-fix ternary, so the same
//     scenario answered differently depending on which mode you were in.
//   - TODO-149 replaced a negative month count with "Can't cover settlement" in
//     the Advanced panel and Simple mode, but RiskToleranceProfiles kept a
//     third copy and still rendered "-0.3 months".
// A caller that forgets an argument now gets a wrong-looking figure in every
// site at once rather than a silent disagreement between two of them.
//
// Presentation only. No classification, no threshold, and no calculation lives
// here - callers pass figures the calculation modules already produced.

// calculateStressTestSurvivedDelta returns 0 both when a scenario is already in
// deficit at today's rate and when it only fails once rates rise a point - it
// never separately probes +0. `alreadyInDeficit` is the caller's own
// already-computed net balance at the rate actually being tested (today's for
// the Day-1 reading, the Stabilized month's projected rate for that one).
export function stressTestDisplay(survivedDelta, alreadyInDeficit) {
  if (survivedDelta > 0) return `Survives +${survivedDelta}%`;
  return alreadyInDeficit ? 'Already in deficit' : 'Fails at +1%';
}

// calculateEmergencyBufferMonths/calculateVacancyBufferMonths keep dividing
// liquidSavings by monthly outgoings unclamped, so a settlement that can't be
// funded at all produces a negative "months" figure - not a meaningful buffer
// size, and easy to misread as merely thin rather than "you can't fund this at
// all". The classification stays 🔴 High risk either way.
export function bufferDisplay(months, liquidSavings) {
  if (liquidSavings < 0) return "Can't cover settlement";
  return Number.isFinite(months) ? `${months.toFixed(1)} months` : '∞';
}

// Same shortfall liquidSavings already represents in the "You've committed $X
// more than your savings cover" warning in the Available Savings summary -
// restated here rather than invented afresh, so the two agree.
export function bufferShortfallAction(liquidSavings) {
  return `Short by $${Math.abs(Math.round(liquidSavings)).toLocaleString()} at settlement - reduce the price, add to savings, or scale back scheduled contributions.`;
}

// Arrow prefix for an indicator's "stabilizes to..." annotation - whether the
// Stabilized reading is better, worse, or the same as Day 1, in that
// indicator's own direction (higherIsBetter/higherIsWorse).
export function stabilizedArrow(day1Value, stabilizedValue, direction) {
  if (stabilizedValue === day1Value) return '→';
  const improved = direction === 'higherIsBetter' ? stabilizedValue > day1Value : stabilizedValue < day1Value;
  return improved ? '↗' : '↘';
}
