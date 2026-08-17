// Australian resident income tax, 2026-27 brackets - the year the 16% rate on
// the $18,201-$45,000 bracket dropped to 15% (which also lowered every
// cumulative base above it). Verified against two independent published tables;
// the bases are self-consistent, which is the cheapest check that they're right:
//   (45,000 - 18,200) x 15%      = 4,020
//   4,020 + 90,000 x 30%         = 31,020
//   31,020 + 55,000 x 37%        = 51,370
//
// Same tier shape as NSW_STAMP_DUTY_TIERS (src/calculations/states/nsw.js):
// `max` is the inclusive upper bound (Infinity on the last), `base` the
// cumulative tax already accrued below this tier, `rate` this tier's marginal
// rate, `over` the threshold that rate applies above.
export const AU_TAX_BRACKETS = [
  { max: 18200, base: 0, rate: 0, over: 0 },
  { max: 45000, base: 0, rate: 0.15, over: 18200 },
  { max: 135000, base: 4020, rate: 0.30, over: 45000 },
  { max: 190000, base: 31020, rate: 0.37, over: 135000 },
  { max: Infinity, base: 51370, rate: 0.45, over: 190000 },
];

export function calculateIncomeTax(annualIncome) {
  if (annualIncome <= 0) return 0;
  const bracket = AU_TAX_BRACKETS.find((b) => annualIncome <= b.max);
  return bracket.base + (annualIncome - bracket.over) * bracket.rate;
}

// 2% of taxable income, but phased in rather than switched on: nothing below the
// lower threshold, then 10c per dollar above it until that shade-in catches up
// with the full 2% at the upper threshold (10% x 7,002 = 700.20, vs 2% x 35,013
// = 700.26 - they converge by construction).
//
// Thresholds are the 2025-26 singles figures, paired here with 2026-27 brackets
// because the 2026-27 ones weren't published at the time of writing. They only
// bite below $35,013, so for this app - which exists to model buying a
// several-hundred-thousand-dollar property - the pairing is immaterial. Family
// and senior/pensioner thresholds are higher and are not modelled at all.
export const MEDICARE_LEVY_RATE = 0.02;
export const MEDICARE_LEVY_LOWER_THRESHOLD = 28011;
export const MEDICARE_LEVY_UPPER_THRESHOLD = 35013;
const MEDICARE_LEVY_SHADE_IN_RATE = 0.10;

export function calculateMedicareLevy(annualIncome) {
  if (annualIncome <= MEDICARE_LEVY_LOWER_THRESHOLD) return 0;
  if (annualIncome <= MEDICARE_LEVY_UPPER_THRESHOLD) {
    return (annualIncome - MEDICARE_LEVY_LOWER_THRESHOLD) * MEDICARE_LEVY_SHADE_IN_RATE;
  }
  return annualIncome * MEDICARE_LEVY_RATE;
}

// The blended AVERAGE rate - total tax over total income - which is what the
// app's own `effectiveTaxRate` means. Deliberately NOT the marginal rate of the
// top bracket reached: rental/investment income really does sit on that top
// slice, but surfacing that is TODO-127's job, and AU_TAX_BRACKETS is exported
// above so it can read a matched tier's `rate` directly.
//
// Omits, on purpose: the Low Income Tax Offset (only reaches up to ~$67k), every
// other offset, deductions, and negative gearing (already modelled inside
// offsetSimulation.js - netting it off here too would double-count). So this
// overstates tax for anyone with real deductions. The UI copy says as much.
export function calculateEffectiveTaxRate(annualIncome) {
  if (annualIncome <= 0) return 0;
  const totalTax = calculateIncomeTax(annualIncome) + calculateMedicareLevy(annualIncome);
  return (totalTax / annualIncome) * 100;
}
