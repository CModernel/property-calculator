// NSW Transfer (Stamp) Duty, 2026-27 progressive tiers.
const NSW_STAMP_DUTY_TIERS = [
  { max: 18000, base: 0, rate: 0.0125, over: 0 },
  { max: 38000, base: 225, rate: 0.015, over: 18000 },
  { max: 103000, base: 525, rate: 0.0175, over: 38000 },
  { max: 387000, base: 1662, rate: 0.035, over: 103000 },
  { max: 1290000, base: 11602, rate: 0.045, over: 387000 },
  { max: Infinity, base: 52237, rate: 0.055, over: 1290000 },
];

export function calculateStandardStampDuty(propertyPrice) {
  const tier = NSW_STAMP_DUTY_TIERS.find((t) => propertyPrice <= t.max);
  return tier.base + (propertyPrice - tier.over) * tier.rate;
}

// NSW First Home Buyer Assistance Scheme: full exemption up to $800k, tapering
// to $0 benefit at $1M, standard duty from $1M up. The taper is anchored on the
// standard duty *at $1M* (not at the purchase price) - that's the formula that
// exactly reproduces the three concessional reference points ($850k/$900k/$950k).
export function calculateStampDuty(propertyPrice, isFirstHomeBuyer) {
  if (!isFirstHomeBuyer || propertyPrice >= 1000000) {
    return calculateStandardStampDuty(propertyPrice);
  }
  if (propertyPrice <= 800000) return 0;

  const dutyAt1M = calculateStandardStampDuty(1000000);
  return (dutyAt1M * (propertyPrice - 800000)) / 200000;
}

// NSW Surcharge Purchaser Duty: an extra 8% for foreign persons buying
// residential property, on top of the standard/FHB-concession duty above.
// A flat-rate approximation - independent of isFirstHomeBuyer/
// isInvestmentProperty, since foreign-purchaser status depends on
// residency/citizenship, not occupancy intent. Real-world double-tax-
// agreement exemptions for specific countries are not modeled.
const FOREIGN_PURCHASER_SURCHARGE_RATE = 0.08;

export function calculateForeignPurchaserSurcharge(propertyPrice, isForeignPurchaser) {
  return isForeignPurchaser ? propertyPrice * FOREIGN_PURCHASER_SURCHARGE_RATE : 0;
}

// NSW averages (2026) for the fixed/semi-fixed costs of settling a purchase,
// beyond stamp duty and LMI - registration fees/searches are genuine NSW land-
// registry fees, conveyancing/inspections are more like national market-rate
// averages, kept together here since it's all just default starting points
// (each is independently editable in the UI regardless).
const DEFAULT_CLOSING_COSTS = {
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

// The shape every entry in `states/index.js`'s STATES registry must follow
// (TODO-58). `code` doubles as the short inline UI label ("NSW stamp duty
// concession", "Upfront Costs (NSW)") - `label` is the full name, for spots
// that want it spelled out. LMI (src/calculations/lmi.js) deliberately isn't
// part of this shape - it's priced by lenders/insurers nationally, not by
// state government, so it stays a single shared module regardless of which
// state is selected (see TODO-48's analysis).
const nsw = {
  code: 'NSW',
  label: 'New South Wales',
  calculateStampDuty,
  calculateForeignPurchaserSurcharge,
  fhbSchemeName: 'First Home Buyer Assistance Scheme',
  foreignPurchaserSurchargeRate: FOREIGN_PURCHASER_SURCHARGE_RATE,
  defaultClosingCosts: DEFAULT_CLOSING_COSTS,
};

export default nsw;
