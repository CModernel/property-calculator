// NSW averages (2026) for the fixed/semi-fixed costs of settling a purchase,
// beyond stamp duty and LMI. Each is independently editable in the UI - these
// are just sensible starting points.
export const DEFAULT_CLOSING_COSTS = {
  conveyancing: 2000,
  buildingInspection: 700,
  pestInspection: 350,
  registrationFees: 400,
  searches: 200,
  loanEstablishmentFee: 0,
  propertyValuation: 0,
  homeInsurance: 800,
  rateAdjustments: 300,
};

export function sumClosingCosts(values) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}
