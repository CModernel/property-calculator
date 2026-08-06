import { calculateMonthlyRate } from './loan';

// A value that grows by a fixed annual % rate, compounding monthly - same
// annual-to-monthly conversion convention as interestRate/
// savingsInterestRate (calculateMonthlyRate). Reused by TODO-90 (Salary
// Growth), TODO-91 (Rent Growth), TODO-92 (Expense Inflation) - each just
// calls this with their own base value/rate/elapsed months.
//
// Unlike offsetBalance/savingsBalance in offsetSimulation.js, this is a
// pure function of elapsed time, not a running accumulator - the result
// doesn't depend on anything mutated inside the monthly loop, so callers
// just call this once per month using the loop's own month counter.
export function calculateCompoundedValue(baseValue, annualGrowthRate, month) {
  const monthlyGrowthRate = calculateMonthlyRate(annualGrowthRate);
  return baseValue * Math.pow(1 + monthlyGrowthRate, month);
}
