// LMI is normally capitalised into the loan rather than paid in cash, so it
// only counts toward the cash figure when the user explicitly opts to pay it
// upfront (payLmiUpfront).
export function calculateTotalCashRequired({ downPayment, stampDuty, closingCostsSubtotal, lmi, payLmiUpfront }) {
  return downPayment + stampDuty + closingCostsSubtotal + (payLmiUpfront ? lmi : 0);
}

// Scheduled offset contributions draw from the same savings pool as the
// deposit and upfront costs, so they must come out of the same total - not be
// treated as free money on top of it.
export function calculateCashRemaining({ totalSavings, totalCashRequired, totalScheduledOffset }) {
  return totalSavings - totalCashRequired - totalScheduledOffset;
}
