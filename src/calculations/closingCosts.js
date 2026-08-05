// Default closing cost figures live per-state now (src/calculations/states/) -
// TODO-58 moved NSW's own defaults into states/nsw.js's `defaultClosingCosts`,
// since registration fees/searches genuinely vary by state. This file keeps
// only the state-agnostic summing utility every state's figures go through.
export function sumClosingCosts(values) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}
