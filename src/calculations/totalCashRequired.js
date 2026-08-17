// LMI is normally capitalised into the loan rather than paid in cash, so it
// only counts toward the cash figure when the user explicitly opts to pay it
// upfront (payLmiUpfront).
export function calculateTotalCashRequired({
  downPayment, stampDuty, foreignPurchaserSurcharge = 0, closingCostsSubtotal, lmi, payLmiUpfront,
}) {
  return downPayment + stampDuty + foreignPurchaserSurcharge + closingCostsSubtotal + (payLmiUpfront ? lmi : 0);
}

// Scheduled offset contributions draw from the same savings pool as the
// deposit and upfront costs, so they must come out of the same total - not be
// treated as free money on top of it. This is the "how much uncommitted cash
// is left in the bank" figure, and it also seeds the simulation's savings
// balance (which credits the contributions into the offset separately, as
// each one's month arrives - so counting them here too would double them).
export function calculateCashRemaining({ totalSavings, totalCashRequired, totalScheduledOffset }) {
  return totalSavings - totalCashRequired - totalScheduledOffset;
}

// Everything the buyer still OWNS and can reach on settlement day, whether it
// sits in the bank or in the offset account. Deliberately not cashRemaining: a
// scheduled offset contribution leaves the bank but stays the buyer's money and
// stays fully liquid - offsetSimulation.js itself draws the offset down first
// to cover a deficit month, so the engine already treats it as the emergency
// fund. The Emergency/Vacancy Buffer indicators ask "how long could you last
// with no income", and in that scenario you simply don't make the transfer (or
// you pull it back out), so earmarking cash for the offset must not shrink
// them. Only the "Cash Remaining" display, answering a different question,
// subtracts it.
export function calculateLiquidSavings({ totalSavings, totalCashRequired }) {
  return totalSavings - totalCashRequired;
}
