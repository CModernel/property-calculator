// TODO-55: a static "right now" estimate, deliberately NOT wired into the
// month-by-month offset simulation (offsetSimulation.js) - see TODO.md for
// why a flat estimate was chosen over a full billing-cycle simulation.

// Average "float" the offset gets to hold extra money for, before it's
// swept out to pay the card statement - same averaging principle as
// working-capital cash-flow timing: spend an even $ amount across a
// 30-day cycle, and the average dollar sits avgExtraDaysHeld days longer
// than it would if it left the offset immediately via debit.
export function calculateOffsetTimingBenefit(monthlyCardSpend, avgExtraDaysHeld, interestRate) {
  const averageExtraOffsetBalance = monthlyCardSpend * (avgExtraDaysHeld / 30);
  return averageExtraOffsetBalance * (interestRate / 100);
}

export function calculateCardCashback(monthlyCardSpend, cashbackPct, annualCardFee) {
  return monthlyCardSpend * 12 * (cashbackPct / 100) - annualCardFee;
}
