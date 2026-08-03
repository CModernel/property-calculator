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
