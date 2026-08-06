import { calculateMonthlyRate, calculateMonthlyPayment, calculateTotalPropertyCost, calculateMonthlyNetBalance } from './loan';

// Generalizes classifyLvr.js's own mechanism: bands ordered HIGHEST min
// first, each with an inclusive lower bound - works the same whether a
// higher value is better (Emergency Buffer) or worse (Housing Cost Ratio),
// since direction is just baked into which band a given threshold labels.
// The last band's -Infinity is the catch-all for anything below every
// other threshold.
export function classifyByBands(value, bands) {
  return bands.find((band) => value >= band.min) ?? bands[bands.length - 1];
}

// --- TODO-68: Tier 1 (always shown) ---

// Standard "3-6 months of expenses in reserve" rule of thumb.
export const EMERGENCY_BUFFER_BANDS = [
  { min: 12, label: 'Excellent', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Comfortable buffer - keep it up.' },
  { min: 6, label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Solid buffer for most emergencies.' },
  { min: 3, label: 'Moderate', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'Consider building this up before committing further.' },
  { min: -Infinity, label: 'High risk', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true, action: 'Increase savings or reduce purchase price before proceeding.' },
];

// Remaining Savings, in months of (property + personal) expenses covered.
export function calculateEmergencyBufferMonths(cashRemaining, totalMonthlyOutgoings) {
  if (totalMonthlyOutgoings <= 0) return Infinity;
  return cashRemaining / totalMonthlyOutgoings;
}

export function classifyEmergencyBuffer(months) {
  return classifyByBands(months, EMERGENCY_BUFFER_BANDS);
}

// Housing-cost-to-income ratio - lower is better, so the "excellent" band
// sits at the LOW end (opposite direction from Emergency Buffer above,
// same classifyByBands mechanism).
export const HOUSING_COST_RATIO_BANDS = [
  { min: 50, label: 'High risk', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true, action: 'Consider a cheaper property, a bigger deposit, or more income.' },
  { min: 40, label: 'Caution', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'Housing is a large share of income - watch for rate rises.' },
  { min: 30, label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Within a comfortable range.' },
  { min: -Infinity, label: 'Excellent', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Plenty of headroom.' },
];

export function calculateHousingCostRatio(totalPropertyCost, totalMonthlyIncome) {
  if (totalMonthlyIncome <= 0) return Infinity;
  return (totalPropertyCost / totalMonthlyIncome) * 100;
}

// classifyByBands picks the first band whose min the ratio still clears -
// since higher ratio is worse here, bands must be walked from the HIGHEST
// threshold down, which is exactly how HOUSING_COST_RATIO_BANDS is ordered.
export function classifyHousingCostRatio(ratioPct) {
  return classifyByBands(ratioPct, HOUSING_COST_RATIO_BANDS);
}

export const STRESS_TEST_BANDS = [
  { min: 3, label: 'Excellent', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Cash flow survives a 3-point rate rise.' },
  { min: 2, label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Comfortable margin against rate rises.' },
  { min: 1, label: 'Moderate', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'A larger rate rise would put you in deficit.' },
  { min: -Infinity, label: 'High risk', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true, action: 'Even a 1-point rate rise would put you in deficit - borrow less or grow your buffer.' },
];

// Re-amortizes the CURRENT loan balance at interestRate + 1/2/3, recomputing
// the property cost and net balance each time, and returns the largest rate
// rise (in whole percentage points) the cash flow still survives - 0 if it
// fails already at +1. A deliberately simple point-in-time check (not a full
// re-simulation), same "month 1 snapshot" convention as the rest of the app.
export function calculateStressTestSurvivedDelta({
  loanAmount, interestRate, totalMonths, monthlyPropertyExpenses,
  monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses,
}) {
  for (const delta of [3, 2, 1]) {
    const stressedRate = calculateMonthlyRate(interestRate + delta);
    const stressedPayment = calculateMonthlyPayment(loanAmount, stressedRate, totalMonths);
    const stressedPropertyCost = calculateTotalPropertyCost(stressedPayment, monthlyPropertyExpenses);
    const stressedNetBalance = calculateMonthlyNetBalance(monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses, stressedPropertyCost);
    if (stressedNetBalance >= 0) return delta;
  }
  return 0;
}

export function classifyStressTest(survivedDelta) {
  return classifyByBands(survivedDelta, STRESS_TEST_BANDS);
}

export const UPFRONT_COST_RATIO_BANDS = [
  { min: 4, label: 'High', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: false, action: 'Check for any reducible closing costs.' },
  { min: 2, label: 'Normal', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'A typical upfront cost load.' },
  { min: -Infinity, label: 'Excellent', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Low upfront costs relative to price.' },
];

// Everything at settlement EXCLUDING the deposit itself - just the fees
// (stamp duty, surcharge, closing costs, LMI-if-paid-upfront) - otherwise
// this would trivially always read "high" since a deposit is commonly
// 20%+ of the price on its own.
export function calculateUpfrontCostRatio(totalCashRequired, downPayment, propertyPrice) {
  if (propertyPrice <= 0) return 0;
  return ((totalCashRequired - downPayment) / propertyPrice) * 100;
}

export function classifyUpfrontCostRatio(ratioPct) {
  return classifyByBands(ratioPct, UPFRONT_COST_RATIO_BANDS);
}

// --- TODO-69: investment-property-only ---

// Not itself good/bad (per TODO-67/69's own analysis) - just a label plus a
// reminder that negative gearing needs to be affordable from other income.
export function classifyGearing(monthlyPropertyCashflow) {
  return monthlyPropertyCashflow >= 0
    ? { label: 'Positive gearing', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'The property pays for itself.' }
    : { label: 'Negative gearing', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'Make sure the shortfall is affordable from other income.' };
}

export const VACANCY_BUFFER_BANDS = [
  { min: 6, label: 'Excellent', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Comfortable buffer against a vacancy.' },
  { min: 3, label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Reasonable buffer against a vacancy.' },
  { min: -Infinity, label: 'High risk', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true, action: 'Increase your emergency reserve to cover a vacancy.' },
];

export function calculateVacancyBufferMonths(cashRemaining, monthlyPropertyCosts) {
  if (monthlyPropertyCosts <= 0) return Infinity;
  return cashRemaining / monthlyPropertyCosts;
}

export function classifyVacancyBuffer(months) {
  return classifyByBands(months, VACANCY_BUFFER_BANDS);
}

export const RENTAL_YIELD_BANDS = [
  { min: 5, label: 'Strong', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'A strong rental yield.' },
  { min: 3, label: 'Average', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'A typical rental yield.' },
  { min: -Infinity, label: 'Weak', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: false, action: 'Reconsider the purchase if the yield stays this low.' },
];

export function calculateRentalYield(weeklyRentalIncome, propertyPrice) {
  if (propertyPrice <= 0) return 0;
  return ((weeklyRentalIncome * 52) / propertyPrice) * 100;
}

// A missing-data case (no rental income entered yet), not a genuinely weak
// yield reading - callers should check this before showing the % band.
export function hasEnoughDataForRentalYield(weeklyRentalIncome) {
  return weeklyRentalIncome > 0;
}

export function classifyRentalYield(yieldPct) {
  return classifyByBands(yieldPct, RENTAL_YIELD_BANDS);
}

// --- TODO-70 ---

// Bands from the other model's own suggestion (see TODO-67's analysis).
export const MORTGAGE_FREE_AGE_BANDS = [
  { min: 70, label: 'Late', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: false, action: 'Consider a shorter term or higher contributions.' },
  { min: 67, label: 'Cutting it close', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'Close to typical retirement age.' },
  { min: 60, label: 'Reasonable', symbol: '🟡', textClass: 'text-yellow-600 dark:text-yellow-400', critical: false, action: 'A reasonable age to be mortgage-free.' },
  { min: -Infinity, label: 'Early', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Mortgage-free well ahead of retirement age.' },
];

export function calculateMortgageFreeAge(currentAge, loanSimulationYears) {
  return currentAge + loanSimulationYears;
}

export function classifyMortgageFreeAge(age) {
  return classifyByBands(age, MORTGAGE_FREE_AGE_BANDS);
}

export const OFFSET_UTILISATION_BANDS = [
  { min: 20, label: 'Strong', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'A large share of the loan is offset.' },
  { min: 10, label: 'Building', symbol: '🟡', textClass: 'text-yellow-600 dark:text-yellow-400', critical: false, action: 'Offset is building up steadily.' },
  { min: 5, label: 'Early days', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: 'Still early in building your offset.' },
  { min: -Infinity, label: 'Just started', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: false, action: 'Offset balance is still small relative to the loan.' },
];

export function calculateOffsetUtilisation(offset, balance) {
  const totalOwed = offset + balance;
  if (totalOwed <= 0) return 100;
  return (offset / totalOwed) * 100;
}

export function classifyOffsetUtilisation(pct) {
  return classifyByBands(pct, OFFSET_UTILISATION_BANDS);
}
