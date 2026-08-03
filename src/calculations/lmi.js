// Lenders Mortgage Insurance is triggered once LVR exceeds 80% and has no
// official rate card - each lender/insurer prices it differently. These bands
// use the midpoint of typical market ranges (NSW, 2026) as a single estimate.
const LMI_BANDS = [
  { maxLvr: 80, rate: 0 },
  { maxLvr: 85, rate: 0.014 },
  { maxLvr: 90, rate: 0.0275 },
  { maxLvr: 95, rate: 0.045 },
  { maxLvr: Infinity, rate: 0.045 },
];

export function estimateLmi(loanAmount, lvr) {
  if (lvr <= 80) return 0;
  const band = LMI_BANDS.find((b) => lvr <= b.maxLvr);
  return loanAmount * band.rate;
}
