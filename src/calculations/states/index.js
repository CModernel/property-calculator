import nsw from './nsw';

// One entry per supported state, each following nsw.js's shape (code, label,
// calculateStampDuty, calculateForeignPurchaserSurcharge, fhbSchemeName,
// foreignPurchaserSurchargeRate, defaultClosingCosts). Adding a new state
// means adding a module here, not restructuring src/App.jsx (TODO-58).
export const STATES = {
  NSW: nsw,
};

// Falls back to NSW for an unrecognised code (e.g. a typo in config.local.json)
// rather than throwing, since a broken config value shouldn't crash the app.
export function getStateModule(code) {
  return STATES[code] ?? STATES.NSW;
}
