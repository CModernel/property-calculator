// LMI is normally capitalised into the loan rather than paid in cash, so it
// only counts toward the cash figure when the user explicitly opts to pay it
// upfront (payLmiUpfront).
export function calculateTotalCashRequired({ downPayment, stampDuty, closingCostsSubtotal, lmi, payLmiUpfront }) {
  return downPayment + stampDuty + closingCostsSubtotal + (payLmiUpfront ? lmi : 0);
}
