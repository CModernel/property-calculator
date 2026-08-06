import { calculateMonthlyRate } from './loan';

// TODO-93: a pure display-layer conversion - discounts each month's actual
// interest payment back to today's dollars individually (not a single
// power-of-years discount on the aggregate), since interest is paid
// gradually over the loan's life, not as one lump sum at the end. Reads
// monthlyData's own monthlyInterestPaid - nothing about the simulation
// loop itself changes.
export function calculatePresentValueOfInterest(monthlyData, inflationRate) {
  const monthlyInflationRate = calculateMonthlyRate(inflationRate);
  return monthlyData.reduce(
    (sum, d) => sum + d.monthlyInterestPaid / Math.pow(1 + monthlyInflationRate, d.month),
    0
  );
}
